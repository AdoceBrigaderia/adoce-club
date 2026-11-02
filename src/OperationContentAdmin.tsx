import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { confirmAction } from "./lib/confirm-dialog";
import type { Session } from "@supabase/supabase-js";
import {
  Check,
  Clock3,
  Download,
  Eye,
  ImagePlus,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { isPriceOnRequest } from "./consultation-pricing";
import {
  PRODUCT_IMAGE_LIMIT,
  uploadEditedProductImage,
  validateProductImage,
  type EditedProductImage,
} from "./admin-media";
import ImageEditor, { PRODUCT_IMAGE_PRESET } from "./ImageEditor";
import ClipboardImageInput from "./ClipboardImageInput";
import ShoppingBatchSuggestions from "./ShoppingBatchSuggestions";
import ProductionReleasePanel from "./ProductionReleasePanel";
import { currentLocalTime, normalizeTime, type AvailabilityBatch } from "./availability-batches";
import { weekStart, shiftDate } from "./lib/shopping-week";
import { openOperationArea } from "./lib/operation-navigation";
import { formatCurrency } from "./lib/cost-format";
import "./content-admin.css";

export type AdminTab = "catalog" | "today" | "operation";
type Flavor = {
  id: string;
  name: string;
  short_name: string | null;
  category: "traditional" | "premium";
  short_description: string | null;
  description: string | null;
  ingredients: string | null;
  base_price: number | null;
  image_path: string | null;
  whole_cake_image_path: string | null;
  whole_cake_original_image_path: string | null;
  whole_cake_available: boolean;
  active: boolean;
  sort_order: number;
};
type FlavorImage = {
  id: string;
  flavor_id: string;
  image_path: string;
  original_image_path: string | null;
  alt_text: string;
  caption: string | null;
  image_role: string;
  sort_order: number;
  active: boolean;
};
type PendingFlavorImage = {
  flavor: Flavor;
  file: File;
  role: "cover" | "gallery" | "whole_cake";
  mediaId?: string;
};
export type AvailabilityStatus =
  "available" | "last_units" | "sold_out" | "preorder_only" | "unavailable";
export type Availability = {
  id?: string;
  flavor_id: string;
  status: AvailabilityStatus;
  note: string | null;
  quantity_available: number | null;
  quantity_reserved: number;
};
type AdminAvailabilityBatch = AvailabilityBatch & {
  service_date: string;
  active: boolean;
};
type AffectedBatchOrder = {
  order_id: string;
  order_number: string;
  customer_name: string | null;
  sales_channel: string | null;
  quantity: number;
};
type WeekBatchRow = {
  flavor_id: string;
  service_date: string;
  quantity_available: number;
  quantity_reserved: number;
};
type Channel = {
  slug: string;
  label: string;
  status: string;
  message: string | null;
  next_change_at: string | null;
};
type OrderSauceRow = { id: string; name: string; active: boolean; sort_order: number };
export type BusinessHour = {
  id: string;
  channel_slug: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
  note: string | null;
};
type BusinessHourException = {
  id: string;
  channel_slug: string;
  service_date: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  message: string | null;
};
const emptyFlavor = {
  name: "",
  short_name: "",
  category: "traditional" as "traditional" | "premium",
  short_description: "",
  description: "",
  ingredients: "",
  base_price: "16.00",
  unit_cost: "",
  whole_cake_available: false,
  active: true,
};

const availabilityLabels: Record<AvailabilityStatus, string> = {
  available: "Disponível agora",
  last_units: "Últimas unidades",
  sold_out: "Esgotado",
  preorder_only: "Somente encomenda",
  unavailable: "Indisponível",
};
const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const matchesText = (flavor: { name: string; short_name?: string | null }, term: string) => {
  const wanted = normalizeSearch(term);
  return !wanted || normalizeSearch(`${flavor.name} ${flavor.short_name || ""}`).includes(wanted);
};

const scheduleChannelHints: Record<string, string> = {
  online_orders: "Pedidos de fatias feitos on-line para retirada na Adoce.",
  in_person: "Atendimento presencial no Cantinho da Adoce.",
  preorders: "Encomendas de tortas e docinhos.",
  store: "Canal antigo, sem atendimento ao público no endereço de produção.",
};

const availabilityPriority: Record<AvailabilityStatus, number> = {
  available: 0,
  last_units: 1,
  preorder_only: 2,
  sold_out: 3,
  unavailable: 4,
};

export function sortFlavorsByAvailability(
  flavors: Flavor[],
  availability: Availability[],
) {
  const statusByFlavor = new Map(
    availability.map((item) => [item.flavor_id, item.status]),
  );
  return flavors
    .filter((flavor) => flavor.active)
    .slice()
    .sort((a, b) => {
      const aStatus = statusByFlavor.get(a.id) || "unavailable";
      const bStatus = statusByFlavor.get(b.id) || "unavailable";
      return (
        availabilityPriority[aStatus] - availabilityPriority[bStatus] ||
        a.name.localeCompare(b.name, "pt-BR")
      );
    });
}

const scheduleChannelLabels: Record<string, string> = {
  online_orders: "Pedidos online — retirada na Adoce",
  in_person: "Cantinho da Adoce",
  preorders: "Encomendas futuras — não controla a retirada",
  store: "Canal antigo — não utilizar",
};

export function filterBusinessHours(
  hours: BusinessHour[],
  channelSlug: string,
) {
  return hours
    .filter((hour) => hour.channel_slug === channelSlug)
    .slice()
    .sort(
      (a, b) =>
        a.weekday - b.weekday || a.opens_at.localeCompare(b.opens_at),
    );
}

function todayInFortaleza() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDay(date: string, amount: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

export default function OperationContentAdmin({
  session,
  role,
  initialTab = "catalog",
  initialAvailabilityFilter = "all",
  allowedTabs = ["catalog", "today", "operation"],
}: {
  session: Session;
  role: string;
  initialTab?: AdminTab;
  initialAvailabilityFilter?: "all" | "low" | "unlisted";
  allowedTabs?: AdminTab[];
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "low" | "unlisted">(initialAvailabilityFilter);
  const [availabilitySearch, setAvailabilitySearch] = useState("");
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [images, setImages] = useState<FlavorImage[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [availabilityBatches, setAvailabilityBatches] = useState<AdminAvailabilityBatch[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayInFortaleza());
  const [weekBatches, setWeekBatches] = useState<WeekBatchRow[]>([]);
  const [clearingWeek, setClearingWeek] = useState(false);
  const weekAnchor = useMemo(() => weekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(weekAnchor, index)),
    [weekAnchor],
  );
  const [batchDrafts, setBatchDrafts] = useState<Record<string, { time: string; quantity: string }>>({});
  const [existingBatchDrafts, setExistingBatchDrafts] = useState<Record<string, { time: string; quantity: string }>>({});
  const sortedAvailabilityFlavors = useMemo(
    () => sortFlavorsByAvailability(flavors, availability),
    [flavors, availability],
  );
  const lowStockFlavorIds = useMemo(
    () => new Set(availability.filter((item) => {
      const remaining = Number(item.quantity_available || 0) - Number(item.quantity_reserved || 0);
      return item.status !== "unavailable" && item.quantity_available != null && remaining >= 0 && remaining <= 3;
    }).map((item) => item.flavor_id)),
    [availability],
  );
  // A lista principal só mostra sabores já importados do planejamento de
  // compras pra esse dia (têm linha em flavor_availability hoje) — o resto
  // do catálogo fica na aba "Sabores sem lote hoje", pra não poluir a lista
  // normal mas continuar acessível pra quem quiser liberar um sabor extra.
  const importedTodayFlavorIds = useMemo(
    () => new Set(availability.map((item) => item.flavor_id)),
    [availability],
  );
  const visibleAvailabilityFlavors = (availabilityFilter === "low"
    ? sortedAvailabilityFlavors.filter((flavor) => lowStockFlavorIds.has(flavor.id))
    : sortedAvailabilityFlavors
  ).filter((flavor) => importedTodayFlavorIds.has(flavor.id) && matchesText(flavor, availabilitySearch));
  const unlistedTodayFlavors = useMemo(
    () => sortFlavorsByAvailability(flavors, availability)
      .filter((flavor) => !importedTodayFlavorIds.has(flavor.id)),
    [flavors, availability, importedTodayFlavorIds],
  ).filter((flavor) => matchesText(flavor, availabilitySearch));
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sauces, setSauces] = useState<OrderSauceRow[]>([]);
  const [sauceBusy, setSauceBusy] = useState<string | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[]>([]);
  const [editing, setEditing] = useState<Flavor | null>(null);
  const [creatingFlavor, setCreatingFlavor] = useState(false);
  const editorPanelRef = useRef<HTMLElement>(null);
  const scrolledForEditing = useRef<string | null>(null);
  const canSeeCosts = role === "owner" || role === "manager";
  const [costs, setCosts] = useState<Record<string, number>>({});
  const productFormOpen = creatingFlavor || Boolean(editing);
  useEffect(() => {
    if (!productFormOpen || !editing) { scrolledForEditing.current = null; return; }
    if (scrolledForEditing.current === editing.id) return;
    scrolledForEditing.current = editing.id;
    editorPanelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [productFormOpen, editing]);
  const [draft, setDraft] = useState({ ...emptyFlavor });
  const [cakeGPrice, setCakeGPrice] = useState<number | null>(null);
  type CakeSizeCost = { whole_cost: number | null; yield_quantity: number; yield_unit: string } | null;
  type CalculatedFlavorCosts = {
    slice: { unit_cost: number | null; source: string | null } | null;
    sizes: Partial<Record<"G" | "M" | "P", CakeSizeCost>> | null;
  };
  const [calculatedCosts, setCalculatedCosts] = useState<CalculatedFlavorCosts | null>(null);
  // Custo calculado direto da ficha técnica (insumo + embalagem / rendimento
  // da torta) -- só leitura aqui; nunca grava cópia, sempre busca de novo ao
  // abrir o sabor. Enquanto não houver ficha, fica em branco (nunca inventa).
  useEffect(() => {
    if (!editing) { setCalculatedCosts(null); return; }
    let cancelled = false;
    const supabase = requireSupabase();
    void Promise.all([
      supabase.rpc("flavor_unit_cost_breakdown", { target_flavor_id: editing.id }),
      supabase.rpc("flavor_cake_costs", { target_flavor_id: editing.id }),
    ]).then(([sliceResult, sizesResult]) => {
      if (cancelled) return;
      setCalculatedCosts({
        slice: (sliceResult.data as CalculatedFlavorCosts["slice"]) || null,
        sizes: (sizesResult.data as CalculatedFlavorCosts["sizes"]) || null,
      });
    });
    return () => { cancelled = true; };
  }, [editing?.id]);
  const [galleryFlavor, setGalleryFlavor] = useState<Flavor | null>(null);
  const [batchDeletionConfirm, setBatchDeletionConfirm] = useState<{
    flavor: Flavor;
    batch: AdminAvailabilityBatch;
    affectedOrders: AffectedBatchOrder[];
  } | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingFlavorImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hourDraft, setHourDraft] = useState({
    channel_slug: "online_orders",
    weekday: 1,
    opens_at: "09:00",
    closes_at: "18:00",
    note: "",
  });
  const [editingHourId, setEditingHourId] = useState<string | null>(null);
  const [exceptionDraft, setExceptionDraft] = useState({
    channel_slug: "store",
    service_date: todayInFortaleza(),
    closed: true,
    opens_at: "09:00",
    closes_at: "18:00",
    note: "",
  });
  const load = useCallback(async () => {
    setBusy(true);
    const supabase = requireSupabase();
    const today = todayInFortaleza();
    const viewedDate = selectedDate;
    const [
      flavorResult,
      imageResult,
      availabilityResult,
      batchResult,
      channelResult,
      hourResult,
      exceptionResult,
      promoResult,
      campaignResult,
      cakePriceResult,
      sauceResult,
    ] = await Promise.all([
      supabase
        .from("flavors")
        .select(
          "id,name,short_name,category,short_description,description,ingredients,base_price,image_path,whole_cake_image_path,whole_cake_original_image_path,whole_cake_available,active,sort_order",
        )
        .order("name"),
      supabase
        .from("flavor_images")
        .select(
          "id,flavor_id,image_path,original_image_path,alt_text,caption,image_role,sort_order,active",
        )
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("flavor_availability")
        .select("id,flavor_id,status,note,quantity_available,quantity_reserved")
        .eq("service_date", viewedDate),
      supabase
        .from("flavor_availability_batches")
        .select("id,flavor_id,service_date,available_from,quantity_available,quantity_reserved,active")
        .eq("service_date", viewedDate)
        .eq("active", true)
        .order("available_from"),
      supabase
        .from("store_channels")
        .select("slug,label,status,message,next_change_at")
        .order("slug"),
      supabase
        .from("business_hours")
        .select("id,channel_slug,weekday,opens_at,closes_at,active,note")
        .order("weekday")
        .order("opens_at"),
      supabase
        .from("business_hour_exceptions")
        .select(
          "id,channel_slug,service_date,closed,opens_at,closes_at,message",
        )
        .gte("service_date", today)
        .order("service_date")
        .limit(60),
      supabase
        .from("promotions")
        .select("id,title,body,starts_at,ends_at,active")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notification_campaigns")
        .select("id,title,body,topic,channels,status,scheduled_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("commercial_products").select("base_price").eq("slug", "torta-g").single(),
      supabase.from("order_sauces").select("id,name,active,sort_order").order("sort_order").order("name"),
    ]);
    const error =
      flavorResult.error ||
      imageResult.error ||
      availabilityResult.error ||
      batchResult.error ||
      channelResult.error ||
      hourResult.error ||
      exceptionResult.error ||
      promoResult.error ||
      campaignResult.error ||
      cakePriceResult.error ||
      sauceResult.error;
    setBusy(false);
    if (error) return setNotice(error.message);
    setCakeGPrice(Number(cakePriceResult.data.base_price));
    setFlavors(
      [...((flavorResult.data || []) as Flavor[])].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      ),
    );
    setImages((imageResult.data || []) as FlavorImage[]);
    if (canSeeCosts) {
      const costResult = await requireSupabase().from("flavor_costs").select("flavor_id,unit_cost");
      setCosts(Object.fromEntries(((costResult.data || []) as Array<{ flavor_id: string; unit_cost: number }>).map((row) => [row.flavor_id, Number(row.unit_cost)])));
    }
    setAvailability((availabilityResult.data || []) as Availability[]);
    setAvailabilityBatches((batchResult.data || []) as AdminAvailabilityBatch[]);
    setChannels((channelResult.data || []) as Channel[]);
    setSauces((sauceResult.data || []) as OrderSauceRow[]);
    setHours((hourResult.data || []) as BusinessHour[]);
    setExceptions((exceptionResult.data || []) as BusinessHourException[]);
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    // "Disponibilidade de hoje" so buscava uma vez, ao abrir a aba. Depois
    // de uma venda ser paga a quantidade muda no banco, mas quem ja estava
    // com a tela aberta continuava vendo o numero antigo ate recarregar na
    // mao. Reescuta mudanca em tempo real e busca tudo de novo, com um
    // pequeno atraso pra nao disparar uma rajada de buscas.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => { void load(); }, 1500);
    };
    const channel = requireSupabase()
      .channel("operation-content-admin-availability")
      .on("postgres_changes", { event: "*", schema: "public", table: "flavor_availability", filter: `service_date=eq.${selectedDate}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "flavor_availability_batches", filter: `service_date=eq.${selectedDate}` }, scheduleReload)
      .subscribe();
    return () => {
      if (timeout) clearTimeout(timeout);
      requireSupabase().removeChannel(channel);
    };
  }, [load, selectedDate]);

  const loadWeekOverview = useCallback(async () => {
    const weekEnd = shiftDate(weekAnchor, 6);
    const { data, error } = await requireSupabase()
      .from("flavor_availability_batches")
      .select("flavor_id,service_date,quantity_available,quantity_reserved")
      .eq("active", true)
      .gte("service_date", weekAnchor)
      .lte("service_date", weekEnd);
    if (error) return;
    setWeekBatches((data || []) as WeekBatchRow[]);
  }, [weekAnchor]);

  useEffect(() => {
    void loadWeekOverview();
  }, [loadWeekOverview]);

  const weekOverviewRows = useMemo(() => {
    const byFlavor = new Map<string, Map<string, number>>();
    for (const batch of weekBatches) {
      const free = Math.max(batch.quantity_available - batch.quantity_reserved, 0);
      if (!byFlavor.has(batch.flavor_id)) byFlavor.set(batch.flavor_id, new Map());
      const perDay = byFlavor.get(batch.flavor_id)!;
      perDay.set(batch.service_date, (perDay.get(batch.service_date) || 0) + free);
    }
    return Array.from(byFlavor.entries())
      .map(([flavorId, perDay]) => ({
        flavor: flavors.find((candidate) => candidate.id === flavorId),
        flavorId,
        perDay,
      }))
      .filter((row) => row.flavor)
      .sort((a, b) => a.flavor!.name.localeCompare(b.flavor!.name, "pt-BR"));
  }, [weekBatches, flavors]);

  const clearWeek = async () => {
    const confirmed = await confirmAction(
      `Remover todos os lotes de disponibilidade de ${new Date(weekAnchor + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(shiftDate(weekAnchor, 6) + "T12:00:00").toLocaleDateString("pt-BR")}? Lotes com fatias já reservadas por clientes não são removidos.`,
      { title: "Limpar semana inteira", confirmLabel: "Remover semana", destructive: true },
    );
    if (!confirmed) return;
    setClearingWeek(true);
    const { data, error } = await requireSupabase().rpc("manager_clear_availability_week", {
      start_date: weekAnchor,
      end_date: shiftDate(weekAnchor, 6),
    });
    setClearingWeek(false);
    if (error) return setNotice(error.message);
    const result = data as { removed_count: number; removal_blocked_count: number };
    setNotice(
      `${result.removed_count} lote(s) removido(s) da semana${result.removal_blocked_count ? `, ${result.removal_blocked_count} não removido(s) por já ter fatia reservada` : ""}.`,
    );
    await Promise.all([load(), loadWeekOverview()]);
  };

  const saveFlavor = async () => {
    if (draft.name.trim().length < 2)
      return setNotice("Informe o nome do produto.");
    const consultationOnly = isPriceOnRequest(draft.name);
    if (cakeGPrice == null || cakeGPrice <= 0)
      return setNotice("Não foi possível carregar o preço oficial da torta G.");
    if (!consultationOnly && draft.whole_cake_available && !editing?.whole_cake_image_path)
      return setNotice(
        "Salve o produto, adicione a foto da torta inteira G em Fotos e depois marque esta opção.",
      );
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      short_name: (draft.short_name.trim() || draft.name.trim().split(/\s+/).slice(0, 3).join(" ")).slice(0, 40),
      category: draft.category,
      short_description: draft.short_description.trim() || null,
      description: draft.description.trim() || null,
      ingredients: draft.ingredients.trim() || null,
      base_price: consultationOnly ? null : Number(draft.base_price.replace(",", ".")) || null,
      whole_cake_available: consultationOnly ? false : draft.whole_cake_available,
      active: draft.active,
    };
    const query = editing
      ? requireSupabase().from("flavors").update(payload).eq("id", editing.id).select("id").single()
      : requireSupabase().from("flavors").insert(payload).select("id").single();
    const { data: savedFlavor, error } = await query;
    if (!error && canSeeCosts && savedFlavor?.id) {
      const costValue = draft.unit_cost.trim() ? Number(draft.unit_cost.replace(/\./g, "").replace(",", ".")) : null;
      const costResult = await requireSupabase().rpc("manager_set_flavor_cost", { target_flavor_id: savedFlavor.id, requested_unit_cost: costValue != null && Number.isFinite(costValue) ? costValue : null });
      if (costResult.error) { setBusy(false); return setNotice(`Produto salvo, mas o custo não foi gravado: ${costResult.error.message}`); }
    }
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(
      editing
        ? "Produto atualizado com segurança."
        : "Produto criado. Agora você pode adicionar as fotos.",
    );
    setEditing(null);
    setCreatingFlavor(false);
    setDraft({ ...emptyFlavor });
    await load();
  };

  const editFlavor = (flavor: Flavor) => {
    setEditing(flavor);
    setDraft({
      name: flavor.name,
      short_name: flavor.short_name || flavor.name.split(/\s+/).slice(0, 3).join(" "),
      category: flavor.category,
      short_description: flavor.short_description || "",
      description: flavor.description || "",
      ingredients: flavor.ingredients || "",
      base_price: flavor.base_price?.toFixed(2) || "",
      unit_cost: costs[flavor.id] == null ? "" : costs[flavor.id].toFixed(2).replace(".", ","),
      whole_cake_available: flavor.whole_cake_available,
      active: flavor.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseImage = (flavor: Flavor, file: File, role: PendingFlavorImage["role"]) => {
    const isWholeCake = role === "whole_cake";
    const current = images.filter(
      (item) => item.flavor_id === flavor.id && item.active,
    );
    if (!isWholeCake && current.length >= PRODUCT_IMAGE_LIMIT)
      return setNotice(
        `Cada produto pode ter até ${PRODUCT_IMAGE_LIMIT} fotos.`,
      );
    const validation = validateProductImage(file);
    if (validation) return setNotice(validation);
    setPendingImage({ flavor, file, role });
  };

  const fetchImageAsFile = async (url: string, filename: string): Promise<File> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Não foi possível carregar a foto para editar.");
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  };

  const editGalleryImage = async (image: FlavorImage) => {
    if (!galleryFlavor) return;
    setBusy(true);
    try {
      const sourceUrl = image.original_image_path || image.image_path;
      const file = await fetchImageAsFile(sourceUrl, `foto-${image.id}.jpg`);
      setPendingImage({
        flavor: galleryFlavor,
        file,
        role: image.image_role === "cover" ? "cover" : "gallery",
        mediaId: image.id,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a foto para edição.");
    } finally {
      setBusy(false);
    }
  };

  const editWholeCakeImage = async (flavor: Flavor) => {
    if (!flavor.whole_cake_image_path) return;
    setBusy(true);
    try {
      const sourceUrl = flavor.whole_cake_original_image_path || flavor.whole_cake_image_path;
      const file = await fetchImageAsFile(sourceUrl, `torta-g-${flavor.id}.jpg`);
      setPendingImage({ flavor, file, role: "whole_cake" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a foto para edição.");
    } finally {
      setBusy(false);
    }
  };

  const removeWholeCakeImage = async (flavor: Flavor) => {
    if (
      !(await confirmAction(
        "Remover a foto da torta inteira G? O produto fica sem essa foto até você enviar outra.",
        { destructive: true, confirmLabel: "Remover" },
      ))
    )
      return;
    const { error } = await requireSupabase().rpc("manager_clear_dynamic_image_asset", {
      requested_asset_kind: "whole-cake",
      requested_owner_id: flavor.id,
    });
    if (error) return setNotice(error.message);
    setNotice("Foto da torta inteira G removida.");
    await load();
  };

  const applyFlavorImage = async (edited: EditedProductImage) => {
    if (!pendingImage) return;
    const { flavor, file, role, mediaId } = pendingImage;
    const isWholeCake = role === "whole_cake";
    const current = images.filter(
      (item) => item.flavor_id === flavor.id && item.active,
    );
    setBusy(true);
    try {
      const supabase = requireSupabase();
      const uploaded = await uploadEditedProductImage(
        supabase,
        `produtos/${flavor.id}`,
        `${isWholeCake ? "torta-g-" : ""}${file.name}`,
        edited,
      );
      if (isWholeCake) {
        const { error: wholeCakeError } = await supabase.rpc(
          "manager_save_dynamic_image_asset",
          {
            requested_asset_kind: "whole-cake",
            requested_owner_id: flavor.id,
            requested_image_url: uploaded.imageUrl,
            requested_original_image_url: uploaded.originalImageUrl,
            requested_alt_text: `Torta inteira G ${flavor.name}`,
          },
        );
        if (wholeCakeError) throw wholeCakeError;
        setPendingImage(null);
        setNotice("Foto da torta inteira G adicionada ao produto.");
        await load();
        return;
      }
      const altText = `${flavor.name} — foto ${role === "cover" ? "principal" : "da galeria"}`;
      const { error: imageError } = await supabase.rpc(
        "manager_save_gallery_media_asset",
        {
          requested_owner_kind: "flavor-gallery",
          requested_owner_id: flavor.id,
          requested_image_url: uploaded.imageUrl,
          requested_original_image_url: uploaded.originalImageUrl,
          requested_media_id: mediaId || null,
          requested_alt_text: altText,
          requested_caption: "",
          requested_role: role,
          requested_sort_order: null,
        },
      );
      if (imageError) throw imageError;
      if (role === "cover") {
        const { error: coverError } = await supabase.rpc(
          "manager_save_dynamic_image_asset",
          {
            requested_asset_kind: "flavor-cover",
            requested_owner_id: flavor.id,
            requested_image_url: uploaded.imageUrl,
            requested_original_image_url: uploaded.originalImageUrl,
            requested_alt_text: altText,
          },
        );
        if (coverError) throw coverError;
      }
      setPendingImage(null);
      setNotice("Foto editada, otimizada e adicionada ao produto.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar a foto.";
      setNotice(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async (image: FlavorImage) => {
    if (!await confirmAction("Remover esta foto da apresentação do produto?", { destructive: true, confirmLabel: "Remover" }))
      return;
    const { error } = await requireSupabase().rpc(
      "manager_disable_gallery_media",
      {
        requested_owner_kind: "flavor-gallery",
        requested_owner_id: image.flavor_id,
        requested_media_id: image.id,
      },
    );
    if (error) return setNotice(error.message);
    setNotice("Foto removida da apresentação.");
    await load();
  };

  const setTodayStatus = async (flavor: Flavor, status: AvailabilityStatus) => {
    setBusy(true);
    const { error } = await requireSupabase()
      .from("flavor_availability")
      .upsert(
        {
          flavor_id: flavor.id,
          service_date: selectedDate,
          status,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "flavor_id,service_date" },
      );
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`${flavor.name}: ${availabilityLabels[status]}.`);
    await load();
    await loadWeekOverview();
  };

  // O campo de horário de um lote existente precisa ser controlado pelo
  // React (não "defaultValue" solto): em alguns aparelhos/navegadores o
  // seletor nativo de <input type="time"> não confirma o dígito recém
  // digitado a tempo do clique em Salvar, e o FormData acaba enviando o
  // valor antigo -- o operador via o aviso de sucesso, mas com o horário
  // de antes. Mantendo o valor em estado garante que o que está na tela é
  // sempre exatamente o que é salvo.
  const existingBatchDraft = (batch: AdminAvailabilityBatch) =>
    existingBatchDrafts[batch.id] ?? {
      time: normalizeTime(batch.available_from),
      quantity: String(batch.quantity_available),
    };

  const saveAvailabilityBatch = async (
    flavor: Flavor,
    batch: AdminAvailabilityBatch | null,
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    // Mesmo default exibido no campo (currentLocalTime()) quando o campo de
    // novo lote nunca foi tocado -- sem isso, clicar "Adicionar lote" sem
    // mexer no horário rejeitava com "informe o horário" apesar de um
    // horário já estar visível na tela.
    const draft = batch
      ? existingBatchDraft(batch)
      : { time: batchDrafts[flavor.id]?.time ?? currentLocalTime(), quantity: batchDrafts[flavor.id]?.quantity ?? "" };
    const availableFrom = String(draft.time || "");
    const quantity = Number(draft.quantity);
    if (!/^\d{2}:\d{2}$/.test(availableFrom)) {
      return setNotice("Informe o horário em que o lote ficará pronto.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      return setNotice("Informe uma quantidade inteira entre 1 e 9.999 fatias.");
    }
    setBusy(true);
    const { error } = await requireSupabase().rpc(
      "staff_upsert_flavor_availability_batch",
      {
        target_batch_id: batch?.id || null,
        target_flavor_id: flavor.id,
        target_service_date: selectedDate,
        target_available_from: availableFrom,
        target_quantity_available: quantity,
      },
    );
    setBusy(false);
    if (error) return setNotice(error.message);
    if (batch) {
      setExistingBatchDrafts((current) => {
        const next = { ...current };
        delete next[batch.id];
        return next;
      });
    }
    setBatchDrafts((current) => ({
      ...current,
      [flavor.id]: { time: currentLocalTime(), quantity: "" },
    }));
    setNotice(
      `${flavor.name}: ${quantity} ${quantity === 1 ? "fatia" : "fatias"} a partir das ${availableFrom.replace(":00", "h")}.`,
    );
    await load();
    await loadWeekOverview();
  };

  const deleteAvailabilityBatch = async (
    flavor: Flavor,
    batch: AdminAvailabilityBatch,
    force = false,
  ) => {
    setBusy(true);
    const { data, error } = await requireSupabase().rpc(
      "staff_delete_flavor_availability_batch",
      { target_batch_id: batch.id, force },
    );
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = data as { deleted: boolean; affected_orders: AffectedBatchOrder[] };
    // Nunca bloqueia: sem confirmação ainda, só mostra quem seria afetado.
    if (!result.deleted) {
      setBatchDeletionConfirm({ flavor, batch, affectedOrders: result.affected_orders || [] });
      return;
    }
    setBatchDeletionConfirm(null);
    setNotice(
      result.affected_orders?.length
        ? `${flavor.name}: lote das ${normalizeTime(batch.available_from)} removido. ${result.affected_orders.length} pedido(s) ficaram com reserva deste lote — confira.`
        : `${flavor.name}: lote das ${normalizeTime(batch.available_from)} removido.`,
    );
    await load();
    await loadWeekOverview();
  };

  const saveChannel = async (channel: Channel) => {
    const { error } = await requireSupabase()
      .from("store_channels")
      .update({
        status: channel.status,
        message: channel.message?.trim() || null,
        next_change_at: channel.next_change_at || null,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", channel.slug);
    if (error) return setNotice(error.message);
    setNotice(`${channel.label} atualizado.`);
    await load();
  };

  const toggleSauce = async (sauce: OrderSauceRow) => {
    setSauceBusy(sauce.id);
    const { error } = await requireSupabase()
      .from("order_sauces")
      .update({ active: !sauce.active })
      .eq("id", sauce.id);
    setSauceBusy(null);
    if (error) return setNotice(error.message);
    setSauces((current) => current.map((item) => (item.id === sauce.id ? { ...item, active: !sauce.active } : item)));
    setNotice(`${sauce.name}: ${!sauce.active ? "ligada" : "desligada"} para os clientes.`);
  };

  const saveHour = async () => {
    if (hourDraft.opens_at >= hourDraft.closes_at) {
      return setNotice("O horário de encerramento precisa ser depois do horário de início.");
    }
    const payload = {
      ...hourDraft,
      note: hourDraft.note.trim() || null,
      active: true,
    };
    const query = editingHourId
      ? requireSupabase()
          .from("business_hours")
          .update(payload)
          .eq("id", editingHourId)
      : requireSupabase()
          .from("business_hours")
          .upsert(payload, {
            onConflict: "channel_slug,weekday,opens_at",
          });
    const { error } = await query;
    if (error) return setNotice(error.message);
    setNotice(
      `${channels.find((channel) => channel.slug === hourDraft.channel_slug)?.label || hourDraft.channel_slug}: horário de ${week[hourDraft.weekday]} ${editingHourId ? "atualizado" : "salvo"}.`,
    );
    setEditingHourId(null);
    await load();
  };

  const editHour = (hour: BusinessHour) => {
    setEditingHourId(hour.id);
    setHourDraft({
      channel_slug: hour.channel_slug,
      weekday: hour.weekday,
      opens_at: hour.opens_at.slice(0, 5),
      closes_at: hour.closes_at.slice(0, 5),
      note: hour.note || "",
    });
  };

  const cancelHourEdit = () => {
    setEditingHourId(null);
    setHourDraft((current) => ({
      ...current,
      weekday: 1,
      opens_at: "09:00",
      closes_at: "18:00",
      note: "",
    }));
  };

  const removeHour = async (id: string) => {
    if (!await confirmAction("Remover este horário recorrente?", { destructive: true, confirmLabel: "Remover" })) return;
    const { error } = await requireSupabase()
      .from("business_hours")
      .delete()
      .eq("id", id);
    if (error) return setNotice(error.message);
    await load();
  };

  const saveException = async () => {
    const { error } = await requireSupabase()
      .from("business_hour_exceptions")
      .upsert(
        {
          channel_slug: exceptionDraft.channel_slug,
          service_date: exceptionDraft.service_date,
          closed: exceptionDraft.closed,
          opens_at: exceptionDraft.closed ? null : exceptionDraft.opens_at,
          closes_at: exceptionDraft.closed ? null : exceptionDraft.closes_at,
          message: exceptionDraft.note.trim() || null,
        },
        { onConflict: "channel_slug,service_date" },
      );
    if (error) return setNotice(error.message);
    await load();
    setNotice("Exceção de funcionamento salva.");
  };

  const removeException = async (id: string) => {
    if (!await confirmAction("Remover esta exceção de funcionamento?", { destructive: true, confirmLabel: "Remover" })) return;
    const { error } = await requireSupabase()
      .from("business_hour_exceptions")
      .delete()
      .eq("id", id);
    if (error) return setNotice(error.message);
    await load();
    setNotice("Exceção removida.");
  };

  const gallery = useMemo(
    () => images.filter((item) => item.flavor_id === galleryFlavor?.id),
    [images, galleryFlavor],
  );

  return (
    <div className="content-admin">
      {tab === "operation" ? <div className="operation-title content-admin-title">
        <div>
          <span>Configurações</span>
          <h1>Funcionamento</h1>
          <p>Horários e modalidades de atendimento.</p>
        </div>
        <a
          className="content-preview"
          href="/cardapio"
          target="_blank"
          rel="noreferrer"
        >
          <Eye /> Ver como cliente
        </a>
      </div> : null}
      <nav className="content-tabs" aria-label="Áreas da administração">
        {allowedTabs.includes("catalog") ? <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          <PackageOpen /> Produtos
        </button> : null}
        {allowedTabs.includes("today") ? <button
          className={tab === "today" ? "active" : ""}
          onClick={() => setTab("today")}
        >
          <Check /> Produção de hoje
        </button> : null}
        {allowedTabs.includes("operation") ? <button
          className={tab === "operation" ? "active" : ""}
          onClick={() => setTab("operation")}
        >
          <Store /> Funcionamento
        </button> : null}
        {tab === "catalog" && !productFormOpen ? (
          <button
            type="button"
            className="admin-primary content-tabs-new-flavor"
            onClick={() => {
              setEditing(null);
              setDraft({ ...emptyFlavor });
              setCreatingFlavor(true);
            }}
          >
            <Plus /> Novo sabor
          </button>
        ) : null}
      </nav>

      {tab === "catalog" && (
        <>
          {productFormOpen ? <section className="admin-panel editor-panel" ref={editorPanelRef}>
            <div className="panel-heading">
              <div>
                <small>{editing ? "Editando produto" : "Novo produto"}</small>
                <h2>{editing?.name || "Cadastrar sabor"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar formulário"
                onClick={() => {
                  setEditing(null);
                  setCreatingFlavor(false);
                  setDraft({ ...emptyFlavor });
                }}
              >
                <X />
              </button>
            </div>
            <div className="admin-form-grid">
              <label>
                Nome principal <span>{draft.name.length}/80</span>
                <input
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Nome curto no caixa <span>{draft.short_name.length}/40</span>
                <input
                  maxLength={40}
                  value={draft.short_name}
                  placeholder="Sugestão automática pelas primeiras palavras"
                  onChange={(e) => setDraft({ ...draft, short_name: e.target.value })}
                />
                <small>Você pode editar este nome a qualquer momento.</small>
              </label>
              <label>
                Categoria
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as "traditional" | "premium",
                    })
                  }
                >
                  <option value="traditional">Tradicional</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              {isPriceOnRequest(draft.name) ? <p>Fatia e tortas P, M e G: valor a consultar.</p> : <>
                <label>
                  Preço da fatia
                  <input
                    inputMode="decimal"
                    value={draft.base_price}
                    onChange={(e) =>
                      setDraft({ ...draft, base_price: e.target.value })
                    }
                  />
                </label>
                <p>Preço oficial da torta G para todos os demais sabores: {cakeGPrice == null ? "carregando…" : cakeGPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </>}
              {canSeeCosts ? <label>Custo da fatia (só a gerência vê)<input inputMode="decimal" value={draft.unit_cost} onChange={(e) => setDraft({ ...draft, unit_cost: e.target.value })} /></label> : null}
              {canSeeCosts && editing ? (
                <div className="calculated-cost-preview">
                  <strong>Custo calculado pela ficha técnica</strong>
                  <p>
                    Fatia: {calculatedCosts?.slice?.unit_cost != null ? formatCurrency(calculatedCosts.slice.unit_cost) : "—"}
                    {calculatedCosts?.slice?.source === "recipe" ? " (da ficha técnica)" : calculatedCosts?.slice?.source === "manual_flavor_costs" ? " (valor manual acima)" : ""}
                    {(() => {
                      const price = Number(draft.base_price.replace(",", "."));
                      const cost = calculatedCosts?.slice?.unit_cost;
                      if (!price || cost == null) return null;
                      const margin = price - cost;
                      const marginPercent = (margin / price) * 100;
                      return <> · Margem: {formatCurrency(margin)} ({marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</>;
                    })()}
                  </p>
                  <p>
                    Torta G: {calculatedCosts?.sizes?.G?.whole_cost != null ? formatCurrency(calculatedCosts.sizes.G.whole_cost) : "—"}
                    {" · "}Torta M: {calculatedCosts?.sizes?.M?.whole_cost != null ? formatCurrency(calculatedCosts.sizes.M.whole_cost) : "—"}
                    {" · "}Torta P: {calculatedCosts?.sizes?.P?.whole_cost != null ? formatCurrency(calculatedCosts.sizes.P.whole_cost) : "—"}
                  </p>
                  <small>Custos em branco: ainda não há ficha técnica cadastrada para esse tamanho.</small>
                </div>
              ) : null}
              <label className="wide">
                Chamada curta <span>{draft.short_description.length}/90</span>
                <input
                  maxLength={90}
                  value={draft.short_description}
                  onChange={(e) =>
                    setDraft({ ...draft, short_description: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Descrição <span>{draft.description.length}/300</span>
                <textarea
                  maxLength={300}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Ingredientes e observações{" "}
                <span>{draft.ingredients.length}/400</span>
                <textarea
                  maxLength={400}
                  value={draft.ingredients}
                  onChange={(e) =>
                    setDraft({ ...draft, ingredients: e.target.value })
                  }
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />{" "}
                Exibir no catálogo
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={draft.whole_cake_available}
                  disabled={isPriceOnRequest(draft.name)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      whole_cake_available: e.target.checked,
                    })
                  }
                />{" "}
                Oferecer como torta inteira G
              </label>
            </div>
            <button
              className="admin-primary"
              onClick={() => void saveFlavor()}
              disabled={busy}
            >
              <Save /> {editing ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </section> : null}
          <p className="admin-list-count" role="status">
            {flavors.length} sabores
          </p>
          <div className="admin-product-grid">
            {flavors.map((flavor) => (
              <article
                key={flavor.id}
                className={!flavor.active ? "inactive" : ""}
              >
                <div className="product-thumb">
                  {flavor.image_path ? (
                    <img src={flavor.image_path} alt={flavor.name} />
                  ) : (
                    <ImagePlus />
                  )}
                </div>
                <h3>{flavor.name}</h3>
                <p>
                  {flavor.short_description ||
                    "Descrição curta ainda não informada."}
                </p>
                <div className="product-actions">
                  <button onClick={() => editFlavor(flavor)}>
                    <Pencil /> Editar
                  </button>
                  <button onClick={() => setGalleryFlavor(flavor)}>
                    <ImagePlus /> Fotos (
                    {images.filter((i) => i.flavor_id === flavor.id).length})
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "today" && (
        <section className="admin-panel admin-panel-today-compact">
          <div className="panel-heading availability-heading-compact">
            <h2>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                "pt-BR",
                { weekday: "long", day: "2-digit", month: "2-digit" },
              )}
            </h2>
            <div className="availability-date-picker">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
                aria-label="Dia anterior"
              >
                ←
              </button>
              <label>
                <span className="sr-only">Escolher dia</span>
                <input
                  type="date"
                  value={selectedDate}
                  disabled={busy}
                  onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelectedDate(shiftDay(selectedDate, 1))}
                aria-label="Próximo dia"
              >
                →
              </button>
              {selectedDate !== todayInFortaleza() ? (
                <button type="button" disabled={busy} onClick={() => setSelectedDate(todayInFortaleza())}>
                  Hoje
                </button>
              ) : null}
            </div>
          </div>
          <details className="admin-panel availability-week-overview">
            <summary>
              Ver semana inteira ({weekOverviewRows.length ? `${weekOverviewRows.length} sabor(es) com lote` : "nenhum lote"})
            </summary>
            <div className="availability-week-table-scroll">
              <table className="availability-week-table">
                <thead>
                  <tr>
                    <th>Sabor</th>
                    {weekDays.map((day) => (
                      <th key={day}>
                        <button
                          type="button"
                          className={day === selectedDate ? "active" : ""}
                          onClick={() => setSelectedDate(day)}
                        >
                          {week[new Date(day + "T12:00:00").getDay()]}
                          <small>
                            {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </small>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekOverviewRows.map((row) => (
                    <tr key={row.flavorId}>
                      <td>{row.flavor!.name}</td>
                      {weekDays.map((day) => (
                        <td key={day}>{row.perDay.get(day) ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                  {!weekOverviewRows.length ? (
                    <tr>
                      <td colSpan={weekDays.length + 1}>Nenhum sabor com lote nesta semana.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {weekOverviewRows.length ? (
              <button
                type="button"
                className="availability-clear-week"
                disabled={clearingWeek}
                onClick={() => void clearWeek()}
              >
                <Trash2 /> {clearingWeek ? "Removendo…" : "Limpar semana inteira"}
              </button>
            ) : null}
          </details>
          {selectedDate === todayInFortaleza() ? <ProductionReleasePanel today={todayInFortaleza()} onReleased={load} /> : null}
          {canSeeCosts && selectedDate === todayInFortaleza() ? <ShoppingBatchSuggestions today={todayInFortaleza()} onImported={load} /> : null}
          <p className="availability-summary" role="status">
            {availability.filter((item) => item.status !== "unavailable").length} liberado(s) para venda · {availability.filter((item) => item.status === "unavailable").length} indisponível(is)
          </p>
          <div className="availability-filter" role="group" aria-label="Filtrar itens por situação do estoque">
            <button type="button" className={availabilityFilter === "all" ? "active" : ""} onClick={() => setAvailabilityFilter("all")}>Todos os itens</button>
            <button type="button" className={availabilityFilter === "low" ? "active warning" : ""} onClick={() => setAvailabilityFilter("low")}>{lowStockFlavorIds.size} com estoque baixo</button>
            <button type="button" className={availabilityFilter === "unlisted" ? "active" : ""} onClick={() => setAvailabilityFilter("unlisted")}>{unlistedTodayFlavors.length} sem lote hoje</button>
          </div>
          {availabilityFilter === "low" ? <p className="availability-filter-notice" role="status">Exibindo somente itens disponíveis com até 3 unidades livres.</p> : null}
          {availabilityFilter === "unlisted" ? <p className="availability-filter-notice" role="status">Sabores do catálogo que ainda não têm nenhuma disponibilidade lançada hoje. Escolha uma situação pra incluir um deles na lista acima.</p> : null}
          {availabilityFilter === "unlisted" ? (
            <div className="availability-list">
              {unlistedTodayFlavors.map((flavor) => (
                <article key={flavor.id}>
                  <span className="availability-dot unavailable" />
                  <div>
                    <strong>{flavor.name}</strong>
                    <small>Sem disponibilidade lançada hoje</small>
                  </div>
                  <select
                    aria-label={`Incluir ${flavor.name} hoje`}
                    value=""
                    onChange={(e) => {
                      const status = e.target.value as AvailabilityStatus;
                      if (status) void setTodayStatus(flavor, status).then(() => setAvailabilityFilter("all"));
                    }}
                    disabled={busy}
                  >
                    <option value="" disabled>Incluir como…</option>
                    {Object.entries(availabilityLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </article>
              ))}
              {!unlistedTodayFlavors.length ? <div className="availability-filter-empty"><Check /><strong>Todo o catálogo já tem disponibilidade lançada hoje.</strong></div> : null}
            </div>
          ) : (
          <div className="availability-list">
            {visibleAvailabilityFlavors.map((flavor) => {
                const current =
                  availability.find((item) => item.flavor_id === flavor.id)
                    ?.status || "unavailable";
                const inventory = availability.find(
                  (item) => item.flavor_id === flavor.id,
                );
                return (
                  <article key={flavor.id}>
                    <span className={`availability-dot ${current}`} />
                    <div>
                      <strong>{flavor.name}</strong>
                      <small>
                        {inventory?.quantity_available !== null && inventory?.quantity_available !== undefined
                          ? `${Math.max(inventory.quantity_available - (inventory.quantity_reserved || 0), 0)} livre(s) · ${inventory.quantity_reserved || 0} reservada(s)`
                          : "Sem quantidade lançada"}
                      </small>
                    </div>
                    <select
                      aria-label={`Situação de ${flavor.name} hoje`}
                      value={current}
                      onChange={(e) =>
                        void setTodayStatus(
                          flavor,
                          e.target.value as AvailabilityStatus,
                        )
                      }
                      disabled={busy}
                    >
                      {Object.entries(availabilityLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <details className="availability-batches">
                      <summary>
                        Lotes por horário ({availabilityBatches.filter((batch) => batch.flavor_id === flavor.id).length})
                      </summary>
                      {availabilityBatches
                        .filter((batch) => batch.flavor_id === flavor.id)
                        .map((batch) => (
                          <form
                            className="availability-batch-row"
                            key={batch.id}
                            onSubmit={(event) => void saveAvailabilityBatch(flavor, batch, event)}
                          >
                            <label>
                              <span>Disponível a partir</span>
                              <input
                                name="available_from"
                                type="time"
                                value={existingBatchDraft(batch).time}
                                onChange={(event) => setExistingBatchDrafts((current) => ({
                                  ...current,
                                  [batch.id]: { ...existingBatchDraft(batch), time: event.target.value },
                                }))}
                                disabled={busy}
                                required
                              />
                            </label>
                            <label>
                              <span>Quantidade</span>
                              <input
                                name="quantity_available"
                                type="number"
                                min="1"
                                max="9999"
                                step="1"
                                value={existingBatchDraft(batch).quantity}
                                onChange={(event) => setExistingBatchDrafts((current) => ({
                                  ...current,
                                  [batch.id]: { ...existingBatchDraft(batch), quantity: event.target.value },
                                }))}
                                disabled={busy}
                                required
                              />
                            </label>
                            <small>{batch.quantity_reserved || 0} reservada(s)</small>
                            <button type="submit" disabled={busy} aria-label={`Salvar lote de ${flavor.name}`}><Save /></button>
                            <button type="button" disabled={busy} onClick={() => void deleteAvailabilityBatch(flavor, batch)} aria-label={`Excluir lote de ${flavor.name}`}><Trash2 /></button>
                          </form>
                        ))}
                      <form
                        className="availability-batch-row is-new"
                        onSubmit={(event) => void saveAvailabilityBatch(flavor, null, event)}
                      >
                        <label>
                          <span>Novo horário</span>
                          <input
                            name="available_from"
                            type="time"
                            value={batchDrafts[flavor.id]?.time ?? currentLocalTime()}
                            onChange={(event) => setBatchDrafts((current) => ({ ...current, [flavor.id]: { time: event.target.value, quantity: current[flavor.id]?.quantity ?? "" } }))}
                            disabled={busy}
                            required
                          />
                        </label>
                        <label>
                          <span>Quantidade</span>
                          <input
                            name="quantity_available"
                            type="number"
                            min="1"
                            max="9999"
                            step="1"
                            value={batchDrafts[flavor.id]?.quantity ?? ""}
                            onChange={(event) => setBatchDrafts((current) => ({ ...current, [flavor.id]: { time: current[flavor.id]?.time ?? currentLocalTime(), quantity: event.target.value } }))}
                            placeholder="Ex.: 8"
                            disabled={busy}
                            required
                          />
                        </label>
                        <button type="submit" disabled={busy}><Plus /> Adicionar lote</button>
                      </form>
                      {inventory?.quantity_available !== null && inventory?.quantity_available !== undefined ? (
                        <small className="availability-batch-total">
                          Total: {Math.max(inventory.quantity_available - (inventory.quantity_reserved || 0), 0)} livre(s) · {inventory.quantity_reserved || 0} reservada(s)
                        </small>
                      ) : null}
                    </details>
                  </article>
                );
              })}
            {availabilityFilter === "low" && !visibleAvailabilityFlavors.length ? <div className="availability-filter-empty"><Check /><strong>Nenhum item com estoque baixo.</strong><small>Todos os itens controlados têm mais de 3 unidades livres.</small></div> : null}
          </div>
          )}
        </section>
      )}

      {tab === "operation" && (
        <>
          <div className="channel-grid">
            {channels.map((channel, index) => (
              <article className="admin-panel" key={channel.slug}>
                <Store />
                <h3>{channel.label}</h3>
                <label>
                  Funcionamento
                  <select
                    value={channel.status === "paused" ? "paused" : "scheduled"}
                    onChange={(e) =>
                      setChannels(
                        channels.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                status:
                                  e.target.value === "paused"
                                    ? "paused"
                                    : "closed",
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="scheduled">Seguir horários cadastrados</option>
                    <option value="paused">Pausar excepcionalmente</option>
                  </select>
                </label>
                <small>
                  Os horários abaixo determinam automaticamente quando aparece
                  aberto ou fechado.
                </small>
                <label>
                  Mensagem para o cliente
                  <input
                    maxLength={160}
                    value={channel.message || ""}
                    onChange={(e) =>
                      setChannels(
                        channels.map((item, i) =>
                          i === index
                            ? { ...item, message: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  className="admin-primary"
                  onClick={() => void saveChannel(channel)}
                >
                  <Save /> Atualizar
                </button>
              </article>
            ))}
          </div>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Caldas</small>
                <h2>Caldas disponíveis para o pedido</h2>
                <p>
                  Desligue uma calda pra ela parar de aparecer na hora de montar
                  o pedido -- sem precisar apagar nada. Qualquer calda nova
                  cadastrada aparece aqui automaticamente.
                </p>
              </div>
            </div>
            <div className="sauce-toggle-grid">
              {sauces.map((sauce) => (
                <button
                  key={sauce.id}
                  type="button"
                  className={sauce.active ? "sauce-toggle is-on" : "sauce-toggle is-off"}
                  onClick={() => void toggleSauce(sauce)}
                  disabled={sauceBusy === sauce.id}
                >
                  {sauce.name} <span>{sauce.active ? "Ligada" : "Desligada"}</span>
                </button>
              ))}
              {!sauces.length ? <p>Nenhuma calda cadastrada ainda.</p> : null}
            </div>
          </section>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Horários automáticos</small>
                <h2>Horários recorrentes</h2>
                <p>
                  Escolha o tipo de atendimento para ver todos os dias e horários
                  cadastrados. Edite ou exclua cada faixa quando precisar.
                </p>
              </div>
            </div>
            <div className="hour-form">
              <select
                value={hourDraft.channel_slug}
                onChange={(e) => {
                  setEditingHourId(null);
                  setHourDraft({ ...hourDraft, channel_slug: e.target.value });
                }}
              >
                {channels.filter((channel) => channel.slug !== "store").map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {scheduleChannelLabels[c.slug] || c.label}
                  </option>
                ))}
              </select>
              <select
                value={hourDraft.weekday}
                onChange={(e) =>
                  setHourDraft({
                    ...hourDraft,
                    weekday: Number(e.target.value),
                  })
                }
              >
                {week.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={hourDraft.opens_at}
                onChange={(e) =>
                  setHourDraft({ ...hourDraft, opens_at: e.target.value })
                }
              />
              <input
                type="time"
                value={hourDraft.closes_at}
                onChange={(e) =>
                  setHourDraft({ ...hourDraft, closes_at: e.target.value })
                }
              />
              <button className="admin-primary" onClick={() => void saveHour()}>
                {editingHourId ? <Save /> : <Plus />}{" "}
                {editingHourId ? "Atualizar horário" : "Adicionar horário"}
              </button>
              {editingHourId ? (
                <button type="button" onClick={cancelHourEdit}>
                  Cancelar edição
                </button>
              ) : null}
            </div>
            <div className="hour-scope-summary" aria-live="polite">
              <strong>
                {scheduleChannelLabels[hourDraft.channel_slug] ||
                  channels.find((channel) => channel.slug === hourDraft.channel_slug)
                    ?.label || hourDraft.channel_slug}
              </strong>
              <small>{scheduleChannelHints[hourDraft.channel_slug]}</small>
            </div>
            <div className="hour-list">
              {filterBusinessHours(hours, hourDraft.channel_slug)
                .map((hour) => (
                <article key={hour.id}>
                  <Clock3 />
                  <span>
                    <strong>
                      {week[hour.weekday]} ·{" "}
                      {channels.find((c) => c.slug === hour.channel_slug)
                        ?.label || hour.channel_slug}
                    </strong>
                    <small>
                      {hour.opens_at.slice(0, 5)} às{" "}
                      {hour.closes_at.slice(0, 5)}
                    </small>
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => editHour(hour)}
                    aria-label={`Editar horário de ${week[hour.weekday]}`}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="icon-button danger"
                    onClick={() => void removeHour(hour.id)}
                  >
                    <Trash2 />
                  </button>
                </article>
                ))}
              {filterBusinessHours(hours, hourDraft.channel_slug).length === 0 ? (
                <p className="hour-empty-state">
                  Nenhum dia ou horário cadastrado para este atendimento. Ele
                  aparecerá como fechado até que uma faixa seja adicionada.
                </p>
              ) : null}
            </div>
          </section>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Feriados e datas especiais</small>
                <h2>Exceções da agenda</h2>
                <p>
                  Esta configuração prevalece sobre o horário recorrente na data
                  escolhida.
                </p>
              </div>
            </div>
            <div className="exception-form">
              <select
                value={exceptionDraft.channel_slug}
                onChange={(e) =>
                  setExceptionDraft({
                    ...exceptionDraft,
                    channel_slug: e.target.value,
                  })
                }
              >
                {channels.filter((channel) => channel.slug !== "store").map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {scheduleChannelLabels[c.slug] || c.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={exceptionDraft.service_date}
                onChange={(e) =>
                  setExceptionDraft({
                    ...exceptionDraft,
                    service_date: e.target.value,
                  })
                }
              />
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={exceptionDraft.closed}
                  onChange={(e) =>
                    setExceptionDraft({
                      ...exceptionDraft,
                      closed: e.target.checked,
                    })
                  }
                />{" "}
                Fechado nesta data
              </label>
              {!exceptionDraft.closed && (
                <>
                  <input
                    type="time"
                    value={exceptionDraft.opens_at}
                    onChange={(e) =>
                      setExceptionDraft({
                        ...exceptionDraft,
                        opens_at: e.target.value,
                      })
                    }
                  />
                  <input
                    type="time"
                    value={exceptionDraft.closes_at}
                    onChange={(e) =>
                      setExceptionDraft({
                        ...exceptionDraft,
                        closes_at: e.target.value,
                      })
                    }
                  />
                </>
              )}
              <input
                maxLength={160}
                placeholder="Observação para o cliente"
                value={exceptionDraft.note}
                onChange={(e) =>
                  setExceptionDraft({ ...exceptionDraft, note: e.target.value })
                }
              />
              <button
                className="admin-primary"
                onClick={() => void saveException()}
              >
                <Save /> Salvar exceção
              </button>
            </div>
            <div className="hour-list">
              {exceptions.map((item) => (
                <article key={item.id}>
                  <Clock3 />
                  <span>
                    <strong>
                      {new Date(
                        item.service_date + "T12:00:00",
                      ).toLocaleDateString("pt-BR")}{" "}
                      ·{" "}
                      {channels.find((c) => c.slug === item.channel_slug)
                        ?.label || item.channel_slug}
                    </strong>
                    <small>
                      {item.closed
                        ? "Fechado"
                        : `${item.opens_at?.slice(0, 5)} às ${item.closes_at?.slice(0, 5)}`}{" "}
                      {item.message ? `· ${item.message}` : ""}
                    </small>
                  </span>
                  <button
                    className="icon-button danger"
                    onClick={() => void removeException(item.id)}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {galleryFlavor && (
        <div
          className="operation-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Fotos do produto"
        >
          <div className="gallery-modal">
            <button
              className="modal-close"
              onClick={() => setGalleryFlavor(null)}
            >
              <X />
            </button>
            <small>Galeria do produto</small>
            <h2>{galleryFlavor.name}</h2>
            <p>
              Até {PRODUCT_IMAGE_LIMIT} fotos. Antes de salvar, você escolhe o
              corte, o enquadramento e melhora a luz sem deformar a imagem.
            </p>
            <div className="gallery-grid">
              {gallery.map((image) => (
                <figure key={image.id}>
                  <button
                    type="button"
                    className="gallery-image-edit-trigger"
                    onClick={() => void editGalleryImage(image)}
                    aria-label="Editar esta foto"
                    title="Clique para editar (cortar, enquadrar, melhorar a luz)"
                  >
                    <img src={image.image_path} alt={image.alt_text} />
                  </button>
                  <figcaption>
                    {image.image_role === "cover" ? "Principal" : "Galeria"}
                    <a
                      href={image.original_image_path || image.image_path}
                      target="_blank"
                      rel="noreferrer"
                      download
                      title="Baixar foto original"
                      aria-label="Baixar foto original"
                    >
                      <Download />
                    </a>
                    <button onClick={() => void removeImage(image)}>
                      <Trash2 />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="upload-row">
              <div className="image-source-group">
                <strong>Foto principal</strong>
                <label className="admin-primary">
                  <ImagePlus /> Escolher foto
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) chooseImage(galleryFlavor, file, "cover");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <ClipboardImageInput onError={setNotice} onImage={(file) => chooseImage(galleryFlavor, file, "cover")} />
              </div>
              <div className="image-source-group">
                <strong>Foto da galeria</strong>
                <label className="admin-secondary">
                  <Plus /> Escolher foto
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) chooseImage(galleryFlavor, file, "gallery");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <ClipboardImageInput onError={setNotice} onImage={(file) => chooseImage(galleryFlavor, file, "gallery")} />
              </div>
              <div className="image-source-group">
                <strong>Torta inteira G</strong>
                <label className="admin-secondary">
                  <ImagePlus /> Escolher foto
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) chooseImage(galleryFlavor, file, "whole_cake");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <ClipboardImageInput onError={setNotice} onImage={(file) => chooseImage(galleryFlavor, file, "whole_cake")} />
              </div>
            </div>
            {galleryFlavor.whole_cake_image_path && (
              <figure className="whole-cake-preview">
                <button
                  type="button"
                  className="gallery-image-edit-trigger"
                  onClick={() => void editWholeCakeImage(galleryFlavor)}
                  aria-label="Editar foto da torta inteira G"
                  title="Clique para editar (cortar, enquadrar, melhorar a luz)"
                >
                  <img
                    src={galleryFlavor.whole_cake_image_path}
                    alt={`Torta inteira G ${galleryFlavor.name}`}
                  />
                </button>
                <figcaption>
                  Foto exclusiva da torta inteira G
                  <a
                    href={galleryFlavor.whole_cake_original_image_path || galleryFlavor.whole_cake_image_path}
                    target="_blank"
                    rel="noreferrer"
                    download
                    title="Baixar foto original"
                    aria-label="Baixar foto original"
                  >
                    <Download />
                  </a>
                  <button onClick={() => void removeWholeCakeImage(galleryFlavor)} title="Excluir foto da torta inteira G" aria-label="Excluir foto da torta inteira G">
                    <Trash2 />
                  </button>
                </figcaption>
              </figure>
            )}
          </div>
        </div>
      )}
      {batchDeletionConfirm && (
        <div className="operation-modal" role="dialog" aria-modal="true" aria-label="Excluir lote com reserva">
          <div className="gallery-modal">
            <button className="modal-close" onClick={() => setBatchDeletionConfirm(null)}>
              <X />
            </button>
            <small>Excluir lote com fatia reservada</small>
            <h2>
              {batchDeletionConfirm.flavor.name} · {normalizeTime(batchDeletionConfirm.batch.available_from)}
            </h2>
            {batchDeletionConfirm.affectedOrders.length ? (
              <>
                <p>
                  Este lote tem {batchDeletionConfirm.affectedOrders.length} pedido(s) com fatia reservada. A exclusão é aceita
                  mesmo assim — nada nos pedidos é alterado automaticamente. Resolva cada um manualmente.
                </p>
                <div className="availability-list">
                  {batchDeletionConfirm.affectedOrders.map((order) => (
                    <article key={order.order_id}>
                      <div>
                        <strong>Pedido {order.order_number}</strong>
                        <small>
                          {order.customer_name || "Cliente sem nome"} · {order.quantity} fatia(s)
                          {order.sales_channel && order.sales_channel !== "operation" ? " · pedido online" : ""}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="admin-secondary"
                        onClick={() => {
                          setBatchDeletionConfirm(null);
                          openOperationArea({ view: "orders", orderId: order.order_id });
                        }}
                      >
                        Abrir pedido
                      </button>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>Este lote não tem mais fatias reservadas no momento. Pode excluir.</p>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button type="button" className="admin-secondary" onClick={() => setBatchDeletionConfirm(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="availability-clear-week"
                disabled={busy}
                onClick={() => void deleteAvailabilityBatch(batchDeletionConfirm.flavor, batchDeletionConfirm.batch, true)}
              >
                <Trash2 /> Excluir mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingImage && (
        <ImageEditor
          file={pendingImage.file}
          title={`${pendingImage.role === "whole_cake" ? "Torta inteira G" : pendingImage.role === "cover" ? "Foto principal" : "Foto da galeria"} — ${pendingImage.flavor.name}`}
          preset={PRODUCT_IMAGE_PRESET}
          onCancel={() => setPendingImage(null)}
          onApply={applyFlavorImage}
        />
      )}
      {notice && (
        <div className="operation-toast">
          <Check /> {notice}
          <button onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      )}
      {busy && <div className="admin-busy">Salvando com segurança...</div>}
    </div>
  );
}
