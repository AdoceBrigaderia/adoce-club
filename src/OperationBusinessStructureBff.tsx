import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
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
import { bffRpc } from "./services/bff-rpc";
import {
  cashMovementLabels,
  formatBusinessMoney,
  slugifyBusinessCode,
} from "./cash-workspace";
import "./operation-business-structure.css";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  public_label: string;
  address_text: string;
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

type Capability =
  | "sell"
  | "open_cash"
  | "close_cash"
  | "manage_stock"
  | "view_finance"
  | "manage_customers"
  | "manage_orders"
  | "manage_production"
  | "view_reports"
  | "manage_settings";

type AssignmentRow = {
  staff_user_id: string;
  store_id: string;
  active: boolean;
  can_sell: boolean;
  can_open_cash: boolean;
  can_close_cash: boolean;
  can_manage_stock: boolean;
  can_view_finance: boolean;
  can_manage_customers: boolean;
  can_manage_orders: boolean;
  can_manage_production: boolean;
  can_view_reports: boolean;
  can_manage_settings: boolean;
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
  expected_cash: number | string | null;
  counted_cash: number | string | null;
  cash_difference: number | string | null;
  closed_at: string | null;
};

type CashMovementRow = {
  id: string;
  cash_session_id: string;
  store_id: string;
  register_id: string;
  kind: string;
  direction: "in" | "out";
  amount: number | string;
  notes: string;
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

const capabilities: Array<[Capability, keyof AssignmentRow, string]> = [
  ["sell", "can_sell", "Vender"],
  ["open_cash", "can_open_cash", "Abrir caixa"],
  ["close_cash", "can_close_cash", "Fechar caixa"],
  ["manage_stock", "can_manage_stock", "Gerenciar estoque"],
  ["view_finance", "can_view_finance", "Ver financeiro"],
  ["manage_customers", "can_manage_customers", "Clientes e fidelidade"],
  ["manage_orders", "can_manage_orders", "Gerenciar pedidos"],
  ["manage_production", "can_manage_production", "Gerenciar produção"],
  ["view_reports", "can_view_reports", "Consultar relatórios"],
  ["manage_settings", "can_manage_settings", "Alterar configurações"],
];

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  attendant: "Atendimento",
  cashier: "Caixa",
  production: "Produção",
  viewer: "Consulta",
};

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Fortaleza",
      }).format(new Date(value))
    : "—";

function assignmentAllows(
  role: string,
  assignment: AssignmentRow | undefined,
  property: keyof AssignmentRow,
) {
  if (role === "owner" || role === "manager") return true;
  return Boolean(assignment?.active && assignment[property]);
}

