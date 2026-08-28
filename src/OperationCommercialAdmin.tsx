import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { operationWhatsAppUrl } from "./operation-whatsapp";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Edit3,
  ImagePlus,
  MessageCircle,
  MessageSquareWarning,
  NotebookPen,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShoppingCart,
  Trash2,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { formatarDataHora, formatarDataHoraCurta } from "./lib/datas";
import { formatarTelefoneBR, nomeCompletoValido, nomeLegivel } from "./lib/contato";
import "./operation-print.css";
import { printOperation } from "./lib/operation-print";
import {
  uploadEditedProductImage,
  type EditedProductImage,
} from "./admin-media";
import ImageEditor, {
  CATEGORY_IMAGE_PRESET,
  PRODUCT_IMAGE_PRESET,
  type ImageEditorPreset,
} from "./ImageEditor";
import ClipboardImageInput from "./ClipboardImageInput";
import CommercialMediaAdmin from "./CommercialMediaAdmin";
import { normalizeInstagramUrl, type CommercialMediaItem } from "./commercial-media";
import OperationPedeJunto from "./OperationPedeJunto";
import OperationInstantOrders from "./OperationInstantOrders";
import OperationFinance from "./OperationFinance";
import OperationCommerceSettings from "./OperationCommerceSettings";
import MetaCatalogAdmin from "./MetaCatalogAdmin";
import {
  CommercialEventSubcategory,
  CommercialProduct,
  CommercialProductOption,
  CommercialSegment,
  PreorderBusinessHour,
  PreorderBusinessHourException,
  eventSubcategoryLabels,
  money,
  normalizeBrazilianPhone,
  segmentLabels,
  validatePreorderWindow,
} from "./commercial";
import "./operation-commercial.css";
import "./operation-product-options.css";
import "./operation-media-editor.css";

type AdminTab = "agenda" | "sales" | "requests" | "pede_junto" | "catalog" | "crm" | "feedback" | "finance" | "settings";
const tabPresentation: Record<AdminTab, { eyebrow: string; title: string; description: string }> = {
  agenda: { eyebrow: "Encomendas & agenda", title: "Agenda operacional", description: "Compromissos, retiradas, produção e bloqueios de horário em uma visão única." },
  sales: { eyebrow: "Vendas de fatias", title: "Caixa e pedidos", description: "Lance vendas, acompanhe pagamentos, separação, retirada e baixa de estoque." },
  requests: { eyebrow: "Encomendas", title: "Pedidos e pré-reservas", description: "Acompanhe cada solicitação desde o primeiro contato até a entrega." },
  pede_junto: { eyebrow: "Venda compartilhada", title: "Pede Junto Adoce", description: "Grupos, participantes, pagamentos individuais e entrega do pedido." },
  catalog: { eyebrow: "Produtos", title: "Catálogo comercial", description: "Produtos, opções, preços, fotos e informações apresentadas aos clientes." },
  crm: { eyebrow: "Relacionamento", title: "Clientes de encomendas", description: "Histórico, anotações e próximos contatos ligados às solicitações." },
  feedback: { eyebrow: "Experiência do cliente", title: "Reclamações e sugestões", description: "Registre, acompanhe e resolva cada retorno recebido pelo site." },
  finance: { eyebrow: "Gestão financeira", title: "Vendas e recebimentos", description: "Compare faturamento, taxas e valor líquido por período e pagamento." },
  settings: { eyebrow: "Administração", title: "Configurações comerciais", description: "Defina prazos, regras de reserva, pagamentos e taxas da operação." },
};
type RequestStatus =
  | "prebooked"
  | "quoted"
  | "awaiting_deposit"
  | "confirmed"
  | "in_production"
  | "ready"
  | "completed"
  | "cancelled"
  | "expired";
type RequestFilter = "active" | "attention" | "confirmed" | "completed" | "cancelled" | "all";

import RequestQuoteDocument, { parsePreferences } from "./RequestQuoteDocument";
import FichaTermica from "./FichaTermica";

type ServiceRequest = {
  id: string;
  request_number: string;
  profile_id: string | null;
  product_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  quantity: number;
  desired_start: string;
  desired_end: string;
  service_location: string;
  selections: { preferences?: string };
  customer_notes: string;
  internal_notes: string;
  status: RequestStatus;
  source: string;
  quoted_total: number | null;
  deposit_amount: number | null;
  expires_at: string | null;
  created_at: string;
  commercial_products: Pick<CommercialProduct, "name" | "segment" | "resource_key"> | null;
};

type CalendarBlock = {
  id: string;
  title: string;
  block_kind: string;
  status: string;
  starts_at: string;
  ends_at: string;
  resource_key: string | null;
  notes: string;
};

type CrmNote = {
  id: string;
  service_request_id: string | null;
  note: string;
  visibility: string;
  created_at: string;
};

type CrmTask = {
  id: string;
  service_request_id: string | null;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
};

type RequestHistory = {
  id: number;
  entity_id: string | null;
  payload: { status?: RequestStatus; from_status?: RequestStatus; request_number?: string };
  created_at: string;
};

type SiteAnalyticsEvent = {
  event_name: string;
  page_path: string;
  occurred_at: string;
};

type CommercialSegmentMedia = {
  id: string;
  segment: CommercialSegment;
  image_url: string;
  original_image_url: string | null;
  alt_text: string;
};

type PendingCommercialImage = {
  file: File;
  title: string;
  preset: ImageEditorPreset;
  kind: "gallery" | "product" | "segment";
  segment?: CommercialSegment;
  productId?: string;
  mediaItemId?: string;
};

type SiteFeedback = {
  id: string;
  protocol: string;
  category: "problem" | "complaint" | "suggestion" | "compliment";
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  page_url: string | null;
  message: string;
  status: "new" | "reviewing" | "resolved" | "closed";
  internal_notes: string;
  created_at: string;
};

export const statuses: Record<RequestStatus, string> = {
  prebooked: "Pré-reserva",
  quoted: "Orçamento enviado",
  awaiting_deposit: "Aguardando sinal",
  confirmed: "Confirmado",
  in_production: "Em produção",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export const requestTransitions: Record<RequestStatus, RequestStatus[]> = {
  prebooked: ["quoted"],
  quoted: ["awaiting_deposit"],
  awaiting_deposit: ["confirmed"],
  confirmed: ["in_production"],
  in_production: ["ready"],
  ready: ["completed"],
  completed: [],
  cancelled: ["prebooked"],
  expired: ["prebooked"],
};

export const requestFilterMatches = (status: RequestStatus, filter: RequestFilter) => {
  if (filter === "all") return true;
  if (filter === "active") return !["completed", "cancelled", "expired"].includes(status);
  if (filter === "attention") return ["prebooked", "quoted", "awaiting_deposit"].includes(status);
  if (filter === "confirmed") return ["confirmed", "in_production", "ready"].includes(status);
  if (filter === "completed") return status === "completed";
  return ["cancelled", "expired"].includes(status);
};

export const requestIsPastDue = (request: Pick<ServiceRequest, "status" | "expires_at">, reference = Date.now()) =>
  Boolean(
    request.expires_at
      && !["confirmed", "in_production", "ready", "completed", "cancelled", "expired"].includes(request.status)
      && new Date(request.expires_at).getTime() < reference,
  );

const transitionLabels: Partial<Record<RequestStatus, string>> = {
  quoted: "Marcar orçamento como enviado",
  awaiting_deposit: "Aguardar sinal",
  confirmed: "Confirmar pedido",
  in_production: "Iniciar produção",
  ready: "Marcar como pronto",
  completed: "Concluir atendimento",
  prebooked: "Reabrir como pré-reserva",
};

const sourceLabels: Record<string, string> = {
  website: "Site",
  operation: "Operação",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  phone: "Telefone",
  walk_in: "Atendimento presencial",
};

const toLocalInput = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));

const slugify = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const newProduct = (): CommercialProduct => ({
  id: "",
  slug: "",
  segment: "cakes",
  subcategory: null,
  name: "",
  short_description: "",
  description: "",
  base_price: null,
  price_suffix: "",
  minimum_quantity: 1,
  lead_business_days: 3,
  requires_schedule: true,
  resource_key: null,
  details: {},
  image_url: null,
  original_image_url: null,
  allergens: [],
  show_allergens: false,
  published: false,
  active: true,
  sort_order: 100,
  meta_retailer_id: "",
  meta_product_id: null,
  exibir_whatsapp: false,
  meta_sync_status: "disabled",
  meta_last_sync_at: null,
  meta_last_error: null,
  meta_last_error_temporary: null,
  meta_sync_attempts: 0,
  meta_payload_hash: null,
  meta_batch_handle: null,
});

