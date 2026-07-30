import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Banknote,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LockKeyhole,
  MinusCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  assignmentAllows,
  cashMovementLabels,
  formatBusinessMoney,
  isManagerRole,
  slugifyBusinessCode,
  type AssignmentCapability,
} from "./cash-workspace";
import "./operation-business-structure.css";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  public_label: string;
  address_text: string;
  pickup_location_id: string | null;
  active: boolean;
};

type RegisterRow = {
  id: string;
  store_id: string;
  code: string;
  name: string;
  device_label: string;
  active: boolean;
};

type AssignmentRow = {
  staff_user_id: string;
  store_id: string;
  active: boolean;
  can_sell: boolean;
  can_open_cash: boolean;
  can_close_cash: boolean;
  can_manage_stock: boolean;
  can_view_finance: boolean;
};

type StaffRow = {
  user_id: string;
  role: string;
  active: boolean;
  display_name: string;
  phone_e164: string | null;
};

type CashSessionRow = {
  id: string;
  store_id: string;
  register_id: string;
  status: "open" | "closed" | "cancelled";
  opened_by: string;
  opened_at: string;
  opening_float: number | string;
  opening_notes: string;
  closed_by: string | null;
  closed_at: string | null;
  expected_cash: number | string | null;
  counted_cash: number | string | null;
  cash_difference: number | string | null;
  closing_notes: string;
};

type CashMovementRow = {
  id: string;
  cash_session_id: string;
  store_id: string;
  register_id: string;
  kind: string;
  direction: "in" | "out";
  payment_method_code: string | null;
  amount: number | string;
  order_id: string | null;
  notes: string;
  created_by: string;
  created_at: string;
};

type Workspace = {
  role: string;
  stores: StoreRow[];
  registers: RegisterRow[];
  assignments: AssignmentRow[];
  staff: StaffRow[];
  sessions: CashSessionRow[];
  movements: CashMovementRow[];
};

type Section = "cash" | "structure" | "team" | "history";

const emptyWorkspace: Workspace = {
  role: "viewer",
  stores: [],
  registers: [],
  assignments: [],
  staff: [],
  sessions: [],
  movements: [],
};

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Fortaleza",
      }).format(new Date(value))
    : "—";

const capabilityLabels: Record<AssignmentCapability, string> = {
  can_sell: "Vender",
  can_open_cash: "Abrir caixa",
  can_close_cash: "Fechar caixa",
  can_manage_stock: "Gerenciar estoque",
  can_view_finance: "Ver financeiro",
};

