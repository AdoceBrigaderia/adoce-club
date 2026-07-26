import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Heart,
  History,
  MessageCircle,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-customer-360.css";

type CustomerSearchRow = {
  profile_id: string;
  account_id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  current_progress: number;
  completed_cards: number;
  available_rewards: number;
};

type Customer360 = {
  profile: {
    id: string;
    full_name: string;
    member_code: string | null;
    phone_e164: string | null;
    email: string | null;
    active: boolean;
    account_status: string;
    whatsapp_verified: boolean;
    created_at: string;
    updated_at: string;
  };
  loyalty: {
    account_id: string | null;
    current_progress: number;
    completed_cards: number;
    available_rewards: number;
    referral_progress: number;
    referral_completed_cards: number;
  };
  summary: {
    orders_count: number;
    approved_orders: number;
    total_spent: number;
    last_order_at: string | null;
    last_checkin_at: string | null;
  };
  consents: Record<string, boolean>;
  preferences: Record<string, unknown>;
  tags: string[];
  notes: Array<{
    id: string;
    note_type: "note" | "contact" | "preference" | "issue";
    body: string;
    pinned: boolean;
    created_at: string;
    updated_at: string;
  }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    total: number;
    payment_method_label: string | null;
    sales_channel: string | null;
    pickup_label: string | null;
    created_at: string;
  }>;
  recent_movements: Array<{
    id: string;
    reason: string;
    stamps_delta: number;
    resulting_progress: number;
    resulting_completed_cards: number;
    created_at: string;
  }>;
  recent_checkins: Array<{
    id: string;
    status: string;
    store_name: string;
    created_at: string;
    claimed_at: string | null;
    expires_at: string;
  }>;
};

