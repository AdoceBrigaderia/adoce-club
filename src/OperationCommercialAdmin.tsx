import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
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
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { normalizeProductImage, safeMediaFileName } from "./admin-media";
import {
  CommercialProduct,
  CommercialProductOption,
  CommercialSegment,
  money,
  normalizeBrazilianPhone,
  segmentLabels,
} from "./commercial";
import "./operation-commercial.css";
import "./operation-product-options.css";
import "./operation-media-editor.css";

type AdminTab = "agenda" | "requests" | "catalog" | "crm" | "feedback";
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

type CommercialSegmentMedia = {
  id: string;
  segment: CommercialSegment;
  image_url: string;
  alt_text: string;
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

const statuses: Record<RequestStatus, string> = {
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
  allergens: [],
  show_allergens: false,
  published: false,
  active: true,
  sort_order: 100,
});

export default function OperationCommercialAdmin({
  session,
  role,
}: {
  session: Session;
  role: string;
}) {
  const [tab, setTab] = useState<AdminTab>("agenda");
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [productOptions, setProductOptions] = useState<CommercialProductOption[]>([]);
  const [segmentMedia, setSegmentMedia] = useState<CommercialSegmentMedia[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [feedback, setFeedback] = useState<SiteFeedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<SiteFeedback | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CommercialProduct | null>(null);
  const [optionForm, setOptionForm] = useState({ group: "recheio", label: "", adjustment: 0 });
  const [filter, setFilter] = useState("");
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

  const load = useCallback(async () => {
    setBusy(true);
    setNotice("");
    const supabase = requireSupabase();
    const [productResult, optionResult, mediaResult, requestResult, blockResult, noteResult, taskResult, feedbackResult] = await Promise.all([
      supabase.from("commercial_products").select("*").order("sort_order"),
      supabase.from("commercial_product_options").select("*").order("sort_order"),
      supabase.from("commercial_segment_media").select("*").order("segment"),
      supabase
        .from("service_requests")
        .select("*,commercial_products(name,segment,resource_key)")
        .order("desired_start", { ascending: true })
        .limit(300),
      supabase.from("calendar_blocks").select("*").order("starts_at").limit(200),
      supabase.from("crm_notes").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("crm_tasks").select("*").order("due_at", { ascending: true }).limit(200),
      supabase.from("site_feedback").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    const error = productResult.error || optionResult.error || requestResult.error || blockResult.error || noteResult.error || taskResult.error || feedbackResult.error;
    if (error) setNotice(error.message);
    else {
      setProducts((productResult.data || []) as CommercialProduct[]);
      setProductOptions((optionResult.data || []) as CommercialProductOption[]);
      if (!mediaResult.error) setSegmentMedia((mediaResult.data || []) as CommercialSegmentMedia[]);
      setRequests((requestResult.data || []) as unknown as ServiceRequest[]);
      setBlocks((blockResult.data || []) as CalendarBlock[]);
      setNotes((noteResult.data || []) as CrmNote[]);
      setTasks((taskResult.data || []) as CrmTask[]);
      setFeedback((feedbackResult.data || []) as SiteFeedback[]);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const activeRequests = useMemo(
    () =>
      requests.filter((request) =>
        ["prebooked", "quoted", "awaiting_deposit", "confirmed", "in_production", "ready"].includes(request.status),
      ),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    const clean = filter.trim().toLocaleLowerCase("pt-BR");
    if (!clean) return requests;
    return requests.filter((request) =>
      `${request.request_number} ${request.customer_name} ${request.customer_phone} ${request.commercial_products?.name || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(clean),
    );
  }, [filter, requests]);

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
    const start = new Date(manualRequest.start);
    setBusy(true);
    const { error } = await requireSupabase().from("service_requests").insert({
      request_number: "",
      product_id: product.id,
      customer_name: manualRequest.name.trim(),
      customer_phone: `+${normalizeBrazilianPhone(manualRequest.phone)}`,
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
        sort_order: selectedProduct.sort_order,
        published: selectedProduct.published,
        active: selectedProduct.active,
        updated_by: session.user.id,
      };
    const query = selectedProduct.id
      ? requireSupabase().from("commercial_products").update(payload).eq("id", selectedProduct.id)
      : requireSupabase().from("commercial_products").insert({ ...payload, created_by: session.user.id });
    const { error } = await query;
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(selectedProduct.id ? "Produto atualizado no catálogo." : "Novo produto criado no catálogo.");
      setSelectedProduct(null);
      await load();
    }
  };

  const uploadProductPhoto = async (file: File) => {
    if (!selectedProduct) return;
    setBusy(true);
    setNotice("");
    try {
      const blob = await normalizeProductImage(file);
      const productKey = selectedProduct.id || selectedProduct.slug || slugify(selectedProduct.name) || "novo-produto";
      const path = `commercial/products/${productKey}/${Date.now()}-${safeMediaFileName(file.name)}.webp`;
      const supabase = requireSupabase();
      const { error: uploadError } = await supabase.storage
        .from("adoce-media")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("adoce-media").getPublicUrl(path);
      setSelectedProduct({ ...selectedProduct, image_url: data.publicUrl });
      setNotice("Foto preparada. Salve o produto para publicar a alteração.");
    } catch (uploadError) {
      setNotice(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
    }
  };

  const uploadSegmentCover = async (segment: CommercialSegment, file: File) => {
    setBusy(true);
    setNotice("");
    try {
      const blob = await normalizeProductImage(file);
      const path = `commercial/segments/${segment}/${Date.now()}-${safeMediaFileName(file.name)}.webp`;
      const supabase = requireSupabase();
      const { error: uploadError } = await supabase.storage
        .from("adoce-media")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("adoce-media").getPublicUrl(path);
      const { error: mediaError } = await supabase.from("commercial_segment_media").upsert({
        segment,
        image_url: data.publicUrl,
        alt_text: `Foto real da categoria ${segmentLabels[segment]}`,
        updated_by: session.user.id,
      }, { onConflict: "segment" });
      if (mediaError) throw mediaError;
      setNotice("Foto principal da categoria atualizada.");
      await load();
    } catch (uploadError) {
      setNotice(uploadError instanceof Error ? uploadError.message : "Não foi possível atualizar a foto principal.");
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="operation-commercial">
      <div className="operation-title">
        <div>
          <span>Agenda & CRM</span>
          <h1>Pedidos e eventos</h1>
          <p>Pré-reservas, encomendas, agenda operacional e relacionamento em um só lugar.</p>
        </div>
        <button className="commercial-refresh" onClick={() => void load()} disabled={busy}>
          <RefreshCw /> Atualizar
        </button>
      </div>

      <div className="operation-commercial-metrics">
        <span><strong>{activeRequests.length}</strong><small>pedidos ativos</small></span>
        <span><strong>{requests.filter((item) => item.status === "prebooked").length}</strong><small>pré-reservas</small></span>
        <span><strong>{requests.filter((item) => item.status === "confirmed").length}</strong><small>confirmados</small></span>
        <span><strong>{tasks.filter((item) => item.status === "open" && item.due_at && new Date(item.due_at).getTime() <= now + 24 * 60 * 60 * 1000).length}</strong><small>lembretes em 24h</small></span>
      </div>

      <nav className="operation-commercial-tabs">
        <button className={tab === "agenda" ? "active" : ""} onClick={() => setTab("agenda")}><CalendarDays /> Agenda</button>
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><PackagePlus /> Pedidos</button>
        <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}><Edit3 /> Catálogo</button>
        <button className={tab === "crm" ? "active" : ""} onClick={() => setTab("crm")}><Users /> CRM</button>
        <button className={tab === "feedback" ? "active" : ""} onClick={() => setTab("feedback")}><MessageSquareWarning /> Reclamações</button>
      </nav>

      {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}

      {tab === "agenda" ? (
        <div className="operation-commercial-grid">
          <section>
            <div className="operation-commercial-head"><div><small>Próximos compromissos</small><h2>Agenda operacional</h2></div></div>
            <div className="operation-agenda-list">
              {[...activeRequests.map((item) => ({
                id: item.id,
                title: `${item.request_number} · ${item.customer_name}`,
                subtitle: item.commercial_products?.name || "Pedido",
                starts: item.desired_start,
                status: item.status,
                warning: competingCount(item),
                request: item,
              })), ...blocks.filter((item) => item.status !== "cancelled").map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: "Bloqueio manual",
                starts: item.starts_at,
                status: item.status,
                warning: 0,
                request: null,
              }))]
                .sort((a, b) => +new Date(a.starts) - +new Date(b.starts))
                .map((item) => (
                  <button key={`${item.request ? "r" : "b"}-${item.id}`} onClick={() => item.request && setSelectedRequest(item.request)}>
                    <CalendarDays />
                    <span><strong>{item.title}</strong><small>{item.subtitle} · {dateTime(item.starts)}</small></span>
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
          <section>
            <form className="operation-commercial-search" onSubmit={(event) => event.preventDefault()}><Search /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar número, cliente, telefone ou produto" /></form>
            <div className="operation-request-list">
              {filteredRequests.map((request) => (
                <button key={request.id} onClick={() => setSelectedRequest(request)}>
                  <span><small>{request.request_number}</small><strong>{request.customer_name}</strong><em>{request.commercial_products?.name}</em></span>
                  <span><strong>{dateTime(request.desired_start)}</strong><small>{request.customer_phone}</small></span>
                  <b className={`status-${request.status}`}>{statuses[request.status]}</b><ArrowRight />
                </button>
              ))}
            </div>
          </section>
          <form className="operation-block-form" onSubmit={createManualRequest}>
            <small>Atendimento por telefone ou WhatsApp</small><h2>Nova pré-reserva</h2>
            <label>Produto<select required value={manualRequest.productId} onChange={(event) => setManualRequest({ ...manualRequest, productId: event.target.value })}><option value="">Selecione</option>{products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Cliente<input required value={manualRequest.name} onChange={(event) => setManualRequest({ ...manualRequest, name: event.target.value })} /></label>
            <label>WhatsApp<input required value={manualRequest.phone} onChange={(event) => setManualRequest({ ...manualRequest, phone: event.target.value })} /></label>
            <label>Data e hora<input required type="datetime-local" value={manualRequest.start} onChange={(event) => setManualRequest({ ...manualRequest, start: event.target.value })} /></label>
            <label>Detalhes<textarea value={manualRequest.notes} onChange={(event) => setManualRequest({ ...manualRequest, notes: event.target.value })} /></label>
            <button disabled={busy}><Plus /> Criar pré-reserva</button>
          </form>
        </div>
      ) : null}

      {tab === "catalog" ? (
        <div className="operation-catalog-admin">
          <section className="operation-segment-media">
            <div>
              <small>Fotos principais das páginas</small>
              <h2>Uma imagem real por categoria</h2>
              <p>Eventos, Adoce na Escola e Aluguel de decoração mostram esta foto uma única vez; os produtos e valores aparecem logo abaixo.</p>
            </div>
            <div className="operation-segment-media-grid">
              {(Object.keys(segmentLabels) as CommercialSegment[]).map((segment) => {
                const media = segmentMedia.find((item) => item.segment === segment);
                return (
                  <article key={segment}>
                    {media ? <img src={media.image_url} alt={media.alt_text} /> : <ImagePlus />}
                    <span><strong>{segmentLabels[segment]}</strong><small>{media ? "Foto publicada" : "Sem foto"}</small></span>
                    <label>
                      <ImagePlus /> Trocar foto
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadSegmentCover(segment, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
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
                <span><small>{segmentLabels[product.segment]}</small><strong>{product.name}</strong></span>
                <b>{money(product.base_price)}</b><em>{product.published ? "Publicado" : "Rascunho"}</em><Edit3 />
              </button>
            ))}
          </div>
          {selectedProduct ? (
            <div className="operation-product-editor">
            <form className="operation-product-form" onSubmit={saveProduct}>
              <small>{selectedProduct.id ? "Editar produto" : "Novo produto"}</small><h2>{selectedProduct.name || "Cadastrar opção"}</h2>
              <div><label>Categoria<select value={selectedProduct.segment} onChange={(event) => setSelectedProduct({ ...selectedProduct, segment: event.target.value as CommercialSegment })}>{(Object.keys(segmentLabels) as CommercialSegment[]).map((item) => <option key={item} value={item}>{segmentLabels[item]}</option>)}</select></label><label>Ordem<input type="number" value={selectedProduct.sort_order} onChange={(event) => setSelectedProduct({ ...selectedProduct, sort_order: Number(event.target.value) })} /></label></div>
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
                  <small>JPG, PNG ou WebP. O sistema reduz e otimiza sem deformar.</small>
                  <label>
                    <ImagePlus /> {selectedProduct.image_url ? "Substituir foto" : "Adicionar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadProductPhoto(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {selectedProduct.image_url ? <button type="button" onClick={() => setSelectedProduct({ ...selectedProduct, image_url: null })}>Remover da apresentação</button> : null}
                </div>
              </div>
              <label className="operation-check"><input type="checkbox" checked={selectedProduct.published} onChange={(event) => setSelectedProduct({ ...selectedProduct, published: event.target.checked })} /> Publicado para clientes</label>
              <label className="operation-check"><input type="checkbox" checked={selectedProduct.active} onChange={(event) => setSelectedProduct({ ...selectedProduct, active: event.target.checked })} /> Produto ativo</label>
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
              {filteredRequests.map((request) => (
                <button key={request.id} onClick={() => setSelectedRequest(request)}>
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
                {notes.filter((note) => note.service_request_id === selectedRequest.id).map((note) => <article key={note.id}><NotebookPen /><span><strong>{note.note}</strong><small>{dateTime(note.created_at)}</small></span></article>)}
                {tasks.filter((task) => task.service_request_id === selectedRequest.id).map((task) => <article key={task.id}><Clock3 /><span><strong>{task.title}</strong><small>{task.due_at ? dateTime(task.due_at) : "Sem prazo"} · {task.status}</small></span>{task.status === "open" ? <button onClick={() => void completeTask(task)}><Check /></button> : null}</article>)}
              </div>
              <form onSubmit={addCrmNote}><label>Nova nota<textarea value={crmText} onChange={(event) => setCrmText(event.target.value)} placeholder="Preferências, contexto do atendimento ou combinado..." /></label><button><NotebookPen /> Registrar nota</button></form>
              <form onSubmit={addCrmTask}><label>Lembrete<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ex.: confirmar sinal" /></label><label>Quando<input type="datetime-local" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label><button><Clock3 /> Criar lembrete</button></form>
            </> : null}
          </div>
        </div>
      ) : null}

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
        <div className="operation-request-drawer" role="dialog" aria-modal="true" aria-label={`Solicitação ${selectedRequest.request_number}`}>
          <button className="drawer-close" onClick={() => setSelectedRequest(null)}>×</button>
          <small>{selectedRequest.request_number}</small><h2>{selectedRequest.customer_name}</h2>
          <p>{selectedRequest.commercial_products?.name} · {dateTime(selectedRequest.desired_start)}</p>
          <dl><div><dt>WhatsApp</dt><dd>{selectedRequest.customer_phone}</dd></div><div><dt>Quantidade</dt><dd>{selectedRequest.quantity}</dd></div><div><dt>Status</dt><dd>{statuses[selectedRequest.status]}</dd></div><div><dt>Expira</dt><dd>{selectedRequest.expires_at ? dateTime(selectedRequest.expires_at) : "Não expira"}</dd></div></dl>
          {competingCount(selectedRequest) ? <div className="drawer-warning"><AlertTriangle /> Existem {competingCount(selectedRequest)} pré-reserva(s) concorrente(s). A preferência é de quem confirmar primeiro.</div> : null}
          <label>Total do orçamento<input type="number" min="0" step="0.01" value={selectedRequest.quoted_total ?? ""} onChange={(event) => setSelectedRequest({ ...selectedRequest, quoted_total: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          <label>Sinal recebido<input type="number" min="0" step="0.01" value={selectedRequest.deposit_amount ?? ""} onChange={(event) => setSelectedRequest({ ...selectedRequest, deposit_amount: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          <label>Notas internas<textarea value={selectedRequest.internal_notes} onChange={(event) => setSelectedRequest({ ...selectedRequest, internal_notes: event.target.value })} /></label>
          <div className="drawer-actions">
            <button onClick={() => void updateRequest(selectedRequest, "quoted")}>Orçamento enviado</button>
            <button onClick={() => void updateRequest(selectedRequest, "awaiting_deposit")}>Aguardar sinal</button>
            <button className="confirm" onClick={() => void updateRequest(selectedRequest, "confirmed")}>Confirmar pedido</button>
            <button className="cancel" onClick={() => void updateRequest(selectedRequest, "cancelled")}>Cancelar</button>
          </div>
          <a href={`https://wa.me/${selectedRequest.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${selectedRequest.customer_name.split(/\s+/)[0]}! Estamos falando sobre sua solicitação ${selectedRequest.request_number} na Adoce Brigaderia.`)}`} target="_blank" rel="noreferrer"><MessageCircle /> Falar com o cliente</a>
        </div>
      ) : null}
    </div>
  );
}