export default function OperationCommercialAdmin({
  session,
  role,
  initialTab = "agenda",
  onTabChange,
  onOpenContent,
}: {
  session: Session;
  role: string;
  initialTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  onOpenContent?: () => void;
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const presentation = tabPresentation[tab];
  const changeTab = (next: AdminTab) => {
    setTab(next);
    onTabChange?.(next);
  };
  useEffect(() => setTab(initialTab), [initialTab]);
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [productOptions, setProductOptions] = useState<CommercialProductOption[]>([]);
  const [segmentMedia, setSegmentMedia] = useState<CommercialSegmentMedia[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<CommercialMediaItem[]>([]);
  const [pendingImage, setPendingImage] = useState<PendingCommercialImage | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [preorderHours, setPreorderHours] = useState<PreorderBusinessHour[]>([]);
  const [preorderExceptions, setPreorderExceptions] = useState<PreorderBusinessHourException[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [requestHistory, setRequestHistory] = useState<RequestHistory[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<SiteAnalyticsEvent[]>([]);
  const [feedback, setFeedback] = useState<SiteFeedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<SiteFeedback | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CommercialProduct | null>(null);
  const [optionForm, setOptionForm] = useState({ group: "recheio", label: "", adjustment: 0 });
  const [filter, setFilter] = useState("");
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("active");
  const [recentWebsiteRequestsOnly, setRecentWebsiteRequestsOnly] = useState(false);
  const [showManualRequest, setShowManualRequest] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockForm, setBlockForm] = useState({
    title: "",
    start: toLocalInput(),
    end: toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    kind: "internal",
    resource: "",
    notes: "",
  });
  const [manualRequest, setManualRequest] = useState({
    productId: "",
    name: "",
    phone: "",
    start: toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    notes: "",
  });
  const [crmText, setCrmText] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const canManage = role === "owner" || role === "manager";
  const requestsSectionRef = useRef<HTMLElement | null>(null);

  const openRequest = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setSelectedBlock(null);
    setShowCancellation(false);
    setCancellationReason("");
    setCancellationError("");
  };

  const closeRequest = () => {
    setSelectedRequest(null);
    setShowCancellation(false);
    setCancellationReason("");
    setCancellationError("");
  };

  const load = useCallback(async () => {
    setBusy(true);
    setNotice("");
    const supabase = requireSupabase();
    const [productResult, optionResult, mediaResult, galleryResult, requestResult, blockResult, noteResult, taskResult, feedbackResult, historyResult, analyticsResult, hoursResult, exceptionsResult] = await Promise.all([
      supabase.from("commercial_products").select("*").order("sort_order"),
      supabase.from("commercial_product_options").select("*").order("sort_order"),
      supabase.from("commercial_segment_media").select("*").order("segment"),
      supabase.from("commercial_media_items").select("*").order("sort_order"),
      supabase
        .from("service_requests")
        .select("*,commercial_products(name,segment,resource_key)")
        .order("desired_start", { ascending: true })
        .limit(300),
      supabase.from("calendar_blocks").select("*").order("starts_at").limit(200),
      supabase.from("crm_notes").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("crm_tasks").select("*").order("due_at", { ascending: true }).limit(200),
      supabase.from("site_feedback").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("audit_events").select("id,entity_id,payload,created_at").eq("entity_type", "service_request").eq("action", "service_request_status_changed").order("created_at", { ascending: false }).limit(500),
      supabase.from("site_analytics_events").select("event_name,page_path,occurred_at").gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order("occurred_at", { ascending: false }).limit(5000),
      supabase.from("business_hours").select("channel_slug,weekday,opens_at,closes_at,active").eq("channel_slug", "preorders"),
      supabase.from("business_hour_exceptions").select("channel_slug,service_date,closed,opens_at,closes_at").eq("channel_slug", "preorders").gte("service_date", new Date().toISOString().slice(0, 10)),
    ]);
    const error = productResult.error || optionResult.error || requestResult.error || blockResult.error || noteResult.error || taskResult.error || feedbackResult.error;
    if (error) setNotice(error.message);
    else {
      setProducts((productResult.data || []) as CommercialProduct[]);
      setProductOptions((optionResult.data || []) as CommercialProductOption[]);
      if (!mediaResult.error) setSegmentMedia((mediaResult.data || []) as CommercialSegmentMedia[]);
      if (!galleryResult.error) setGalleryMedia((galleryResult.data || []) as CommercialMediaItem[]);
      setRequests((requestResult.data || []) as unknown as ServiceRequest[]);
      setBlocks((blockResult.data || []) as CalendarBlock[]);
      setNotes((noteResult.data || []) as CrmNote[]);
      setTasks((taskResult.data || []) as CrmTask[]);
      setFeedback((feedbackResult.data || []) as SiteFeedback[]);
      if (!historyResult.error) setRequestHistory((historyResult.data || []) as RequestHistory[]);
      if (!analyticsResult.error) setAnalyticsEvents((analyticsResult.data || []) as SiteAnalyticsEvent[]);
      if (!hoursResult.error) setPreorderHours((hoursResult.data || []) as PreorderBusinessHour[]);
      if (!exceptionsResult.error) setPreorderExceptions((exceptionsResult.data || []) as PreorderBusinessHourException[]);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedRequest && !selectedBlock) return;
    const closeDrawer = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedRequest(null);
      setSelectedBlock(null);
      setShowCancellation(false);
      setCancellationReason("");
    };
    window.addEventListener("keydown", closeDrawer);
    return () => window.removeEventListener("keydown", closeDrawer);
  }, [selectedBlock, selectedRequest]);

  const now = Date.now();
  const analyticsLast7Days = useMemo(
    () => analyticsEvents.filter((event) => new Date(event.occurred_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000),
    [analyticsEvents],
  );
  const recentWebsiteRequests = useMemo(
    () => requests.filter((request) => request.source === "website" && new Date(request.created_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000),
    [requests],
  );
  const activeRequests = useMemo(
    () =>
      requests.filter((request) =>
        ["prebooked", "quoted", "awaiting_deposit", "confirmed", "in_production", "ready"].includes(request.status),
      ),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    const clean = filter.trim().toLocaleLowerCase("pt-BR");
    return requests
      .filter((request) => requestFilterMatches(request.status, requestFilter))
      .filter((request) => !recentWebsiteRequestsOnly || recentWebsiteRequests.some((recentRequest) => recentRequest.id === request.id))
      .filter((request) => !clean || `${request.request_number} ${request.customer_name} ${request.customer_phone} ${request.commercial_products?.name || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(clean));
  }, [filter, recentWebsiteRequests, recentWebsiteRequestsOnly, requestFilter, requests]);

  const selectRequestFilter = (nextFilter: RequestFilter) => {
    setRecentWebsiteRequestsOnly(false);
    setRequestFilter(nextFilter);
  };

  const showRecentWebsiteRequests = () => {
    setFilter("");
    setRequestFilter("all");
    setRecentWebsiteRequestsOnly(true);
    changeTab("requests");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => requestsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  };

  const competingCount = (current: ServiceRequest) =>
    requests.filter(
      (request) =>
        request.id !== current.id &&
        ["prebooked", "quoted", "awaiting_deposit"].includes(request.status) &&
        new Date(request.desired_start) < new Date(current.desired_end) &&
        new Date(request.desired_end) > new Date(current.desired_start) &&
        (request.commercial_products?.resource_key || request.commercial_products?.segment) ===
          (current.commercial_products?.resource_key || current.commercial_products?.segment),
    ).length;

  const updateRequest = async (request: ServiceRequest, status: RequestStatus) => {
    const confirmation = status === "confirmed"
      ? `Confirmar ${request.request_number}? O sinal de 50% deve ter sido recebido.`
      : `Alterar ${request.request_number} para “${statuses[status]}”?`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_update_service_request", {
      target_request_id: request.id,
      next_status: status,
      next_total: request.quoted_total,
      next_deposit: request.deposit_amount,
      next_internal_notes: request.internal_notes,
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(`${request.request_number} atualizado para ${statuses[status]}.`);
      setSelectedRequest(null);
      await load();
    }
  };

  const createBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (new Date(blockForm.end) <= new Date(blockForm.start)) {
      setNotice("O horário final precisa ser posterior ao início.");
      return;
    }
    setBusy(true);
    const { error } = await requireSupabase().from("calendar_blocks").insert({
      title: blockForm.title.trim(),
      block_kind: blockForm.kind,
      status: "confirmed",
      starts_at: new Date(blockForm.start).toISOString(),
      ends_at: new Date(blockForm.end).toISOString(),
      resource_key: blockForm.resource.trim() || null,
      notes: blockForm.notes.trim(),
      created_by: session.user.id,
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setBlockForm({ ...blockForm, title: "", notes: "" });
      setNotice("Bloqueio adicionado à agenda.");
      await load();
    }
  };

  const createManualRequest = async (event: FormEvent) => {
    event.preventDefault();
    const product = products.find((item) => item.id === manualRequest.productId);
    if (!product) return;
    const phone = normalizeBrazilianPhone(manualRequest.phone);
    if (!/^55\d{10,11}$/.test(phone)) return setNotice("Informe um WhatsApp válido com DDD.");
    if (!nomeCompletoValido(manualRequest.name)) return setNotice("Informe nome e sobrenome separados por espaço.");
    const start = new Date(manualRequest.start);
    if (start.getTime() <= Date.now()) return setNotice("Escolha uma data e um horário futuros.");
    const scheduleError = validatePreorderWindow(manualRequest.start.slice(0, 10), manualRequest.start.slice(11, 16), preorderHours, preorderExceptions);
    if (scheduleError) return setNotice(scheduleError);
    setBusy(true);
    const { error } = await requireSupabase().from("service_requests").insert({
      request_number: "",
      product_id: product.id,
      customer_name: manualRequest.name.trim(),
      customer_phone: `+${phone}`,
      quantity: product.minimum_quantity,
      desired_start: start.toISOString(),
      desired_end: new Date(start.getTime() + (product.segment === "rentals" ? 48 : 2) * 60 * 60 * 1000).toISOString(),
      customer_notes: manualRequest.notes.trim(),
      status: "prebooked",
      source: "operation",
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      created_by: session.user.id,
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setManualRequest({ ...manualRequest, name: "", phone: "", notes: "" });
      setShowManualRequest(false);
      setNotice("Solicitação inserida manualmente como pré-reserva.");
      await load();
    }
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;
    setBusy(true);
    const payload = {
        slug: selectedProduct.slug.trim() || slugify(selectedProduct.name),
        segment: selectedProduct.segment,
        subcategory: selectedProduct.segment === "events"
          ? selectedProduct.subcategory || "trays"
          : null,
        name: selectedProduct.name.trim(),
        short_description: selectedProduct.short_description.trim(),
        description: selectedProduct.description.trim(),
        base_price: selectedProduct.base_price,
        price_suffix: selectedProduct.price_suffix,
        minimum_quantity: selectedProduct.minimum_quantity,
        lead_business_days: selectedProduct.lead_business_days,
        requires_schedule: selectedProduct.requires_schedule,
        resource_key: selectedProduct.resource_key,
        details: selectedProduct.details,
        image_url: selectedProduct.image_url?.trim() || null,
        original_image_url: selectedProduct.original_image_url?.trim() || null,
        sort_order: selectedProduct.sort_order,
        published: selectedProduct.published,
        active: selectedProduct.active,
        exibir_whatsapp: selectedProduct.exibir_whatsapp,
        updated_by: session.user.id,
      };
    const query = selectedProduct.id
      ? requireSupabase().from("commercial_products").update(payload).eq("id", selectedProduct.id)
      : requireSupabase().from("commercial_products").insert({ ...payload, created_by: session.user.id });
    const { data: savedProduct, error } = await query.select("id").single();
    let syncWarning = "";
    if (!error && savedProduct && selectedProduct.exibir_whatsapp) {
      try {
        const response = await fetch(`/api/admin/integrations/meta/catalog/products/${savedProduct.id}/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) syncWarning = ` O cadastro local foi preservado; sincronização pendente: ${body.error || `HTTP ${response.status}`}`;
      } catch {
        syncWarning = " O cadastro local foi preservado; a sincronização será reprocessada depois.";
      }
    }
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(`${selectedProduct.id ? "Produto atualizado no catálogo." : "Novo produto criado no catálogo."}${syncWarning}`);
      setSelectedProduct(null);
      await load();
    }
  };

  const syncMetaProduct = async (product: CommercialProduct) => {
    if (!product.id) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/integrations/meta/catalog/products/${product.id}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      });
      const body = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(body.error || `Falha HTTP ${response.status}.`);
      setNotice(body.status === "synced" ? "Produto confirmado no catálogo da Meta." : "Produto enviado para processamento pela Meta.");
      const { data } = await requireSupabase().from("commercial_products").select("*").eq("id", product.id).maybeSingle();
      if (data) setSelectedProduct(data as CommercialProduct);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A sincronização não foi concluída.");
    } finally {
      setBusy(false);
    }
  };

  const applyCommercialImage = async (edited: EditedProductImage) => {
    if (!pendingImage) return;
    setBusy(true);
    setNotice("");
    try {
      const supabase = requireSupabase();
      if (pendingImage.kind === "gallery") {
        const ownerKey = pendingImage.productId || pendingImage.segment;
        if (!ownerKey) throw new Error("A galeria da foto não foi identificada.");
        const uploaded = await uploadEditedProductImage(supabase, `commercial/galleries/${ownerKey}`, pendingImage.file.name, edited);
        const ownerItems = galleryMedia.filter((item) => pendingImage.productId
          ? item.product_id === pendingImage.productId
          : item.segment === pendingImage.segment);
        const mediaPayload = {
          segment: pendingImage.segment || null,
          product_id: pendingImage.productId || null,
          media_type: "image",
          image_url: uploaded.imageUrl,
          original_image_url: uploaded.originalImageUrl,
          alt_text: pendingImage.productId ? `Foto real de ${selectedProduct?.name || "produto Adoce"}` : `Foto real de ${segmentLabels[pendingImage.segment!]}`,
          updated_by: session.user.id,
        } as const;
        const galleryQuery = pendingImage.mediaItemId
          ? supabase.from("commercial_media_items").update(mediaPayload).eq("id", pendingImage.mediaItemId)
          : supabase.from("commercial_media_items").insert({
              ...mediaPayload,
              sort_order: ownerItems.length ? Math.max(...ownerItems.map((item) => item.sort_order)) + 10 : 10,
              created_by: session.user.id,
            });
        const { error: galleryError } = await galleryQuery;
        if (galleryError) throw galleryError;
        setPendingImage(null);
        setNotice(pendingImage.mediaItemId ? "Foto substituída e reenquadrada na galeria." : "Foto adicionada à galeria.");
        await load();
        return;
      }
      if (pendingImage.kind === "product") {
        if (!selectedProduct) throw new Error("Abra novamente o produto antes de editar a foto.");
        const productKey = selectedProduct.id || selectedProduct.slug || slugify(selectedProduct.name) || "novo-produto";
        const uploaded = await uploadEditedProductImage(supabase, `commercial/products/${productKey}`, pendingImage.file.name, edited);
        setSelectedProduct((current) => current ? {
          ...current,
          image_url: uploaded.imageUrl,
          original_image_url: uploaded.originalImageUrl,
        } : current);
        setPendingImage(null);
        setNotice("Foto editada e preparada. Salve o produto para publicar a alteração.");
        return;
      }

      const segment = pendingImage.segment;
      if (!segment) throw new Error("A categoria da foto não foi identificada.");
      const uploaded = await uploadEditedProductImage(supabase, `commercial/segments/${segment}`, pendingImage.file.name, edited);
      const { error: mediaError } = await supabase.from("commercial_segment_media").upsert({
        segment,
        image_url: uploaded.imageUrl,
        original_image_url: uploaded.originalImageUrl,
        alt_text: `Foto real da categoria ${segmentLabels[segment]}`,
        updated_by: session.user.id,
      }, { onConflict: "segment" });
      if (mediaError) throw mediaError;
      setPendingImage(null);
      setNotice("Foto principal da categoria atualizada.");
      await load();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Não foi possível salvar a foto editada.";
      setNotice(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const galleryFor = (owner: { segment?: CommercialSegment; productId?: string }) => galleryMedia
    .filter((item) => item.active && (owner.productId ? item.product_id === owner.productId : item.segment === owner.segment))
    .sort((a, b) => a.sort_order - b.sort_order);

  const addInstagramMedia = async (owner: { segment?: CommercialSegment; productId?: string }, url: string, caption: string) => {
    const normalized = normalizeInstagramUrl(url);
    if (!normalized) { setNotice("Cole um link público válido de Reel ou publicação do Instagram."); return false; }
    setBusy(true);
    const items = galleryFor(owner);
    const { error } = await requireSupabase().from("commercial_media_items").insert({
      segment: owner.segment || null, product_id: owner.productId || null, media_type: "instagram",
      external_url: normalized, caption: caption.trim(), alt_text: caption.trim() || "Vídeo real da Adoce no Instagram",
      sort_order: items.length ? Math.max(...items.map((item) => item.sort_order)) + 10 : 10,
      created_by: session.user.id, updated_by: session.user.id,
    });
    setBusy(false);
    if (error) { setNotice(error.message); return false; }
    setNotice("Reel adicionado sem ocupar o armazenamento de vídeos.");
    await load();
    return true;
  };

  const moveGalleryMedia = async (owner: { segment?: CommercialSegment; productId?: string }, item: CommercialMediaItem, direction: -1 | 1) => {
    const items = galleryFor(owner); const index = items.findIndex((entry) => entry.id === item.id); const other = items[index + direction];
    if (!other) return;
    setBusy(true); const supabase = requireSupabase(); const temporary = -Math.abs(Date.now());
    const first = await supabase.from("commercial_media_items").update({ sort_order: temporary, updated_by: session.user.id }).eq("id", item.id);
    const second = first.error ? first : await supabase.from("commercial_media_items").update({ sort_order: item.sort_order, updated_by: session.user.id }).eq("id", other.id);
    const third = second.error ? second : await supabase.from("commercial_media_items").update({ sort_order: other.sort_order, updated_by: session.user.id }).eq("id", item.id);
    setBusy(false); if (third.error) setNotice(third.error.message); else await load();
  };

  const setGalleryCover = async (owner: { segment?: CommercialSegment; productId?: string }, item: CommercialMediaItem) => {
    const items = galleryFor(owner); if (items[0]?.id === item.id) return;
    setBusy(true);
    const { error } = await requireSupabase().from("commercial_media_items").update({ sort_order: Math.min(...items.map((entry) => entry.sort_order)) - 10, updated_by: session.user.id }).eq("id", item.id);
    setBusy(false); if (error) setNotice(error.message); else { setNotice("Capa da galeria atualizada."); await load(); }
  };

  const removeGalleryMedia = async (item: CommercialMediaItem) => {
    if (!window.confirm("Remover esta mídia da apresentação pública?")) return;
    setBusy(true);
    const { error } = await requireSupabase().from("commercial_media_items").update({ active: false, updated_by: session.user.id }).eq("id", item.id);
    setBusy(false); if (error) setNotice(error.message); else { setNotice("Mídia removida da apresentação."); await load(); }
  };

  const addProductOption = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProduct?.id || !optionForm.label.trim()) return;
    setBusy(true);
    const { error } = await requireSupabase().from("commercial_product_options").insert({
      product_id: selectedProduct.id,
      group_key: slugify(optionForm.group).replace(/-/g, "_") || "opcoes",
      label: optionForm.label.trim(),
      price_adjustment: optionForm.adjustment,
      active: true,
      sort_order: productOptions.filter((item) => item.product_id === selectedProduct.id).length * 10 + 10,
      created_by: session.user.id,
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setOptionForm({ ...optionForm, label: "", adjustment: 0 });
      setNotice("Opção adicionada ao produto.");
      await load();
    }
  };

  const updateProductOption = async (option: CommercialProductOption, changes: Partial<CommercialProductOption>) => {
    const { error } = await requireSupabase()
      .from("commercial_product_options")
      .update({ ...changes, updated_by: session.user.id })
      .eq("id", option.id);
    if (error) setNotice(error.message);
    else await load();
  };

  const addCrmNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequest || crmText.trim().length < 2) return;
    const { error } = await requireSupabase().from("crm_notes").insert({
      profile_id: selectedRequest.profile_id,
      service_request_id: selectedRequest.id,
      note: crmText.trim(),
      visibility: "team",
      created_by: session.user.id,
    });
    if (error) setNotice(error.message);
    else {
      setCrmText("");
      setNotice("Nota adicionada ao histórico do cliente.");
      await load();
    }
  };

  const addCrmTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequest || taskTitle.trim().length < 2) return;
    const { error } = await requireSupabase().from("crm_tasks").insert({
      profile_id: selectedRequest.profile_id,
      service_request_id: selectedRequest.id,
      title: taskTitle.trim(),
      due_at: new Date(taskDue).toISOString(),
      priority: "normal",
      status: "open",
      assigned_to: session.user.id,
      created_by: session.user.id,
    });
    if (error) setNotice(error.message);
    else {
      setTaskTitle("");
      setNotice("Lembrete criado para a equipe.");
      await load();
    }
  };

  const completeTask = async (task: CrmTask) => {
    const { error } = await requireSupabase()
      .from("crm_tasks")
      .update({ status: "done", completed_at: new Date().toISOString(), updated_by: session.user.id })
      .eq("id", task.id);
    if (error) setNotice(error.message);
    else await load();
  };

  const saveFeedback = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFeedback) return;
    setBusy(true);
    const { error } = await requireSupabase()
      .from("site_feedback")
      .update({
        status: selectedFeedback.status,
        internal_notes: selectedFeedback.internal_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedFeedback.id);
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(`${selectedFeedback.protocol} atualizado.`);
      await load();
    }
  };

  const saveRequestDetails = async (request: ServiceRequest) => {
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("manager_update_service_request", {
      target_request_id: request.id,
      next_status: request.status,
      next_total: request.quoted_total,
      next_deposit: request.deposit_amount,
      next_internal_notes: request.internal_notes,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const updated = { ...request, ...(data as Partial<ServiceRequest>) };
    setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelectedRequest(updated);
    setNotice(`${request.request_number}: valores e anotações salvos.`);
  };

  const cancelRequest = async (request: ServiceRequest) => {
    const reason = cancellationReason.trim();
    if (reason.length < 5) return;
    setCancellationError("");
    const timestamp = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Fortaleza",
    }).format(new Date());
    const internalNotes = [(request.internal_notes || "").trim(), `[Cancelamento em ${timestamp}] ${reason}`]
      .filter(Boolean)
      .join("\n\n");
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_update_service_request", {
      target_request_id: request.id,
      next_status: "cancelled",
      next_total: request.quoted_total,
      next_deposit: request.deposit_amount,
      next_internal_notes: internalNotes,
    });
    setBusy(false);
    if (error) {
      const message = `Não foi possível cancelar ${request.request_number}: ${error.message}`;
      setCancellationError(message);
      setNotice(message);
      return;
    }
    setRequests((current) => current.map((item) => item.id === request.id
      ? { ...item, status: "cancelled", internal_notes: internalNotes }
      : item));
    setCancellationReason("");
    setCancellationError("");
    setShowCancellation(false);
    setSelectedRequest(null);
    setRequestFilter("active");
    setNotice(`${request.request_number} foi cancelado e movido para Histórico.`);
    await load();
  };

  const cancelCalendarBlock = async (block: CalendarBlock) => {
    if (!window.confirm(`Cancelar “${block.title}” e retirá-lo da agenda ativa? O registro continuará no histórico.`)) return;
    setBusy(true);
    const { error } = await requireSupabase()
      .from("calendar_blocks")
      .update({ status: "cancelled", updated_by: session.user.id })
      .eq("id", block.id);
    setBusy(false);
    if (error) return setNotice(error.message);
    setSelectedBlock(null);
    setNotice(`“${block.title}” foi retirado da agenda ativa e preservado no histórico.`);
    await load();
  };

  return (
    <div className="operation-commercial">
      <div className="operation-title">
        <div>
          <span>{presentation.eyebrow}</span>
          <h1>{presentation.title}</h1>
          <p>{presentation.description}</p>
        </div>
        <button className="commercial-refresh" onClick={() => void load()} disabled={busy}>
          <RefreshCw /> Atualizar
        </button>
      </div>

      {(["agenda", "requests", "crm", "feedback"] as AdminTab[]).includes(tab) ? <div className="operation-commercial-metrics">
        <span><strong>{activeRequests.length}</strong><small>pedidos ativos</small></span>
        <span><strong>{requests.filter((item) => item.status === "prebooked").length}</strong><small>pré-reservas</small></span>
        <span><strong>{requests.filter((item) => item.status === "confirmed").length}</strong><small>confirmados</small></span>
        <span><strong>{tasks.filter((item) => item.status === "open" && item.due_at && new Date(item.due_at).getTime() <= now + 24 * 60 * 60 * 1000).length}</strong><small>lembretes em 24h</small></span>
      </div> : null}

      {canManage && (["agenda", "requests", "crm", "feedback"] as AdminTab[]).includes(tab) ? <section className="operation-analytics-summary" aria-label="Resultados do site nos últimos sete dias">
        <div><span>Últimos 7 dias</span><strong>Interesse no site</strong><small>Aberturas são anônimas. Solicitações recebidas têm contato e podem ser atendidas.</small></div>
        <span><strong>{analyticsLast7Days.filter((event) => event.event_name === "page_view").length}</strong><small>páginas vistas</small></span>
        <span><strong>{analyticsLast7Days.filter((event) => event.event_name === "whatsapp_click").length}</strong><small>cliques no WhatsApp</small></span>
        <span><strong>{analyticsLast7Days.filter((event) => event.event_name === "prebook_start").length}</strong><small>formulários abertos</small><em>Anônimo, não gera atendimento</em></span>
        <button type="button" onClick={showRecentWebsiteRequests}><strong>{recentWebsiteRequests.length}</strong><small>solicitações recebidas</small><em>Ver atendimentos <ArrowRight /></em></button>
      </section> : null}

      <nav className="operation-commercial-tabs">
        <div><small>Vendas</small><span>
          <button className={tab === "sales" ? "active" : ""} onClick={() => changeTab("sales")}><ShoppingCart /> Fatias</button>
          <button className={tab === "pede_junto" ? "active" : ""} onClick={() => changeTab("pede_junto")}><Users /> Pede Junto</button>
        </span></div>
        <div><small>Encomendas</small><span>
          <button className={tab === "agenda" ? "active" : ""} onClick={() => changeTab("agenda")}><CalendarDays /> Agenda</button>
          <button className={tab === "requests" ? "active" : ""} onClick={() => changeTab("requests")}><PackagePlus /> Pedidos</button>
        </span></div>
        <div><small>Relacionamento</small><span>
          <button className={tab === "crm" ? "active" : ""} onClick={() => changeTab("crm")}><Users /> Clientes</button>
          <button className={tab === "feedback" ? "active" : ""} onClick={() => changeTab("feedback")}><MessageSquareWarning /> Retornos</button>
        </span></div>
        <div><small>Gestão</small><span>
          <button className={tab === "catalog" ? "active" : ""} onClick={() => changeTab("catalog")}><Edit3 /> Produtos</button>
          <button className={tab === "finance" ? "active" : ""} onClick={() => changeTab("finance")}><CircleDollarSign /> Financeiro</button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => changeTab("settings")}><Settings2 /> Configurações</button>
        </span></div>
      </nav>

      {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}

      {tab === "agenda" ? (
        <div className="operation-commercial-grid">
          <section>
            <div className="operation-commercial-head"><div><small>Próximos compromissos</small><h2>Agenda operacional</h2></div></div>
            <div className="operation-agenda-list">
              {[...activeRequests.map((item) => ({
                id: item.id,
                title: `${item.request_number} · ${nomeLegivel(item.customer_name)}`,
                subtitle: item.commercial_products?.name || "Pedido",
                starts: item.desired_start,
                ordered: item.created_at,
                phone: item.customer_phone,
                status: item.status,
                warning: competingCount(item),
                request: item,
                block: null,
              })), ...blocks.filter((item) => item.status !== "cancelled").map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: "Bloqueio manual",
                starts: item.starts_at,
                ordered: null,
                phone: null,
                status: item.status,
                warning: 0,
                request: null,
                block: item,
              }))]
                .sort((a, b) => +new Date(a.starts) - +new Date(b.starts))
                .map((item) => (
                  <button key={`${item.request ? "r" : "b"}-${item.id}`} onClick={() => item.request ? openRequest(item.request) : item.block && setSelectedBlock(item.block)}>
                    <CalendarDays />
                    <span><strong>{item.title}</strong><small>{item.subtitle}</small><small>Retirada {formatarDataHoraCurta(item.starts)}</small>{item.ordered ? <small>pedido em {formatarDataHoraCurta(item.ordered)}</small> : null}{item.phone ? <a href={operationWhatsAppUrl(item.phone, "Olá! Estamos falando sobre sua encomenda na Adoce.")} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{formatarTelefoneBR(item.phone)}</a> : null}</span>
                    {item.warning ? <b><AlertTriangle /> {item.warning} concorrente(s)</b> : <em>{statuses[item.status as RequestStatus] || item.status}</em>}
                  </button>
                ))}
            </div>
          </section>
          <form className="operation-block-form" onSubmit={createBlock}>
            <small>Inserção direta</small><h2>Bloquear horário</h2>
            <label>Título<input required value={blockForm.title} onChange={(event) => setBlockForm({ ...blockForm, title: event.target.value })} /></label>
            <div><label>Início<input required type="datetime-local" value={blockForm.start} onChange={(event) => setBlockForm({ ...blockForm, start: event.target.value })} /></label><label>Fim<input required type="datetime-local" value={blockForm.end} onChange={(event) => setBlockForm({ ...blockForm, end: event.target.value })} /></label></div>
            <label>Tipo<select value={blockForm.kind} onChange={(event) => setBlockForm({ ...blockForm, kind: event.target.value })}><option value="internal">Compromisso interno</option><option value="event">Evento</option><option value="production">Produção</option><option value="pickup">Retirada</option><option value="closed">Fechado</option></select></label>
            <label>Recurso <small>(opcional)</small><input value={blockForm.resource} onChange={(event) => setBlockForm({ ...blockForm, resource: event.target.value })} placeholder="Ex.: equipe externa" /></label>
            <label>Observações<textarea value={blockForm.notes} onChange={(event) => setBlockForm({ ...blockForm, notes: event.target.value })} /></label>
            <button disabled={busy}><Plus /> Adicionar à agenda</button>
          </form>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="operation-commercial-grid">
          <section ref={requestsSectionRef}>
            <form className="operation-commercial-search" onSubmit={(event) => event.preventDefault()}><Search /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar número, cliente, telefone ou produto" /></form>
            {recentWebsiteRequestsOnly ? <div className="operation-request-context" role="status">
              <span><strong>Solicitações recebidas pelo site nos últimos 7 dias</strong><small>Inclui atendimentos ativos, concluídos, cancelados ou expirados.</small></span>
              <button type="button" onClick={() => selectRequestFilter("active")}>Voltar à fila ativa</button>
            </div> : null}
            <div className="operation-request-filters" role="group" aria-label="Filtrar pedidos por etapa">
              {([
                ["active", "Em andamento"],
                ["attention", "Precisam de retorno"],
                ["confirmed", "Confirmados"],
                ["completed", "Concluídos"],
                ["cancelled", "Cancelados ou expirados"],
                ["all", "Todos"],
              ] as [RequestFilter, string][]).map(([value, label]) => (
                <button type="button" key={value} className={!recentWebsiteRequestsOnly && requestFilter === value ? "active" : ""} onClick={() => selectRequestFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="operation-request-list">
              {filteredRequests.map((request) => (
                <button key={request.id} onClick={() => openRequest(request)}>
                  <span><small>{request.request_number}</small><strong>{request.customer_name}</strong><em>{request.commercial_products?.name}</em></span>
                  <span><strong>{dateTime(request.desired_start)}</strong><small>{request.customer_phone}</small></span>
                  <b className={`status-${request.status}${requestIsPastDue(request, now) ? " is-overdue" : ""}`}>{requestIsPastDue(request, now) ? "Prazo vencido" : statuses[request.status]}</b><ArrowRight />
                </button>
              ))}
              {!filteredRequests.length ? <div className="operation-empty compact"><Search /><p>Nenhum pedido encontrado neste filtro.</p></div> : null}
            </div>
          </section>
          <aside className="operation-manual-request">
            <small>Atendimento por telefone ou WhatsApp</small>
            <h2>Registrar uma nova solicitação</h2>
            <p>Use quando o pedido chegar fora do site. Ele entra na mesma fila e recebe número e prazo.</p>
            {!showManualRequest ? <button type="button" onClick={() => setShowManualRequest(true)}><Plus /> Nova solicitação</button> : (
              <form className="operation-block-form" onSubmit={createManualRequest}>
                <label>Produto<select required value={manualRequest.productId} onChange={(event) => setManualRequest({ ...manualRequest, productId: event.target.value })}><option value="">Selecione</option>{products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Cliente<input required value={manualRequest.name} onChange={(event) => setManualRequest({ ...manualRequest, name: event.target.value })} /></label>
                <label>WhatsApp com DDD<input required inputMode="tel" value={manualRequest.phone} onChange={(event) => setManualRequest({ ...manualRequest, phone: event.target.value })} /></label>
                <label>Data e hora<input required type="datetime-local" value={manualRequest.start} onChange={(event) => setManualRequest({ ...manualRequest, start: event.target.value })} /></label>
                <label>Detalhes<textarea value={manualRequest.notes} onChange={(event) => setManualRequest({ ...manualRequest, notes: event.target.value })} /></label>
                <div className="operation-form-actions">
                  <button type="button" className="secondary" onClick={() => setShowManualRequest(false)}>Fechar</button>
                  <button disabled={busy}><Plus /> Registrar pré-reserva</button>
                </div>
              </form>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "sales" ? <OperationInstantOrders /> : null}
      {tab === "finance" ? <OperationFinance /> : null}
      {tab === "settings" ? <OperationCommerceSettings
        session={session}
        onOpenFlavorImages={onOpenContent}
        onOpenProductImages={() => changeTab("catalog")}
      /> : null}

      {tab === "catalog" ? (
        <div className="operation-catalog-admin">
          <MetaCatalogAdmin session={session} onProductsChanged={load} />
          <section className="operation-segment-media">
            <div>
              <small>Fotos principais das páginas</small>
              <h2>Galerias reais por categoria</h2>
              <p>Eventos, Adoce na Escola e Aluguel de decoração mostram esta foto uma única vez; os produtos e valores aparecem logo abaixo.</p>
            </div>
            <div className="operation-segment-media-grid">
              {(Object.keys(segmentLabels) as CommercialSegment[]).filter((segment) => segment !== "sweets").map((segment) => {
                const media = segmentMedia.find((item) => item.segment === segment);
                return (
                  <article key={segment}>
                    {media ? <img src={media.image_url} alt={media.alt_text} /> : <ImagePlus />}
                    <span><strong>{segmentLabels[segment]}</strong><small>{media ? "Foto publicada" : "Sem foto"}</small></span>
                    <div className="operation-image-actions">
                      <label>
                        <ImagePlus /> Escolher foto
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) setPendingImage({
                              file,
                              kind: "gallery",
                              segment,
                              title: `Foto principal de ${segmentLabels[segment]}`,
                              preset: CATEGORY_IMAGE_PRESET,
                            });
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <ClipboardImageInput
                        disabled={busy}
                        onError={setNotice}
                        onImage={(file) => setPendingImage({
                          file,
                          kind: "gallery",
                          segment,
                          title: `Foto principal de ${segmentLabels[segment]}`,
                          preset: CATEGORY_IMAGE_PRESET,
                        })}
                      />
                    </div>
                    <CommercialMediaAdmin
                      title={`Galeria de ${segmentLabels[segment]}`}
                      items={galleryFor({ segment })}
                      busy={busy}
                      onError={setNotice}
                      onImage={(file) => setPendingImage({ file, kind: "gallery", segment, title: `Foto de ${segmentLabels[segment]}`, preset: CATEGORY_IMAGE_PRESET })}
                      onReplace={(item, file) => setPendingImage({ file, kind: "gallery", segment, mediaItemId: item.id, title: `Substituir foto de ${segmentLabels[segment]}`, preset: CATEGORY_IMAGE_PRESET })}
                      onAddReel={(url, caption) => addInstagramMedia({ segment }, url, caption)}
                      onMove={(item, direction) => void moveGalleryMedia({ segment }, item, direction)}
                      onCover={(item) => void setGalleryCover({ segment }, item)}
                      onRemove={(item) => void removeGalleryMedia(item)}
                    />
                  </article>
                );
              })}
            </div>
          </section>
          <div className="operation-product-list">
            <button className="operation-new-product" onClick={() => setSelectedProduct(newProduct())}>
              <Plus /><span><small>Cadastro</small><strong>Novo produto</strong></span><ArrowRight />
            </button>
            {products.map((product) => (
              <button key={product.id} onClick={() => setSelectedProduct({ ...product })}>
                <span>
                  <small>
                    {segmentLabels[product.segment]}
                    {product.segment === "events" && product.subcategory
                      ? ` · ${eventSubcategoryLabels[product.subcategory]}`
                      : ""}
                  </small>
                  <strong>{product.name}</strong>
                </span>
                <b>{money(product.base_price)}</b><em>{product.published ? "Publicado" : "Rascunho"}</em><Edit3 />
              </button>
            ))}
          </div>
          {selectedProduct ? (
            <div className="operation-product-editor">
            <form className="operation-product-form" onSubmit={saveProduct}>
              <small>{selectedProduct.id ? "Editar produto" : "Novo produto"}</small><h2>{selectedProduct.name || "Cadastrar opção"}</h2>
              <div>
                <label>
                  Categoria
                  <select
                    value={selectedProduct.segment}
                    onChange={(event) => {
                      const nextSegment = event.target.value as CommercialSegment;
                      setSelectedProduct({
                        ...selectedProduct,
                        segment: nextSegment,
                        subcategory: nextSegment === "events"
                          ? selectedProduct.subcategory || "trays"
                          : null,
                      });
                    }}
                  >
                    {(Object.keys(segmentLabels) as CommercialSegment[]).map((item) => <option key={item} value={item}>{segmentLabels[item]}</option>)}
                  </select>
                </label>
                {selectedProduct.segment === "events" ? (
                  <label>
                    Tipo de evento
                    <select
                      value={selectedProduct.subcategory || "trays"}
                      onChange={(event) => setSelectedProduct({
                        ...selectedProduct,
                        subcategory: event.target.value as CommercialEventSubcategory,
                      })}
                    >
                      {(Object.keys(eventSubcategoryLabels) as CommercialEventSubcategory[]).map((item) => (
                        <option key={item} value={item}>{eventSubcategoryLabels[item]}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>Ordem<input type="number" value={selectedProduct.sort_order} onChange={(event) => setSelectedProduct({ ...selectedProduct, sort_order: Number(event.target.value) })} /></label>
              </div>
              <label>Nome<input value={selectedProduct.name} onChange={(event) => setSelectedProduct({ ...selectedProduct, name: event.target.value })} /></label>
              <label>Identificador <small>(gerado pelo nome se ficar vazio)</small><input value={selectedProduct.slug} onChange={(event) => setSelectedProduct({ ...selectedProduct, slug: slugify(event.target.value) })} placeholder="ex.: torta-de-morango" /></label>
              <label>Chamada curta<input value={selectedProduct.short_description} onChange={(event) => setSelectedProduct({ ...selectedProduct, short_description: event.target.value })} /></label>
              <label>Descrição<textarea value={selectedProduct.description} onChange={(event) => setSelectedProduct({ ...selectedProduct, description: event.target.value })} /></label>
              <div><label>Preço<input type="number" min="0" step="0.01" value={selectedProduct.base_price ?? ""} onChange={(event) => setSelectedProduct({ ...selectedProduct, base_price: event.target.value === "" ? null : Number(event.target.value) })} /></label><label>Complemento do preço<input value={selectedProduct.price_suffix} onChange={(event) => setSelectedProduct({ ...selectedProduct, price_suffix: event.target.value })} placeholder="ex.: por pessoa" /></label><label>Quantidade mínima<input type="number" min="1" value={selectedProduct.minimum_quantity} onChange={(event) => setSelectedProduct({ ...selectedProduct, minimum_quantity: Number(event.target.value) })} /></label><label>Antecedência útil<input type="number" min="0" value={selectedProduct.lead_business_days} onChange={(event) => setSelectedProduct({ ...selectedProduct, lead_business_days: Number(event.target.value) })} /></label></div>
              {selectedProduct.segment === "school" ? <label>Valor por criança adicional<input type="number" min="0" step="0.01" value={selectedProduct.details.additional_price ?? ""} onChange={(event) => setSelectedProduct({
                ...selectedProduct,
                details: {
                  ...selectedProduct.details,
                  additional_price: event.target.value === "" ? undefined : Number(event.target.value),
                },
              })} /></label> : null}
              <div className="operation-product-detail-fields">
                <label>
                  O que está incluído <small>(um item por linha)</small>
                  <textarea
                    value={(selectedProduct.details.includes || []).join("\n")}
                    onChange={(event) => setSelectedProduct({
                      ...selectedProduct,
                      details: {
                        ...selectedProduct.details,
                        includes: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                      },
                    })}
                  />
                </label>
                <label>
                  Regras e observações <small>(uma regra por linha)</small>
                  <textarea
                    value={(selectedProduct.details.rules || []).join("\n")}
                    onChange={(event) => setSelectedProduct({
                      ...selectedProduct,
                      details: {
                        ...selectedProduct.details,
                        rules: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                      },
                    })}
                  />
                </label>
              </div>
              <section className="operation-product-packages">
                <div><strong>Pacotes e faixas de preço</strong><small>Use para docinhos ou produtos vendidos em quantidades.</small></div>
                {(selectedProduct.details.packages || []).map((item, index) => (
                  <div className="operation-product-package-row" key={index}>
                    <label>Unidades<input type="number" min="1" value={item.quantity} onChange={(event) => {
                      const packages = [...(selectedProduct.details.packages || [])];
                      packages[index] = { ...item, quantity: Number(event.target.value) };
                      setSelectedProduct({ ...selectedProduct, details: { ...selectedProduct.details, packages } });
                    }} /></label>
                    <label>Preço<input type="number" min="0" step="0.01" value={item.price} onChange={(event) => {
                      const packages = [...(selectedProduct.details.packages || [])];
                      packages[index] = { ...item, price: Number(event.target.value) };
                      setSelectedProduct({ ...selectedProduct, details: { ...selectedProduct.details, packages } });
                    }} /></label>
                    <label>Sabores<input type="number" min="1" value={item.flavors || 1} onChange={(event) => {
                      const packages = [...(selectedProduct.details.packages || [])];
                      packages[index] = { ...item, flavors: Number(event.target.value) };
                      setSelectedProduct({ ...selectedProduct, details: { ...selectedProduct.details, packages } });
                    }} /></label>
                    <button type="button" onClick={() => setSelectedProduct({
                      ...selectedProduct,
                      details: {
                        ...selectedProduct.details,
                        packages: (selectedProduct.details.packages || []).filter((_, packageIndex) => packageIndex !== index),
                      },
                    })}>Remover</button>
                  </div>
                ))}
                <button type="button" onClick={() => setSelectedProduct({
                  ...selectedProduct,
                  details: {
                    ...selectedProduct.details,
                    packages: [...(selectedProduct.details.packages || []), { quantity: 25, price: 0, flavors: 1 }],
                  },
                })}><Plus /> Adicionar pacote</button>
              </section>
              <div className="operation-product-photo-editor">
                {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={`Foto de ${selectedProduct.name}`} /> : <ImagePlus />}
                <div>
                  <strong>Foto deste produto</strong>
                  <small>Edite o corte, o enquadramento e a luz sem deformar a foto real.</small>
                  <div className="operation-image-actions">
                    <label>
                      <ImagePlus /> {selectedProduct.image_url ? "Escolher outra foto" : "Escolher foto"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy || !selectedProduct.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) setPendingImage({
                            file,
                            kind: "gallery",
                            productId: selectedProduct.id,
                            title: `Foto de ${selectedProduct.name || "novo produto"}`,
                            preset: PRODUCT_IMAGE_PRESET,
                          });
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <ClipboardImageInput
                      disabled={busy || !selectedProduct.id}
                      onError={setNotice}
                      onImage={(file) => setPendingImage({
                        file,
                        kind: "gallery",
                        productId: selectedProduct.id,
                        title: `Foto de ${selectedProduct.name || "novo produto"}`,
                        preset: PRODUCT_IMAGE_PRESET,
                      })}
                    />
                  </div>
                  {selectedProduct.image_url ? <button type="button" onClick={() => setSelectedProduct({ ...selectedProduct, image_url: null })}>Remover da apresentação</button> : null}
                </div>
              </div>
              <label className="operation-check"><input type="checkbox" checked={selectedProduct.published} onChange={(event) => setSelectedProduct({ ...selectedProduct, published: event.target.checked })} /> Publicado para clientes</label>
              <label className="operation-check"><input type="checkbox" checked={selectedProduct.active} onChange={(event) => setSelectedProduct({ ...selectedProduct, active: event.target.checked })} /> Produto ativo</label>
              <section className="operation-meta-product">
                <label className="operation-check"><input type="checkbox" checked={selectedProduct.exibir_whatsapp} onChange={(event) => setSelectedProduct({ ...selectedProduct, exibir_whatsapp: event.target.checked })} /> Exibir no WhatsApp</label>
                <dl>
                  <div><dt>Identificador permanente</dt><dd>{selectedProduct.meta_retailer_id || "Será definido ao criar o produto"}</dd></div>
                  <div><dt>Situação</dt><dd>{({ disabled: "Não enviado", pending: "Pendente", syncing: "Enviando", submitted: "Processando na Meta", synced: "Sincronizado", error: "Erro" } as Record<string, string>)[selectedProduct.meta_sync_status] || selectedProduct.meta_sync_status}</dd></div>
                  <div><dt>Última sincronização</dt><dd>{selectedProduct.meta_last_sync_at ? dateTime(selectedProduct.meta_last_sync_at) : "Ainda não realizada"}</dd></div>
                  <div><dt>Tentativas</dt><dd>{selectedProduct.meta_sync_attempts}</dd></div>
                </dl>
                {selectedProduct.meta_last_error ? <p role="alert">{selectedProduct.meta_last_error}</p> : null}
                {selectedProduct.id ? <button type="button" disabled={busy} onClick={() => void syncMetaProduct(selectedProduct)}><RefreshCw /> {selectedProduct.meta_sync_status === "error" ? "Reprocessar" : "Sincronizar agora"}</button> : <small>Crie o produto antes da primeira sincronização.</small>}
              </section>
              {selectedProduct.id ? <CommercialMediaAdmin
                title={`Galeria de ${selectedProduct.name}`}
                items={galleryFor({ productId: selectedProduct.id })}
                busy={busy}
                onError={setNotice}
                onImage={(file) => setPendingImage({ file, kind: "gallery", productId: selectedProduct.id, title: `Foto de ${selectedProduct.name}`, preset: PRODUCT_IMAGE_PRESET })}
                onReplace={(item, file) => setPendingImage({ file, kind: "gallery", productId: selectedProduct.id, mediaItemId: item.id, title: `Substituir foto de ${selectedProduct.name}`, preset: PRODUCT_IMAGE_PRESET })}
                onAddReel={(url, caption) => addInstagramMedia({ productId: selectedProduct.id }, url, caption)}
                onMove={(item, direction) => void moveGalleryMedia({ productId: selectedProduct.id }, item, direction)}
                onCover={(item) => void setGalleryCover({ productId: selectedProduct.id }, item)}
                onRemove={(item) => void removeGalleryMedia(item)}
              /> : <p>Salve o produto antes de adicionar fotos ou Reels à galeria.</p>}
              <button disabled={busy || !selectedProduct.name.trim()}><Check /> {selectedProduct.id ? "Salvar produto" : "Criar produto"}</button>
            </form>
            {selectedProduct.id ? <section className="operation-product-options">
              <small>Personalização e acréscimos</small><h2>Massas, recheios e adicionais</h2>
              <p>O valor fica zerado para opções incluídas. Informe somente o acréscimo quando houver.</p>
              <div className="operation-option-list">
                {productOptions.filter((item) => item.product_id === selectedProduct.id).map((option) => <article key={option.id}>
                  <span><small>{option.group_key.replace(/_/g, " ")}</small><strong>{option.label}</strong></span>
                  <b>{option.price_adjustment ? `+ ${money(option.price_adjustment)}` : "incluído"}</b>
                  <label className="operation-check"><input type="checkbox" checked={option.active} onChange={(event) => void updateProductOption(option, { active: event.target.checked })} /> Ativo</label>
                </article>)}
              </div>
              <form onSubmit={addProductOption}>
                <label>Grupo<input required value={optionForm.group} onChange={(event) => setOptionForm({ ...optionForm, group: event.target.value })} placeholder="recheio" /></label>
                <label>Nome<input required value={optionForm.label} onChange={(event) => setOptionForm({ ...optionForm, label: event.target.value })} placeholder="Pistache" /></label>
                <label>Acréscimo<input type="number" min="0" step="0.01" value={optionForm.adjustment} onChange={(event) => setOptionForm({ ...optionForm, adjustment: Number(event.target.value) })} /></label>
                <button disabled={busy}><Plus /> Adicionar opção</button>
              </form>
            </section> : <section className="operation-product-options operation-product-options-empty"><PackagePlus /><p>Salve o novo produto para cadastrar recheios, massas e adicionais.</p></section>}
            </div>
          ) : <div className="operation-empty"><Edit3 /><p>Escolha um produto para editar valores, textos e publicação.</p></div>}
        </div>
      ) : null}

      {tab === "crm" ? (
        <div className="operation-commercial-grid">
          <section>
            <form className="operation-commercial-search" onSubmit={(event) => event.preventDefault()}><Search /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar cliente no histórico" /></form>
            <div className="operation-request-list crm">
              {filteredRequests.filter((request) => !["completed", "cancelled", "expired"].includes(request.status)).map((request) => (
                <button key={request.id} onClick={() => openRequest(request)}>
                  <span><strong>{request.customer_name}</strong><small>{request.customer_phone}</small></span>
                  <span><em>{request.commercial_products?.name}</em><small>{statuses[request.status]}</small></span>
                  <b>{notes.filter((note) => note.service_request_id === request.id).length} nota(s)</b><ArrowRight />
                </button>
              ))}
            </div>
          </section>
          <div className="operation-crm-summary">
            <small>Relacionamento</small><h2>{selectedRequest?.customer_name || "Selecione um cliente"}</h2>
            {selectedRequest ? <>
              <p>{selectedRequest.customer_phone} · {selectedRequest.customer_email || "sem e-mail"}</p>
              <div className="operation-crm-timeline">
                <article><CircleDollarSign /><span><strong>{selectedRequest.commercial_products?.name}</strong><small>{selectedRequest.request_number} · {statuses[selectedRequest.status]}</small></span></article>
                {requestHistory.filter((event) => event.entity_id === selectedRequest.id).map((event) => <article key={`history-${event.id}`}><RefreshCw /><span><strong>{event.payload.from_status ? `${statuses[event.payload.from_status]} → ` : ""}{event.payload.status ? statuses[event.payload.status] : "Pedido atualizado"}</strong><small>{dateTime(event.created_at)}</small></span></article>)}
                {notes.filter((note) => note.service_request_id === selectedRequest.id).map((note) => <article key={note.id}><NotebookPen /><span><strong>{note.note}</strong><small>{dateTime(note.created_at)}</small></span></article>)}
                {tasks.filter((task) => task.service_request_id === selectedRequest.id).map((task) => <article key={task.id}><Clock3 /><span><strong>{task.title}</strong><small>{task.due_at ? dateTime(task.due_at) : "Sem prazo"} · {task.status}</small></span>{task.status === "open" ? <button onClick={() => void completeTask(task)}><Check /></button> : null}</article>)}
              </div>
              <form onSubmit={addCrmNote}><label>Nova nota<textarea value={crmText} onChange={(event) => setCrmText(event.target.value)} placeholder="Preferências, contexto do atendimento ou combinado..." /></label><button><NotebookPen /> Registrar nota</button></form>
              <form onSubmit={addCrmTask}><label>Lembrete<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ex.: confirmar sinal" /></label><label>Quando<input type="datetime-local" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label><button><Clock3 /> Criar lembrete</button></form>
              {!['cancelled', 'expired', 'completed'].includes(selectedRequest.status) ? (
                <section className="operation-crm-cancellation" aria-label="Cancelar solicitação">
                  <div>
                    <strong>{selectedRequest.status === "prebooked" ? "Cancelar esta pré-reserva" : "Cancelar esta solicitação"}</strong>
                    <small>Ela sai dos pedidos ativos, libera a agenda e permanece identificada no histórico.</small>
                  </div>
                  {!showCancellation ? (
                    <button
                      type="button"
                      className="operation-danger-button"
                      onClick={() => {
                        setCancellationReason("");
                        setNotice("");
                        setShowCancellation(true);
                      }}
                    >
                      <Trash2 /> {selectedRequest.status === "prebooked" ? "Cancelar pré-reserva" : "Cancelar solicitação"}
                    </button>
                  ) : (
                    <div className="operation-crm-cancellation-confirm">
                      <label>
                        Motivo do cancelamento
                        <textarea
                          autoFocus
                          value={cancellationReason}
                          onChange={(event) => setCancellationReason(event.target.value)}
                          placeholder="Ex.: solicitação de teste, cliente desistiu ou cadastro duplicado."
                        />
                      </label>
                      <small className={cancellationReason.trim().length > 0 && cancellationReason.trim().length < 5 ? "drawer-cancellation-error" : ""}>
                        {cancellationReason.trim().length < 5
                          ? `Informe pelo menos mais ${5 - cancellationReason.trim().length} caractere(s).`
                          : "O motivo será preservado no histórico da equipe."}
                      </small>
                      <div>
                        <button type="button" onClick={() => { setShowCancellation(false); setCancellationReason(""); }}>Voltar</button>
                        <button
                          type="button"
                          className="operation-danger-button"
                          disabled={busy || cancellationReason.trim().length < 5}
                          onClick={() => void cancelRequest(selectedRequest)}
                        >
                          Confirmar cancelamento
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              ) : null}
            </> : null}
          </div>
        </div>
      ) : null}

      {tab === "pede_junto" ? <OperationPedeJunto /> : null}

      {tab === "feedback" ? (
        <div className="operation-commercial-grid feedback-operation">
          <section>
            <div className="operation-commercial-head">
              <div><small>Voz do cliente</small><h2>Reclamações e sugestões</h2></div>
            </div>
            <div className="operation-request-list feedback-list">
              {feedback.map((item) => (
                <button key={item.id} onClick={() => setSelectedFeedback({ ...item })}>
                  <span><strong>{item.customer_name}</strong><small>{item.protocol} · {dateTime(item.created_at)}</small></span>
                  <span><em>{item.category === "problem" ? "Problema no site" : item.category === "complaint" ? "Reclamação" : item.category === "suggestion" ? "Sugestão" : "Elogio"}</em><small>{item.message}</small></span>
                  <b className={`status-${item.status}`}>{item.status === "new" ? "Nova" : item.status === "reviewing" ? "Em análise" : item.status === "resolved" ? "Resolvida" : "Encerrada"}</b>
                  <ArrowRight />
                </button>
              ))}
              {!feedback.length ? <div className="operation-empty"><MessageSquareWarning /><p>Nenhuma manifestação recebida.</p></div> : null}
            </div>
          </section>
          {selectedFeedback ? (
            <form className="operation-crm-summary feedback-treatment" onSubmit={saveFeedback}>
              <small>{selectedFeedback.protocol}</small>
              <h2>{selectedFeedback.customer_name}</h2>
              <p>{selectedFeedback.customer_phone || "sem celular"} · {selectedFeedback.customer_email || "sem e-mail"}</p>
              <blockquote>{selectedFeedback.message}</blockquote>
              {selectedFeedback.page_url ? <a href={selectedFeedback.page_url} target="_blank" rel="noreferrer">Abrir página informada</a> : null}
              <label>Status
                <select value={selectedFeedback.status} onChange={(event) => setSelectedFeedback({ ...selectedFeedback, status: event.target.value as SiteFeedback["status"] })}>
                  <option value="new">Nova</option><option value="reviewing">Em análise</option><option value="resolved">Resolvida</option><option value="closed">Encerrada</option>
                </select>
              </label>
              <label>Notas internas<textarea value={selectedFeedback.internal_notes} onChange={(event) => setSelectedFeedback({ ...selectedFeedback, internal_notes: event.target.value })} placeholder="Registre o que foi verificado e a solução adotada." /></label>
              <button disabled={busy}><Check /> Salvar tratamento</button>
            </form>
          ) : <div className="operation-empty"><MessageSquareWarning /><p>Escolha uma manifestação para analisar.</p></div>}
        </div>
      ) : null}

      {selectedRequest && tab !== "crm" ? (
        <div className="operation-drawer-layer">
          <button className="operation-drawer-backdrop" aria-label="Fechar detalhes do pedido" onClick={closeRequest} />
          <aside className="operation-request-drawer print-scope" role="dialog" aria-modal="true" aria-label={`Solicitação ${selectedRequest.request_number}`}>
            <button autoFocus className="drawer-close" aria-label="Fechar detalhes" onClick={closeRequest}>×</button>
            <small>{selectedRequest.request_number}</small><h2>{nomeLegivel(selectedRequest.customer_name)}</h2>
            <div className="operation-print-actions">
              <button type="button" className="drawer-print" onClick={() => printOperation("thermal")}><Printer /> Imprimir ficha 58 mm</button>
              <button type="button" className="drawer-print secondary" onClick={() => printOperation("a4")}><Printer /> A4 ou salvar em PDF</button>
            </div>
            <p>{selectedRequest.commercial_products?.name}</p>
            <p><strong>Pedido em</strong> {formatarDataHora(selectedRequest.created_at)} · <strong>Retirada</strong> {formatarDataHora(selectedRequest.desired_start)}</p>
            {selectedRequest.selections?.preferences || selectedRequest.customer_notes ? (
              <section className="drawer-customer-request">
                <small>O que a cliente pediu</small>
                {selectedRequest.selections?.preferences ? (() => {
                  const items = parsePreferences(selectedRequest.selections.preferences || "");
                  return items.length > 1 ? (
                    <ul>{items.map((item, index) => <li key={index}>{item.quantity ? `${item.quantity} ` : ""}{item.description}</li>)}</ul>
                  ) : (
                    <p className="drawer-request-raw">{selectedRequest.selections.preferences}</p>
                  );
                })() : null}
                {selectedRequest.customer_notes ? (
                  <p className="drawer-request-note"><strong>Observação da cliente</strong>{selectedRequest.customer_notes}</p>
                ) : null}
              </section>
            ) : null}
            <FichaTermica data={{
              requestNumber: selectedRequest.request_number,
              createdAt: selectedRequest.created_at,
              customerName: selectedRequest.customer_name,
              customerPhone: selectedRequest.customer_phone,
              productName: selectedRequest.commercial_products?.name || "",
              quantity: selectedRequest.quantity,
              desiredStart: selectedRequest.desired_start,
              serviceLocation: selectedRequest.service_location,
              preferences: selectedRequest.selections?.preferences || "",
              customerNotes: selectedRequest.customer_notes,
              quotedTotal: selectedRequest.quoted_total,
              depositAmount: selectedRequest.deposit_amount,
              statusLabel: statuses[selectedRequest.status],
            }} />
            <RequestQuoteDocument data={{
              requestNumber: selectedRequest.request_number,
              createdAt: selectedRequest.created_at,
              customerName: selectedRequest.customer_name,
              customerPhone: selectedRequest.customer_phone,
              productName: selectedRequest.commercial_products?.name || "",
              quantity: selectedRequest.quantity,
              desiredStart: selectedRequest.desired_start,
              serviceLocation: selectedRequest.service_location,
              preferences: selectedRequest.selections?.preferences || "",
              customerNotes: selectedRequest.customer_notes,
              quotedTotal: selectedRequest.quoted_total,
              depositAmount: selectedRequest.deposit_amount,
              statusLabel: statuses[selectedRequest.status],
            }} />
            <dl>
              <div><dt>WhatsApp</dt><dd><a href={operationWhatsAppUrl(selectedRequest.customer_phone, "Olá! Estamos falando sobre sua encomenda na Adoce.")} target="_blank" rel="noreferrer">{formatarTelefoneBR(selectedRequest.customer_phone)}</a></dd></div>
              <div><dt>Quantidade</dt><dd>{selectedRequest.quantity}</dd></div>
              <div><dt>Status</dt><dd>{statuses[selectedRequest.status]}</dd></div>
              <div><dt>Origem</dt><dd>{sourceLabels[selectedRequest.source] || selectedRequest.source}</dd></div>
              <div><dt>Prazo</dt><dd>{requestIsPastDue(selectedRequest, now) ? "Vencido — precisa de decisão" : selectedRequest.expires_at ? dateTime(selectedRequest.expires_at) : "Não expira"}</dd></div>
              <div><dt>Local</dt><dd>{selectedRequest.service_location || "Não informado"}</dd></div>
            </dl>
            {competingCount(selectedRequest) ? <div className="drawer-warning"><AlertTriangle /> Existem {competingCount(selectedRequest)} pré-reserva(s) concorrente(s). A preferência é de quem confirmar primeiro.</div> : null}
            <label>Total do orçamento<input type="number" min="0" step="0.01" value={selectedRequest.quoted_total ?? ""} onChange={(event) => setSelectedRequest({ ...selectedRequest, quoted_total: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            <label>Sinal recebido<input type="number" min="0" step="0.01" value={selectedRequest.deposit_amount ?? ""} onChange={(event) => setSelectedRequest({ ...selectedRequest, deposit_amount: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            <label>Notas internas<textarea value={selectedRequest.internal_notes} onChange={(event) => setSelectedRequest({ ...selectedRequest, internal_notes: event.target.value })} placeholder="Registre combinados e motivos de alterações." /></label>
            {canManage ? <button className="drawer-save" disabled={busy} onClick={() => void saveRequestDetails(selectedRequest)}><Save /> Salvar valores e anotações</button> : null}
            <div className="drawer-next-step">
              <small>Próxima ação recomendada</small>
              <div className="drawer-actions">
                {requestTransitions[selectedRequest.status].map((nextStatus) => (
                  <button className={nextStatus === "confirmed" || nextStatus === "completed" ? "confirm" : ""} key={nextStatus} disabled={busy || !canManage} onClick={() => void updateRequest(selectedRequest, nextStatus)}>
                    {nextStatus === "prebooked" ? <RotateCcw /> : null}{transitionLabels[nextStatus] || statuses[nextStatus]}
                  </button>
                ))}
                {!requestTransitions[selectedRequest.status].length ? <p>Este atendimento já está encerrado. O histórico continua disponível no CRM.</p> : null}
              </div>
            </div>
            {canManage && !["completed", "cancelled", "expired"].includes(selectedRequest.status) ? (
              <div className="drawer-cancellation">
                {!showCancellation ? <button type="button" className="cancel" onClick={() => { setCancellationReason(""); setCancellationError(""); setNotice(""); setShowCancellation(true); }}><Trash2 /> Cancelar e retirar da fila</button> : <>
                  <label>Motivo do cancelamento<textarea autoFocus value={cancellationReason} aria-describedby="request-cancellation-guidance" onChange={(event) => setCancellationReason(event.target.value)} placeholder="Ex.: cliente desistiu, data indisponível ou solicitação duplicada." /></label>
                  <small id="request-cancellation-guidance" className={cancellationReason.trim().length > 0 && cancellationReason.trim().length < 5 ? "drawer-cancellation-error" : ""}>
                    {cancellationReason.trim().length < 5
                      ? `Conte o motivo em mais ${5 - cancellationReason.trim().length} caractere(s). Assim o histórico fica claro para a equipe.`
                      : "Motivo pronto para ser registrado no histórico."}
                  </small>
                  {cancellationError ? <p className="drawer-cancellation-failure" role="alert">{cancellationError}</p> : null}
                  <p>O pedido sairá da fila ativa, mas continuará no histórico para consulta.</p>
                  <div><button type="button" onClick={() => { setShowCancellation(false); setCancellationReason(""); setCancellationError(""); }}>Voltar</button><button type="button" className="cancel" disabled={busy || cancellationReason.trim().length < 5} onClick={() => void cancelRequest(selectedRequest)}>{busy ? "Cancelando..." : "Confirmar cancelamento"}</button></div>
                </>}
              </div>
            ) : null}
            <a href={operationWhatsAppUrl(selectedRequest.customer_phone, `Olá, ${selectedRequest.customer_name.split(/\s+/)[0]}! Estamos falando sobre sua solicitação ${selectedRequest.request_number} na Adoce Brigaderia.`)} target="_blank" rel="noreferrer"><MessageCircle /> Falar com o cliente no WhatsApp Business</a>
          </aside>
        </div>
      ) : null}
      {selectedBlock ? (
        <div className="operation-drawer-layer">
          <button className="operation-drawer-backdrop" aria-label="Fechar detalhes do compromisso" onClick={() => setSelectedBlock(null)} />
          <aside className="operation-request-drawer print-scope" role="dialog" aria-modal="true" aria-label={`Compromisso ${selectedBlock.title}`}>
            <button autoFocus className="drawer-close" aria-label="Fechar detalhes" onClick={() => setSelectedBlock(null)}>×</button>
            <small>Compromisso da agenda</small><h2>{selectedBlock.title}</h2>
            <div className="operation-print-actions">
              <button type="button" className="drawer-print" onClick={() => printOperation("thermal")}><Printer /> Imprimir ficha 58 mm</button>
              <button type="button" className="drawer-print secondary" onClick={() => printOperation("a4")}><Printer /> A4 ou salvar em PDF</button>
            </div>
            <p><strong>Início</strong> {formatarDataHora(selectedBlock.starts_at)} · <strong>Fim</strong> {formatarDataHora(selectedBlock.ends_at)}</p>
            <dl><div><dt>Tipo</dt><dd>{selectedBlock.block_kind}</dd></div><div><dt>Status</dt><dd>{selectedBlock.status}</dd></div><div><dt>Recurso</dt><dd>{selectedBlock.resource_key || "Não informado"}</dd></div></dl>
            {selectedBlock.notes ? <div className="drawer-block-notes"><strong>Observações</strong><p>{selectedBlock.notes}</p></div> : null}
            {canManage ? <button className="drawer-remove-block" disabled={busy} onClick={() => void cancelCalendarBlock(selectedBlock)}><Trash2 /> Cancelar e retirar da agenda</button> : null}
            <small>O registro permanecerá no histórico.</small>
          </aside>
        </div>
      ) : null}
      {pendingImage ? (
        <ImageEditor
          file={pendingImage.file}
          title={pendingImage.title}
          preset={pendingImage.preset}
          onCancel={() => setPendingImage(null)}
          onApply={applyCommercialImage}
        />
      ) : null}
    </div>
  );
}