const quickTags = ["frequente", "vip", "prefere retirada", "atenção", "adora novidades"];
const noteLabels = {
  note: "Anotação",
  contact: "Contato",
  preference: "Preferência",
  issue: "Pendência",
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const dateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Ainda não registrado";

const phoneForLink = (value: string | null) => (value || "").replace(/\D/g, "");

export default function OperationCustomer360() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] = useState<Customer360 | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [notice, setNotice] = useState("");
  const [noteType, setNoteType] = useState<keyof typeof noteLabels>("note");
  const [noteBody, setNoteBody] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const searchCustomers = useCallback(async (searchText = query) => {
    setLoadingSearch(true);
    try {
      const data = await bffRpc<CustomerSearchRow[]>("staff_search_customers", {
        search_text: searchText,
      });
      const normalized = (data || []).map((item) => ({
        ...item,
        current_progress: Number(item.current_progress || 0),
        completed_cards: Number(item.completed_cards || 0),
        available_rewards: Number(item.available_rewards || 0),
      }));
      setResults(normalized);
      if (!selectedId && normalized.length === 1) setSelectedId(normalized[0].profile_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível buscar clientes.");
    } finally {
      setLoadingSearch(false);
    }
  }, [query, selectedId]);

  const loadWorkspace = useCallback(async (profileId: string) => {
    if (!profileId) {
      setWorkspace(null);
      return;
    }
    setLoadingWorkspace(true);
    setNotice("");
    try {
      const data = await bffRpc<Customer360>("staff_get_customer_360", {
        target_profile_id: profileId,
      });
      setWorkspace({
        ...data,
        loyalty: {
          ...data.loyalty,
          current_progress: Number(data.loyalty?.current_progress || 0),
          completed_cards: Number(data.loyalty?.completed_cards || 0),
          available_rewards: Number(data.loyalty?.available_rewards || 0),
          referral_progress: Number(data.loyalty?.referral_progress || 0),
          referral_completed_cards: Number(data.loyalty?.referral_completed_cards || 0),
        },
        summary: {
          ...data.summary,
          orders_count: Number(data.summary?.orders_count || 0),
          approved_orders: Number(data.summary?.approved_orders || 0),
          total_spent: Number(data.summary?.total_spent || 0),
        },
        tags: data.tags || [],
        notes: data.notes || [],
        recent_orders: data.recent_orders || [],
        recent_movements: data.recent_movements || [],
        recent_checkins: data.recent_checkins || [],
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir o Cliente 360°.");
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void searchCustomers(query), query.trim() ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [query, searchCustomers]);

  useEffect(() => {
    void loadWorkspace(selectedId);
  }, [selectedId, loadWorkspace]);

  const whatsappLink = useMemo(() => {
    const phone = phoneForLink(workspace?.profile.phone_e164 || null);
    if (!phone) return "";
    const message = encodeURIComponent(`Olá, ${workspace?.profile.full_name.split(" ")[0] || ""}! Aqui é da Adoce Brigaderia.`);
    return `https://wa.me/${phone}?text=${message}`;
  }, [workspace]);

  const saveNote = async () => {
    if (!workspace || busy) return;
    if (noteBody.trim().length < 3) {
      setNotice("Escreva pelo menos três caracteres na anotação.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await bffRpc("staff_add_customer_crm_note", {
        target_profile_id: workspace.profile.id,
        requested_type: noteType,
        requested_body: noteBody.trim(),
        requested_pinned: notePinned,
      });
      setNoteBody("");
      setNotePinned(false);
      setNotice("Anotação salva no histórico do cliente.");
      await loadWorkspace(workspace.profile.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a anotação.");
    } finally {
      setBusy(false);
    }
  };

  const setTag = async (tag: string, enabled: boolean) => {
    if (!workspace || busy || tag.trim().length < 2) return;
    setBusy(true);
    setNotice("");
    try {
      await bffRpc("staff_set_customer_crm_tag", {
        target_profile_id: workspace.profile.id,
        requested_tag: tag.trim(),
        enabled,
      });
      setTagInput("");
      await loadWorkspace(workspace.profile.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível atualizar a etiqueta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="customer-360" aria-label="CRM Cliente 360 graus">
      <header className="customer-360-heading">
        <div>
          <small>Relacionamento completo sem trocar de tela</small>
          <h2>Cliente 360°</h2>
          <p>Dados, carimbos, pedidos, preferências, check-ins e anotações em um só lugar.</p>
        </div>
        <UserRound aria-hidden="true" />
      </header>

      {notice ? <p className="customer-360-notice" role="status">{notice}</p> : null}

      <div className="customer-360-shell">
        <aside className="customer-360-search">
          <label>
            Localizar cliente
            <span>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, WhatsApp ou e-mail"
                autoComplete="off"
              />
              <button type="button" onClick={() => void searchCustomers()} aria-label="Atualizar busca">
                <RefreshCw />
              </button>
            </span>
          </label>
          <div className="customer-360-results" aria-busy={loadingSearch}>
            {loadingSearch ? <p>Buscando…</p> : null}
            {!loadingSearch && !results.length ? <p>Nenhum cliente encontrado.</p> : null}
            {results.map((customer) => (
              <button
                type="button"
                key={customer.profile_id}
                className={selectedId === customer.profile_id ? "active" : ""}
                onClick={() => setSelectedId(customer.profile_id)}
              >
                <span className="customer-360-avatar">{customer.full_name.slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{customer.full_name}</strong>
                  <small>{customer.phone_e164 || customer.email || "Sem contato"}</small>
                </span>
                <b>{customer.current_progress}/14</b>
              </button>
            ))}
          </div>
        </aside>

        <div className="customer-360-workspace" aria-busy={loadingWorkspace}>
          {loadingWorkspace ? <p className="customer-360-empty">Carregando visão completa…</p> : null}
          {!loadingWorkspace && !workspace ? (
            <div className="customer-360-empty">
              <Heart />
              <strong>Selecione um cliente</strong>
              <span>A visão completa será aberta aqui.</span>
            </div>
          ) : null}

          {!loadingWorkspace && workspace ? (
            <>
              <section className="customer-360-profile-card">
                <div className="customer-360-profile-main">
                  <span className="customer-360-avatar large">{workspace.profile.full_name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <small>Cliente desde {dateTime(workspace.profile.created_at)}</small>
                    <h3>{workspace.profile.full_name}</h3>
                    <p>{workspace.profile.phone_e164 || "Sem WhatsApp"} · {workspace.profile.email || "Sem e-mail"}</p>
                    <div className="customer-360-statuses">
                      <span className={workspace.profile.whatsapp_verified ? "ok" : "warning"}>
                        {workspace.profile.whatsapp_verified ? <BadgeCheck /> : <MessageCircle />}
                        WhatsApp {workspace.profile.whatsapp_verified ? "verificado" : "pendente"}
                      </span>
                      <span className={workspace.profile.active ? "ok" : "warning"}>
                        <CheckCircle2 /> {workspace.profile.account_status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="customer-360-profile-actions">
                  {whatsappLink ? (
                    <a href={whatsappLink} target="_blank" rel="noreferrer">
                      <MessageCircle /> Abrir WhatsApp
                    </a>
                  ) : null}
                  <button type="button" onClick={() => void loadWorkspace(workspace.profile.id)}>
                    <RefreshCw /> Atualizar
                  </button>
                </div>
              </section>

              <section className="customer-360-metrics">
                <article><Heart /><span><small>Carimbos</small><strong>{workspace.loyalty.current_progress}/14</strong></span></article>
                <article><BadgeCheck /><span><small>Prêmios</small><strong>{workspace.loyalty.available_rewards}</strong></span></article>
                <article><ClipboardList /><span><small>Pedidos</small><strong>{workspace.summary.orders_count}</strong></span></article>
                <article><CircleDollarSign /><span><small>Total registrado</small><strong>{money(workspace.summary.total_spent)}</strong></span></article>
              </section>

              <section className="customer-360-tags">
                <header><Tag /><div><h3>Etiquetas rápidas</h3><p>Ajude vocês dois a reconhecer preferências e prioridades.</p></div></header>
                <div className="customer-360-tag-list">
                  {workspace.tags.map((tag) => (
                    <button type="button" key={tag} onClick={() => void setTag(tag, false)} disabled={busy}>
                      {tag} <X />
                    </button>
                  ))}
                  {quickTags.filter((tag) => !workspace.tags.includes(tag)).map((tag) => (
                    <button type="button" className="suggested" key={tag} onClick={() => void setTag(tag, true)} disabled={busy}>
                      <Plus /> {tag}
                    </button>
                  ))}
                </div>
                <div className="customer-360-tag-input">
                  <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Outra etiqueta" maxLength={40} />
                  <button type="button" onClick={() => void setTag(tagInput, true)} disabled={busy || tagInput.trim().length < 2}>Adicionar</button>
                </div>
              </section>

              <div className="customer-360-columns">
                <section className="customer-360-notes">
                  <header><NotebookPen /><div><h3>Anotações internas</h3><p>Visíveis somente para a equipe autorizada.</p></div></header>
                  <div className="customer-360-note-form">
                    <select value={noteType} onChange={(event) => setNoteType(event.target.value as keyof typeof noteLabels)}>
                      {Object.entries(noteLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                    <textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Ex.: prefere calda de chocolate meio amargo" maxLength={2000} />
                    <label><input type="checkbox" checked={notePinned} onChange={(event) => setNotePinned(event.target.checked)} /> Fixar no topo</label>
                    <button type="button" onClick={() => void saveNote()} disabled={busy || noteBody.trim().length < 3}>Salvar anotação</button>
                  </div>
                  <div className="customer-360-note-list">
                    {workspace.notes.length ? workspace.notes.map((note) => (
                      <article className={note.pinned ? "pinned" : ""} key={note.id}>
                        <span>{noteLabels[note.note_type]}</span>
                        <p>{note.body}</p>
                        <small>{dateTime(note.created_at)}{note.pinned ? " · Fixada" : ""}</small>
                      </article>
                    )) : <p>Nenhuma anotação registrada.</p>}
                  </div>
                </section>

                <section className="customer-360-history">
                  <header><History /><div><h3>Histórico recente</h3><p>Pedidos, carimbos e visitas.</p></div></header>
                  <details open>
                    <summary>Pedidos ({workspace.recent_orders.length})</summary>
                    <div>
                      {workspace.recent_orders.length ? workspace.recent_orders.map((order) => (
                        <article key={order.id}>
                          <span><strong>{order.order_number || "Pedido"}</strong><small>{dateTime(order.created_at)}</small></span>
                          <span><b>{money(order.total)}</b><small>{order.payment_method_label || order.payment_status}</small></span>
                        </article>
                      )) : <p>Nenhum pedido localizado pelo WhatsApp deste cadastro.</p>}
                    </div>
                  </details>
                  <details>
                    <summary>Carimbos ({workspace.recent_movements.length})</summary>
                    <div>
                      {workspace.recent_movements.map((movement) => (
                        <article key={movement.id}>
                          <span><strong>{movement.reason}</strong><small>{dateTime(movement.created_at)}</small></span>
                          <b className={movement.stamps_delta >= 0 ? "positive" : "negative"}>{movement.stamps_delta > 0 ? "+" : ""}{movement.stamps_delta}</b>
                        </article>
                      ))}
                    </div>
                  </details>
                  <details>
                    <summary>Check-ins ({workspace.recent_checkins.length})</summary>
                    <div>
                      {workspace.recent_checkins.map((checkin) => (
                        <article key={checkin.id}>
                          <span><strong>{checkin.store_name}</strong><small>{dateTime(checkin.created_at)}</small></span>
                          <b>{checkin.status}</b>
                        </article>
                      ))}
                    </div>
                  </details>
                </section>
              </div>

              <section className="customer-360-footer-summary">
                <span><CalendarDays /><small>Último pedido</small><strong>{dateTime(workspace.summary.last_order_at)}</strong></span>
                <span><UserRound /><small>Último check-in</small><strong>{dateTime(workspace.summary.last_checkin_at)}</strong></span>
                <span><MessageCircle /><small>Marketing no WhatsApp</small><strong>{workspace.consents.marketing ? "Autorizado" : "Não autorizado"}</strong></span>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