export default function OperationBusinessStructureBff({ userId }: { userId: string }) {
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
    try {
      const data = await bffRpc<Workspace>("staff_get_business_workspace");
      const next = data || emptyWorkspace;
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a estrutura da operação.");
    } finally {
      setLoading(false);
    }
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
    (item) => item.staff_user_id === userId && item.store_id === storeId,
  );
  const manager = workspace.role === "owner" || workspace.role === "manager";
  const canOpen = assignmentAllows(workspace.role, currentAssignment, "can_open_cash");
  const canClose = assignmentAllows(workspace.role, currentAssignment, "can_close_cash");
  const sessionMovements = openSession
    ? workspace.movements.filter((item) => item.cash_session_id === openSession.id)
    : [];

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openCash = async (event: FormEvent) => {
    event.preventDefault();
    if (!registerId) return;
    const ok = await run(
      () => bffRpc("staff_open_cash_session", {
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
      () => bffRpc("staff_record_cash_movement", {
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
      () => bffRpc("staff_close_cash_session", {
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
      () => bffRpc("manager_upsert_store", {
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
      () => bffRpc("manager_upsert_cash_register", {
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

  const updateStaff = async (member: StaffRow, role: string, active = member.active) => {
    await run(
      () => bffRpc("manager_update_staff_member", {
        target_user_id: member.user_id,
        next_role: role,
        next_active: active,
      }),
      `Acesso de ${member.display_name} atualizado.`,
    );
  };

  const updateCapability = async (
    member: StaffRow,
    capability: Capability,
    allowed: boolean,
  ) => {
    if (!storeId) return;
    await run(
      () => bffRpc("manager_set_staff_capability", {
        target_user_id: member.user_id,
        target_store_id: storeId,
        capability,
        allowed,
      }),
      `Permissões de ${member.display_name} atualizadas para esta loja.`,
    );
  };

  const recentSessions = workspace.sessions.filter((item) => !storeId || item.store_id === storeId);

  return <section className="business-structure">
    <header className="business-heading">
      <div>
        <small>Estrutura da operação protegida pelo BFF</small>
        <h2>Lojas, caixas, equipe e permissões</h2>
        <p>Os tokens de sessão permanecem em cookies HttpOnly; o navegador envia somente ações autorizadas e o PostgreSQL valida cada permissão.</p>
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
      <label>Loja<select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
        {!stores.length ? <option value="">Nenhuma loja disponível</option> : null}
        {stores.map((item) => <option value={item.id} key={item.id}>{item.name}{item.active ? "" : " — inativa"}</option>)}
      </select></label>
      <label>Caixa<select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
        {!registers.length ? <option value="">Nenhum caixa cadastrado</option> : null}
        {registers.map((item) => <option value={item.id} key={item.id}>{item.name}{item.active ? "" : " — inativo"}</option>)}
      </select></label>
      <span className={openSession ? "is-open" : "is-closed"}>
        {openSession ? <><Check /> Caixa aberto desde {dateTime(openSession.opened_at)}</> : <><LockKeyhole /> Caixa fechado</>}
      </span>
    </div>

    {section === "cash" ? <div className="business-cash-grid">
      <section className="business-card cash-status">
        <header><Banknote /><div><small>Situação atual</small><h3>{currentRegister?.name || "Selecione um caixa"}</h3></div></header>
        <dl>
          <div><dt>Loja</dt><dd>{currentStore?.name || "—"}</dd></div>
          <div><dt>Valor inicial</dt><dd>{formatBusinessMoney(openSession?.opening_float)}</dd></div>
          <div><dt>Dinheiro esperado</dt><dd>{formatBusinessMoney(openSession?.expected_cash)}</dd></div>
          <div><dt>Movimentações</dt><dd>{sessionMovements.length}</dd></div>
        </dl>
      </section>
      {!openSession ? <form className="business-card" onSubmit={openCash}>
        <header><Plus /><div><small>Início do turno</small><h3>Abrir caixa</h3></div></header>
        <label>Fundo inicial em dinheiro<input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(Number(event.target.value))} /></label>
        <label>Observação<textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} /></label>
        <button disabled={busy || !registerId || !canOpen}><Check /> {canOpen ? "Confirmar abertura" : "Sem permissão para abrir"}</button>
      </form> : <>
        <form className="business-card" onSubmit={recordMovement}>
          <header><Banknote /><div><small>Dinheiro físico</small><h3>Movimentar caixa</h3></div></header>
          <label>Tipo<select value={movementKind} onChange={(event) => setMovementKind(event.target.value)}>
            <option value="supply">Suprimento</option><option value="withdrawal">Sangria</option>
            {manager ? <option value="expense">Despesa</option> : null}
            {manager ? <option value="adjustment_in">Ajuste de entrada</option> : null}
            {manager ? <option value="adjustment_out">Ajuste de saída</option> : null}
          </select></label>
          <label>Valor<input type="number" min="0.01" step="0.01" required value={movementAmount || ""} onChange={(event) => setMovementAmount(Number(event.target.value))} /></label>
          <label>Motivo<textarea required value={movementNotes} onChange={(event) => setMovementNotes(event.target.value)} /></label>
          <button disabled={busy || movementAmount <= 0}><Save /> Registrar movimentação</button>
        </form>
        <form className="business-card close-cash" onSubmit={closeCash}>
          <header><LockKeyhole /><div><small>Fim do turno</small><h3>Fechar caixa</h3></div></header>
          <p>Dinheiro esperado: <strong>{formatBusinessMoney(openSession.expected_cash)}</strong></p>
          <label>Dinheiro contado<input type="number" min="0" step="0.01" value={countedCash} onChange={(event) => setCountedCash(Number(event.target.value))} /></label>
          <label>Observação<textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} /></label>
          <button disabled={busy || !canClose}><LockKeyhole /> {canClose ? "Conferir e fechar" : "Sem permissão para fechar"}</button>
        </form>
      </>}
    </div> : null}

    {section === "structure" ? <div className="business-structure-grid">
      <section className="business-card business-list"><header><Store /><div><small>Unidades</small><h3>Lojas cadastradas</h3></div></header>
        {stores.map((item) => <article key={item.id}><span><strong>{item.name}</strong><small>{item.address_text || item.public_label}</small></span><b>{item.active ? "Ativa" : "Inativa"}</b></article>)}
      </section>
      <section className="business-card business-list"><header><WalletCards /><div><small>Terminais</small><h3>Caixas desta loja</h3></div></header>
        {registers.map((item) => <article key={item.id}><span><strong>{item.name}</strong><small>{item.device_label || item.code}</small></span><b>{item.active ? "Ativo" : "Inativo"}</b></article>)}
      </section>
      {manager ? <form className="business-card" onSubmit={saveStore}><header><Plus /><div><small>Expansão</small><h3>Nova loja</h3></div></header>
        <label>Nome<input required value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value, slug: storeForm.slug || slugifyBusinessCode(event.target.value) })} /></label>
        <label>Identificador<input required value={storeForm.slug} onChange={(event) => setStoreForm({ ...storeForm, slug: slugifyBusinessCode(event.target.value) })} /></label>
        <label>Nome para o cliente<input value={storeForm.publicLabel} onChange={(event) => setStoreForm({ ...storeForm, publicLabel: event.target.value })} /></label>
        <label>Endereço<textarea value={storeForm.address} onChange={(event) => setStoreForm({ ...storeForm, address: event.target.value })} /></label>
        <button disabled={busy}><Save /> Criar loja</button>
      </form> : null}
      {manager ? <form className="business-card" onSubmit={saveRegister}><header><Plus /><div><small>Novo terminal</small><h3>Cadastrar caixa</h3></div></header>
        <label>Nome<input required value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value, code: registerForm.code || slugifyBusinessCode(event.target.value) })} /></label>
        <label>Código<input required value={registerForm.code} onChange={(event) => setRegisterForm({ ...registerForm, code: slugifyBusinessCode(event.target.value) })} /></label>
        <label>Dispositivo<input value={registerForm.deviceLabel} onChange={(event) => setRegisterForm({ ...registerForm, deviceLabel: event.target.value })} /></label>
        <button disabled={busy || !storeId}><Save /> Cadastrar nesta loja</button>
      </form> : null}
    </div> : null}

    {section === "team" ? <div className="business-team-list">
      {!manager ? <p className="business-card">Somente proprietários e gerentes podem alterar funções e permissões.</p> : null}
      {workspace.staff.map((member) => {
        const assignment = workspace.assignments.find((item) => item.staff_user_id === member.user_id && item.store_id === storeId);
        return <article className="business-card" key={member.user_id}>
          <header><ShieldCheck /><div><small>{member.phone_e164 || "Equipe Adoce"}</small><h3>{member.display_name}</h3></div><b>{member.active ? "Ativo" : "Inativo"}</b></header>
          <div className="business-role-row"><label>Função<select disabled={!manager || (workspace.role !== "owner" && ["owner", "manager"].includes(member.role))} value={member.role} onChange={(event) => void updateStaff(member, event.target.value)}>
            {Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label className="business-check"><input type="checkbox" disabled={!manager || member.user_id === userId} checked={member.active} onChange={(event) => void updateStaff(member, member.role, event.target.checked)} /><span>Acesso ativo</span></label></div>
          <div className="business-permissions">
            {capabilities.map(([capability, property, label]) => <label className="business-check" key={capability}><input type="checkbox" disabled={!manager || !assignment?.active} checked={Boolean(assignment?.[property])} onChange={(event) => void updateCapability(member, capability, event.target.checked)} /><span>{label}</span></label>)}
          </div>
        </article>;
      })}
    </div> : null}

    {section === "history" ? <div className="business-history">
      <section className="business-card"><header><Clock3 /><div><small>Últimos 45 dias</small><h3>Aberturas e fechamentos</h3></div></header><div className="business-history-list">
        {recentSessions.map((item) => <article key={item.id}><span><strong>{workspace.registers.find((register) => register.id === item.register_id)?.name || "Caixa"}</strong><small>Aberto em {dateTime(item.opened_at)}{item.closed_at ? ` · fechado em ${dateTime(item.closed_at)}` : ""}</small></span><span><b>{item.status}</b><small>Esperado {formatBusinessMoney(item.expected_cash)}</small></span><span><strong>{formatBusinessMoney(item.cash_difference)}</strong><small>diferença</small></span></article>)}
      </div></section>
      <section className="business-card"><header><MinusCircle /><div><small>Auditoria</small><h3>Movimentações recentes</h3></div></header><div className="business-history-list movements">
        {workspace.movements.filter((item) => !storeId || item.store_id === storeId).slice(0, 50).map((item) => <article key={item.id}>{item.direction === "in" ? <Plus /> : <MinusCircle />}<span><strong>{cashMovementLabels[item.kind] || item.kind}</strong><small>{item.notes || dateTime(item.created_at)}</small></span><b className={item.direction === "in" ? "positive" : "negative"}>{item.direction === "in" ? "+" : "−"}{formatBusinessMoney(item.amount)}</b></article>)}
      </div></section>
    </div> : null}
  </section>;
}
