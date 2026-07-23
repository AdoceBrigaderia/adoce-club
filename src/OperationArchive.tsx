import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarX,
  RefreshCw,
  Search,
  ShoppingBag,
  UserRoundX,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-archive.css";

type ArchiveCategory = "all" | "requests" | "orders" | "groups" | "customers" | "calendar";

type ArchiveRecord = {
  id: string;
  category: Exclude<ArchiveCategory, "all">;
  title: string;
  subtitle: string;
  status: string;
  occurredAt: string;
  reason: string;
  actorId?: string | null;
};

type CustomerAccountActionRow = {
  profile_id: string;
  actor_user_id: string;
  reason_code: string;
  reason_note: string | null;
  resulting_status: string;
  created_at: string;
};

const categoryLabels: Record<ArchiveRecord["category"], string> = {
  requests: "Pedidos e pré-reservas",
  orders: "Pedidos de fatias",
  groups: "Pede Junto",
  customers: "Cadastros",
  calendar: "Agenda",
};

const statusLabels: Record<string, string> = {
  completed: "Concluído",
  cancelled: "Cancelado",
  expired: "Prazo encerrado",
  deactivated: "Desativado",
  pending_deletion: "Aguardando decisão",
  merged: "Cadastro unificado",
  anonymized: "Dados pessoais removidos",
};

const reasonLabels: Record<string, string> = {
  duplicate_registration: "Cadastro duplicado",
  customer_request: "Solicitação do cliente",
  created_by_mistake: "Cadastro criado por engano",
  security_review: "Revisão de segurança",
  terms_violation: "Descumprimento dos termos",
  legal_requirement: "Obrigação legal",
  other: "Outro motivo",
};

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
}).format(new Date(value));

const cancellationNote = (notes: string | null | undefined) => {
  const matches = [...(notes || "").matchAll(/\[Cancelamento[^\]]*\]\s*([^\n]+)/gi)];
  return matches.at(-1)?.[1]?.trim() || "Cancelamento registrado pela equipe.";
};