export default function OperationBusinessStructure({ session }: { session: Session }) {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [section, setSection] = useState<Section>("cash");
  const [storeId, setStoreId] = useState("");
  const [registerId, setRegisterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [openingFloat, setOpeningFloat] = useState(0);
  const [openingNotes, setOpeningNotes] = useState("");
  const [movementKind, setMovementKind] = useState("supply");
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementNotes, setMovementNotes] = useState("");
  const [countedCash, setCountedCash] = useState(0);
  const [closingNotes, setClosingNotes] = useState("");
  const [storeForm, setStoreForm] = useState({ name: "", slug: "", publicLabel: "", address: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", code: "", deviceLabel: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const { data, error } = await requireSupabase().rpc("staff_get_business_workspace");
    setLoading(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const next = (data || emptyWorkspace) as unknown as Workspace;
    setWorkspace({
      ...emptyWorkspace,
      ...next,
      stores: next.stores || [],
      registers: next.registers || [],
      assignments: next.assignments || [],
      staff: next.staff || [],
      sessions: next.sessions || [],
      movements: next.movements || [],
    });
    setStoreId((current) => current || next.stores?.find((item) => item.active)?.id || next.stores?.[0]?.id || "");
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stores = workspace.stores;
  const registers = useMemo(
    () => workspace.registers.filter((item) => item.store_id === storeId),
    [workspace.registers, storeId],
  );

  useEffect(() => {
    if (!registers.some((item) => item.id === registerId)) {
      setRegisterId(registers.find((item) => item.active)?.id || registers[0]?.id || "");
    }
  }, [registerId, registers]);

  const currentStore = stores.find((item) => item.id === storeId) || null;
  const currentRegister = registers.find((item) => item.id === registerId) || null;
  const openSession = workspace.sessions.find(
    (item) => item.register_id === registerId && item.status === "open",
  ) || null;
  const currentAssignment = workspace.assignments.find(
    (item) => item.staff_user_id === session.user.id && item.store_id === storeId,
  );
  const manager = isManagerRole(workspace.role);
  const canOpen = assignmentAllows(workspace.role, currentAssignment, "can_open_cash");
  const canClose = assignmentAllows(workspace.role, currentAssignment, "can_close_cash");
  const sessionMovements = openSession
    ? workspace.movements.filter((item) => item.cash_session_id === openSession.id)
    : [];

  const run = async (action: () => Promise<{ error: { message: string } | null }>, success: string) => {
    setBusy(true);
    setNotice("");
    const result = await action();
    setBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return false;
    }
    setNotice(success);
    await load();
    return true;
  };

  const openCash = async (event: FormEvent) => {
    event.preventDefault();
    if (!registerId) return;
    const ok = await run(
      async () => requireSupabase().rpc("staff_open_cash_session", {
        target_register_id: registerId,
        next_opening_float: openingFloat,
        next_notes: openingNotes,
      }),
      "Caixa aberto. As próximas movimentações já podem ser registradas.",
    );
    if (ok) {
      setOpeningFloat(0);
      setOpeningNotes("");
    }
  };

  const recordMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!openSession) return;
    const ok = await run(
      async () => requireSupabase().rpc("staff_record_cash_movement", {
        target_session_id: openSession.id,
        movement_kind: movementKind,
        requested_payment_method: "cash",
        requested_amount: movementAmount,
        next_notes: movementNotes,
        target_order_id: null,
      }),
      `${cashMovementLabels[movementKind] || "Movimentação"} registrada no caixa.`,
    );
    if (ok) {
      setMovementAmount(0);
      setMovementNotes("");
    }
  };

  const closeCash = async (event: FormEvent) => {
    event.preventDefault();
    if (!openSession) return;
    const ok = await run(
      async () => requireSupabase().rpc("staff_close_cash_session", {
        target_session_id: openSession.id,
        next_counted_cash: countedCash,
        next_notes: closingNotes,
      }),
      "Caixa fechado e diferença registrada no histórico.",
    );
    if (ok) {
      setCountedCash(0);
      setClosingNotes("");
    }
  };

  const saveStore = async (event: FormEvent) => {
    event.preventDefault();
    const slug = storeForm.slug || slugifyBusinessCode(storeForm.name);
    const ok = await run(
      async () => requireSupabase().rpc("manager_upsert_store", {
        target_store_id: null,
        next_name: storeForm.name,
        next_slug: slug,
        next_public_label: storeForm.publicLabel || storeForm.name,
        next_address_text: storeForm.address,
        next_pickup_location_id: null,
        next_active: true,
      }),
      "Loja criada e disponível para receber caixas e equipe.",
    );
    if (ok) setStoreForm({ name: "", slug: "", publicLabel: "", address: "" });
  };

  const saveRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!storeId) return;
    const code = registerForm.code || slugifyBusinessCode(registerForm.name);
    const ok = await run(
      async () => requireSupabase().rpc("manager_upsert_cash_register", {
        target_register_id: null,
        target_store_id: storeId,
        next_name: registerForm.name,
        next_code: code,
        next_device_label: registerForm.deviceLabel,
        next_active: true,
      }),
      "Caixa cadastrado nesta loja.",
    );
    if (ok) setRegisterForm({ name: "", code: "", deviceLabel: "" });
  };

  const updateStaff = async (member: StaffRow, next: Partial<Pick<StaffRow, "role" | "active">>) => {
    await run(
      async () => requireSupabase().rpc("manager_update_staff_member", {
        target_user_id: member.user_id,
        next_role: next.role ?? member.role,
        next_active: next.active ?? member.active,
      }),
      `Acesso de ${member.display_name} atualizado.`,
    );
  };

  const updateAssignment = async (
    member: StaffRow,
    capability: AssignmentCapability | "active",
    checked: boolean,
  ) => {
    if (!storeId) return;
    const current = workspace.assignments.find(
      (item) => item.staff_user_id === member.user_id && item.store_id === storeId,
    ) || {
      staff_user_id: member.user_id,
      store_id: storeId,
      active: true,
      can_sell: false,
      can_open_cash: false,
      can_close_cash: false,
      can_manage_stock: false,
      can_view_finance: false,
    };
    const next = { ...current, [capability]: checked };
    await run(
      async () => requireSupabase().rpc("manager_set_staff_store_assignment", {
        target_user_id: member.user_id,
        target_store_id: storeId,
        next_active: next.active,
        next_can_sell: next.can_sell,
        next_can_open_cash: next.can_open_cash,
        next_can_close_cash: next.can_close_cash,
        next_can_manage_stock: next.can_manage_stock,
        next_can_view_finance: next.can_view_finance,
      }),
      `Permissões de ${member.display_name} atualizadas para esta loja.`,
    );
  };

  const recentSessions = workspace.sessions.filter((item) => !storeId || item.store_id === storeId);

  return <section className="business-structure">
    <header className="business-heading">
      <div>
        <small>Estrutura da operação</small>
        <h2>Lojas, caixas, equipe e permissões</h2>
        <p>Abra e feche o caixa, registre sangrias e suprimentos e defina exatamente quem pode operar em cada loja.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading || busy}>
        <RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}
      </button>
    </header>

    {notice ? <p className="business-notice" role="status">{notice}</p> : null}

    <nav className="business-tabs" aria-label="Áreas da estrutura operacional">
      <button className={section === "cash" ? "active" : ""} onClick={() => setSection("cash")}><WalletCards /> Caixa atual</button>
      <button className={section === "structure" ? "active" : ""} onClick={() => setSection("structure")}><Building2 /> Lojas e caixas</button>
      <button className={section === "team" ? "active" : ""} onClick={() => setSection("team")}><Users /> Equipe</button>
      <button className={section === "history" ? "active" : ""} onClick={() => setSection("history")}><Clock3 /> Histórico</button>
    </nav>

    <div className="business-context">
      <label>Loja
        <select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
          {!stores.length ? <option value="">Nenhuma loja disponível</option> : null}
          {stores.map((item) => <option value={item.id} key={item.id}>{item.name}{item.active ? "" : " — inativa"}</option>)}
        </select>
      </label>
      <label>Caixa
        <select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
          {!registers.length ? <option value="">Nenhum caixa cadastrado</option> : null}
          {registers.map((item) => <option value={item.id} key={item.id}>{item.name}{item.active ? "" : " — inativo"}</option>)}
        </select>
      </label>
      <span className={openSession ? "is-open" : "is-closed"}>
        {openSession ? <><Check /> Caixa aberto desde {dateTime(openSession.opened_at)}</> : <><LockKeyhole /> Caixa fechado</>}
      </span>
    </div>

    {section === "cash" ? <div className="business-cash-grid">
      <section className="business-card cash-status">
        <header><Banknote /><div><small>Situação atual</small><h3>{currentRegister?.name || "Selecione um caixa"}</h3></div></header>
        <dl>
          <div><dt>Loja</dt><dd>{currentStore?.name || "—"}</dd></div>
          <div><dt>Operador</dt><dd>{workspace.staff.find((item) => item.user_id === openSession?.opened_by)?.display_name || (openSession ? "Equipe Adoce" : "—")}</dd></div>
          <div><dt>Valor inicial</dt><dd>{formatBusinessMoney(openSession?.opening_float)}</dd></div>
          <div><dt>Dinheiro esperado</dt><dd>{formatBusinessMoney(openSession?.expected_cash)}</dd></div>
          <div><dt>Movimentações</dt><dd>{sessionMovements.length}</dd></div>
        </dl>
      </section>

      {!openSession ? <form className="business-card" onSubmit={openCash}>
        <header><Plus /><div><small>Início do turno</small><h3>Abrir caixa</h3></div></header>
        <label>Fundo inicial em dinheiro<input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(Number(event.target.value))} /></label>
        <label>Observação<textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Ex.: troco conferido no início do turno" /></label>
        <button disabled={busy || !registerId || !canOpen}><Check /> {canOpen ? "Confirmar abertura" : "Sem permissão para abrir"}</button>
      </form> : <>
        <form className="business-card" onSubmit={recordMovement}>
          <header><CircleDollarSign /><div><small>Dinheiro físico</small><h3>Movimentar caixa</h3></div></header>
          <label>Tipo<select value={movementKind} onChange={(event) => setMovementKind(event.target.value)}>
            <option value="supply">Suprimento</option>
            <option value="withdrawal">Sangria</option>
            {manager ? <option value="expense">Despesa</option> : null}
            {manager ? <option value="adjustment_in">Ajuste de entrada</option> : null}
            {manager ? <option value="adjustment_out">Ajuste de saída</option> : null}
          </select></label>
          <label>Valor<input type="number" min="0.01" step="0.01" required value={movementAmount || ""} onChange={(event) => setMovementAmount(Number(event.target.value))} /></label>
          <label>Motivo<textarea required value={movementNotes} onChange={(event) => setMovementNotes(event.target.value)} placeholder="Registre o motivo para a conferência" /></label>
          <button disabled={busy || movementAmount <= 0}><Save /> Registrar movimentação</button>
        </form>
        <form className="business-card close-cash" onSubmit={closeCash}>
          <header><LockKeyhole /><div><small>Fim do turno</small><h3>Fechar caixa</h3></div></header>
          <p>Dinheiro esperado: <strong>{formatBusinessMoney(openSession.expected_cash)}</strong></p>
          <label>Dinheiro contado<input type="number" min="0" step="0.01" value={countedCash} onChange={(event) => setCountedCash(Number(event.target.value))} /></label>
          <label>Observação<textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Explique diferenças ou ocorrências do turno" /></label>
          <button disabled={busy || !canClose}><LockKeyhole /> {canClose ? "Conferir e fechar" : "Sem permissão para fechar"}</button>
        </form>
      </>}
    </div> : null}

    {section === "structure" ? <div className="business-structure-grid">
      <section className="business-card business-list">
        <header><Store /><div><small>Unidades</small><h3>Lojas cadastradas</h3></div></header>
        {stores.map((item) => <article key={item.id}><span><strong>{item.name}</strong><small>{item.address_text || item.public_label || "Endereço não informado"}</small></span><b>{item.active ? "Ativa" : "Inativa"}</b></article>)}
        {!stores.length ? <p>Nenhuma loja cadastrada.</p> : null}
      </section>
      <section className="business-card business-list">
        <header><WalletCards /><div><small>Terminais</small><h3>Caixas desta loja</h3></div></header>
        {registers.map((item) => <article key={item.id}><span><strong>{item.name}</strong><small>{item.device_label || item.code}</small></span><b>{item.active ? "Ativo" : "Inativo"}</b></article>)}
        {!registers.length ? <p>Nenhum caixa cadastrado nesta loja.</p> : null}
      </section>
      {manager ? <form className="business-card" onSubmit={saveStore}>
        <header><Plus /><div><small>Expansão</small><h3>Nova loja</h3></div></header>
        <label>Nome<input required value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value, slug: storeForm.slug || slugifyBusinessCode(event.target.value) })} /></label>
        <label>Identificador<input required value={storeForm.slug} onChange={(event) => setStoreForm({ ...storeForm, slug: slugifyBusinessCode(event.target.value) })} /></label>
        <label>Nome para o cliente<input value={storeForm.publicLabel} onChange={(event) => setStoreForm({ ...storeForm, publicLabel: event.target.value })} /></label>
        <label>Endereço<textarea value={storeForm.address} onChange={(event) => setStoreForm({ ...storeForm, address: event.target.value })} /></label>
        <button disabled={busy}><Save /> Criar loja</button>
      </form> : null}
      {manager ? <form className="business-card" onSubmit={saveRegister}>
        <header><Plus /><div><small>Novo terminal</small><h3>Cadastrar caixa</h3></div></header>
        <label>Nome<input required value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value, code: registerForm.code || slugifyBusinessCode(event.target.value) })} /></label>
        <label>Código<input required value={registerForm.code} onChange={(event) => setRegisterForm({ ...registerForm, code: slugifyBusinessCode(event.target.value) })} /></label>
        <label>Dispositivo<input value={registerForm.deviceLabel} onChange={(event) => setRegisterForm({ ...registerForm, deviceLabel: event.target.value })} placeholder="Ex.: Tablet do balcão" /></label>
        <button disabled={busy || !storeId}><Save /> Cadastrar nesta loja</button>
      </form> : null}
    </div> : null}

    {section === "team" ? <div className="business-team-list">
      {!manager ? <p className="business-card">Somente proprietários e gerentes podem alterar funções e permissões.</p> : null}
      {workspace.staff.map((member) => {
        const assignment = workspace.assignments.find((item) => item.staff_user_id === member.user_id && item.store_id === storeId);
        return <article className="business-card" key={member.user_id}>
          <header><ShieldCheck /><div><small>{member.phone_e164 || "Equipe Adoce"}</small><h3>{member.display_name}</h3></div><b>{member.active ? "Ativo" : "Inativo"}</b></header>
          <div className="business-role-row">
            <label>Função<select disabled={!manager || (workspace.role !== "owner" && ["owner", "manager"].includes(member.role))} value={member.role} onChange={(event) => void updateStaff(member, { role: event.target.value })}>
              <option value="owner">Proprietário</option><option value="manager">Gerente</option><option value="attendant">Atendimento</option><option value="viewer">Consulta</option>
            </select></label>
            <label className="business-check"><input type="checkbox" disabled={!manager || member.user_id === session.user.id} checked={member.active} onChange={(event) => void updateStaff(member, { active: event.target.checked })} /><span>Acesso ativo</span></label>
          </div>
          <div className="business-permissions">
            <label className="business-check"><input type="checkbox" disabled={!manager} checked={Boolean(assignment?.active)} onChange={(event) => void updateAssignment(member, "active", event.target.checked)} /><span>Vinculado à loja</span></label>
            {(Object.keys(capabilityLabels) as AssignmentCapability[]).map((capability) => <label className="business-check" key={capability}><input type="checkbox" disabled={!manager || !assignment?.active} checked={Boolean(assignment?.[capability])} onChange={(event) => void updateAssignment(member, capability, event.target.checked)} /><span>{capabilityLabels[capability]}</span></label>)}
          </div>
        </article>;
      })}
    </div> : null}

    {section === "history" ? <div className="business-history">
      <section className="business-card">
        <header><Clock3 /><div><small>Últimos 45 dias</small><h3>Aberturas e fechamentos</h3></div></header>
        <div className="business-history-list">
          {recentSessions.map((item) => <article key={item.id}>
            <span><strong>{workspace.registers.find((register) => register.id === item.register_id)?.name || "Caixa"}</strong><small>Aberto em {dateTime(item.opened_at)}{item.closed_at ? ` · fechado em ${dateTime(item.closed_at)}` : ""}</small></span>
            <span><b>{item.status === "open" ? "Aberto" : item.status === "closed" ? "Fechado" : "Cancelado"}</b><small>Esperado {formatBusinessMoney(item.expected_cash)}</small></span>
            <span className={Number(item.cash_difference || 0) === 0 ? "balanced" : "different"}><strong>{formatBusinessMoney(item.cash_difference)}</strong><small>diferença</small></span>
          </article>)}
          {!recentSessions.length ? <p>Nenhuma abertura registrada ainda.</p> : null}
        </div>
      </section>
      <section className="business-card">
        <header><ChevronRight /><div><small>Auditoria</small><h3>Movimentações recentes</h3></div></header>
        <div className="business-history-list movements">
          {workspace.movements.filter((item) => !storeId || item.store_id === storeId).slice(0, 50).map((item) => <article key={item.id}>
            {item.direction === "in" ? <Plus /> : <MinusCircle />}
            <span><strong>{cashMovementLabels[item.kind] || item.kind}</strong><small>{item.notes || dateTime(item.created_at)}</small></span>
            <b className={item.direction === "in" ? "positive" : "negative"}>{item.direction === "in" ? "+" : "−"}{formatBusinessMoney(item.amount)}</b>
          </article>)}
          {!workspace.movements.length ? <p>Nenhuma movimentação registrada.</p> : null}
        </div>
      </section>
    </div> : null}
  </section>;
}