export default function OperationArchive() {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<ArchiveCategory>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setNotice("");
    const supabase = requireSupabase();
    const [requests, orders, groups, profiles, actions, blocks, staff] = await Promise.all([
      supabase.from("service_requests")
        .select("id,request_number,customer_name,customer_phone,status,internal_notes,updated_at,updated_by,commercial_products(name)")
        .in("status", ["completed", "cancelled", "expired"])
        .order("updated_at", { ascending: false }).limit(300),
      supabase.from("instant_orders")
        .select("id,order_number,customer_name,customer_phone,status,cancellation_reason,updated_at,updated_by")
        .in("status", ["completed", "cancelled", "expired"])
        .order("updated_at", { ascending: false }).limit(300),
      supabase.from("pede_junto_groups")
        .select("id,public_code,name,organizer_name,status,cancellation_reason,updated_at,archived_at,archived_by")
        .in("status", ["completed", "cancelled", "expired"])
        .order("updated_at", { ascending: false }).limit(200),
      supabase.from("profiles")
        .select("id,full_name,phone_e164,email,member_code,account_status,status_reason_code,status_reason_note,updated_at")
        .order("updated_at", { ascending: false }).limit(1500),
      supabase.from("customer_account_actions")
        .select("profile_id,actor_user_id,reason_code,reason_note,resulting_status,created_at")
        .order("created_at", { ascending: false }).limit(1000),
      supabase.from("calendar_blocks")
        .select("id,title,notes,status,updated_at,updated_by")
        .eq("status", "cancelled").order("updated_at", { ascending: false }).limit(200),
      supabase.from("staff_members").select("user_id").eq("active", true),
    ]);

    const firstError = [requests, orders, groups, profiles, actions, blocks, staff].find((result) => result.error)?.error;
    if (firstError) {
      setNotice(`Não foi possível carregar todo o histórico: ${firstError.message}`);
      setBusy(false);
      return;
    }

    const staffIds = new Set((staff.data || []).map((item) => item.user_id));
    const profileRows = profiles.data || [];
    setStaffNames(Object.fromEntries(profileRows
      .filter((profile) => staffIds.has(profile.id))
      .map((profile) => [profile.id, profile.full_name || "Equipe Adoce"])));

    const latestAction = new Map<string, CustomerAccountActionRow>();
    ((actions.data || []) as CustomerAccountActionRow[]).forEach((action) => {
      if (!latestAction.has(action.profile_id)) latestAction.set(action.profile_id, action);
    });

    const next: ArchiveRecord[] = [];
    (requests.data || []).forEach((request) => {
      const relation = request.commercial_products as unknown as { name?: string } | Array<{ name?: string }> | null;
      const productName = (Array.isArray(relation) ? relation[0]?.name : relation?.name) || "Solicitação";
      next.push({
        id: `request-${request.id}`,
        category: "requests",
        title: `${request.request_number} · ${request.customer_name}`,
        subtitle: `${productName} · ${request.customer_phone}`,
        status: request.status,
        occurredAt: request.updated_at,
        reason: request.status === "cancelled" ? cancellationNote(request.internal_notes) : request.status === "expired" ? "O prazo da solicitação foi encerrado." : "Atendimento concluído.",
        actorId: request.updated_by,
      });
    });
    (orders.data || []).forEach((order) => next.push({
      id: `order-${order.id}`,
      category: "orders",
      title: `${order.order_number} · ${order.customer_name}`,
      subtitle: order.customer_phone,
      status: order.status,
      occurredAt: order.updated_at,
      reason: order.cancellation_reason || (order.status === "completed" ? "Pedido entregue." : "Prazo da reserva encerrado."),
      actorId: order.updated_by,
    }));
    (groups.data || []).forEach((group) => next.push({
      id: `group-${group.id}`,
      category: "groups",
      title: `${group.public_code} · ${group.name}`,
      subtitle: `Organizador: ${group.organizer_name}`,
      status: group.status,
      occurredAt: group.archived_at || group.updated_at,
      reason: group.cancellation_reason || (group.status === "completed" ? "Grupo entregue e encerrado." : "Prazo do grupo encerrado."),
      actorId: group.archived_by,
    }));
    profileRows
      .filter((profile) =>
        !staffIds.has(profile.id)
        && !["active", "pending_deletion"].includes(profile.account_status)
      )
      .forEach((profile) => {
        const action = latestAction.get(profile.id);
        const privacySafeName = profile.account_status === "anonymized"
          ? `Cadastro anonimizado · ${profile.member_code || profile.id.slice(0, 8)}`
          : profile.full_name;
        next.push({
          id: `customer-${profile.id}`,
          category: "customers",
          title: privacySafeName || "Cadastro sem dados pessoais",
          subtitle: profile.account_status === "anonymized" ? "Os dados pessoais já foram removidos." : (profile.phone_e164 || profile.email || profile.member_code || "Sem contato disponível"),
          status: profile.account_status,
          occurredAt: action?.created_at || profile.updated_at,
          reason: action?.reason_note || profile.status_reason_note || reasonLabels[action?.reason_code || profile.status_reason_code || ""] || "Alteração de cadastro registrada.",
          actorId: action?.actor_user_id,
        });
      });
    (blocks.data || []).forEach((block) => next.push({
      id: `calendar-${block.id}`,
      category: "calendar",
      title: block.title,
      subtitle: "Compromisso retirado da agenda",
      status: block.status,
      occurredAt: block.updated_at,
      reason: block.notes || "Cancelamento registrado pela equipe.",
      actorId: block.updated_by,
    }));

    setRecords(next.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)));
    setBusy(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return records.filter((record) => (category === "all" || record.category === category)
      && (!term || `${record.title} ${record.subtitle} ${record.reason}`.toLocaleLowerCase("pt-BR").includes(term)));
  }, [category, records, search]);

  const icon = (recordCategory: ArchiveRecord["category"]) => {
    if (recordCategory === "orders") return <ShoppingBag />;
    if (recordCategory === "groups") return <Users />;
    if (recordCategory === "customers") return <UserRoundX />;
    if (recordCategory === "calendar") return <CalendarX />;
    return <Archive />;
  };

  return <section className="operation-archive">
    <header>
      <div><span>Registros preservados</span><h1>Histórico e arquivados</h1><p>O que foi concluído, cancelado ou retirado das listas de trabalho fica organizado somente aqui.</p></div>
      <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw /> Atualizar</button>
    </header>
    <div className="operation-archive-summary">
      <strong><b>{records.length}</b><span>registros preservados</span></strong>
      {(["requests", "orders", "groups", "customers"] as const).map((key) => <span key={key}><b>{records.filter((record) => record.category === key).length}</b>{categoryLabels[key]}</span>)}
    </div>
    <div className="operation-archive-tools">
      <div role="group" aria-label="Filtrar histórico">
        {(["all", "requests", "orders", "groups", "customers", "calendar"] as ArchiveCategory[]).map((key) => <button type="button" key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{key === "all" ? "Tudo" : categoryLabels[key]}</button>)}
      </div>
      <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no histórico" /></label>
    </div>
    {notice ? <p className="operation-archive-notice" role="alert">{notice}</p> : null}
    <div className="operation-archive-list">
      {filtered.map((record) => <article key={record.id}>
        <div className="operation-archive-icon">{icon(record.category)}</div>
        <div className="operation-archive-copy"><small>{categoryLabels[record.category]}</small><strong>{record.title}</strong><span>{record.subtitle}</span><p><b>Motivo:</b> {record.reason}</p></div>
        <div className="operation-archive-meta"><b>{statusLabels[record.status] || record.status}</b><time>{dateTime(record.occurredAt)}</time><small>Responsável: {record.actorId ? staffNames[record.actorId] || "Equipe Adoce" : "Sistema"}</small></div>
      </article>)}
      {!busy && !filtered.length ? <div className="operation-archive-empty"><Archive /><strong>Nenhum registro neste filtro.</strong><span>As listas operacionais continuam limpas e somente itens encerrados aparecem aqui.</span></div> : null}
    </div>
  </section>;
}
