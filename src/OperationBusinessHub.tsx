import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  KeyRound,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  defaultStorePermissions,
  expectedCashAmount,
  formatBusinessMoney,
  normalizeBusinessSlug,
  parseMoneyInput,
  roleLabel,
  type StaffRole,
  type StorePermissionSet,
} from "./operation-business-model";
import "./operation-business-hub.css";

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

type StaffRow = {
  user_id: string;
  role: StaffRole;
  active: boolean;
  full_name: string;
};

type AssignmentRow = StorePermissionSet & {
  staff_user_id: string;
  store_id: string;
};

type CashSessionRow = {
  id: string;
  store_id: string;
  register_id: string;
  status: string;
  opened_by: string;
  opened_at: string;
  opening_float: number;
  opening_notes: string;
};

type CashMovementRow = {
  id: string;
  cash_session_id: string;
  kind: string;
  direction: "in" | "out";
  payment_method_code: string | null;
  amount: number;
  notes: string;
  created_at: string;
};

type HubTab = "cash" | "structure" | "team";

const movementLabels: Record<string, string> = {
  sale: "Venda",
  supply: "Suprimento",
  withdrawal: "Sangria",
  refund: "Estorno",
  expense: "Despesa",
  adjustment_in: "Ajuste de entrada",
  adjustment_out: "Ajuste de saída",
};

export default function OperationBusinessHub() {
  const [tab, setTab] = useState<HubTab>("cash");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [registers, setRegisters] = useState<RegisterRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [sessions, setSessions] = useState<CashSessionRow[]>([]);
  const [movements, setMovements] = useState<CashMovementRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [role, setRole] = useState<StaffRole>("viewer");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const [openingFloat, setOpeningFloat] = useState("0,00");
  const [openingNotes, setOpeningNotes] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [movementKind, setMovementKind] = useState<"supply" | "withdrawal">("supply");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storePublicLabel, setStorePublicLabel] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [registerDevice, setRegisterDevice] = useState("");

  const canManage = role === "owner" || role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const supabase = requireSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setNotice(authError?.message || "Não foi possível identificar o usuário da operação.");
      setLoading(false);
      return;
    }
    const userId = authData.user.id;
    setCurrentUserId(userId);

    const [roleResult, storeResult, registerResult, sessionResult, staffResult, assignmentResult] =
      await Promise.all([
        supabase.from("staff_members").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("stores").select("id,slug,name,public_label,address_text,active").order("created_at"),
        supabase.from("cash_registers").select("id,store_id,code,name,device_label,active").order("created_at"),
        supabase.from("cash_sessions").select("id,store_id,register_id,status,opened_by,opened_at,opening_float,opening_notes").eq("status", "open").order("opened_at", { ascending: false }),
        supabase.from("staff_members").select("user_id,role,active").order("created_at"),
        supabase.from("staff_store_assignments").select("staff_user_id,store_id,active,can_sell,can_open_cash,can_close_cash,can_manage_stock,can_view_finance"),
      ]);

    const firstError = roleResult.error || storeResult.error || registerResult.error || sessionResult.error || staffResult.error || assignmentResult.error;
    if (firstError) setNotice(firstError.message);

    const nextRole = (roleResult.data?.role || "viewer") as StaffRole;
    const nextStores = (storeResult.data || []) as StoreRow[];
    const nextRegisters = (registerResult.data || []) as RegisterRow[];
    const nextStaffBase = (staffResult.data || []) as Array<Omit<StaffRow, "full_name">>;
    const profileIds = nextStaffBase.map((member) => member.user_id);
    const { data: profiles, error: profileError } = profileIds.length
      ? await supabase.from("profiles").select("id,full_name").in("id", profileIds)
      : { data: [], error: null };
    if (profileError) setNotice(profileError.message);
    const profileNames = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));

    setRole(nextRole);
    setStores(nextStores);
    setRegisters(nextRegisters);
    setSessions((sessionResult.data || []) as CashSessionRow[]);
    setAssignments((assignmentResult.data || []) as AssignmentRow[]);
    setStaff(nextStaffBase.map((member) => ({
      ...member,
      full_name: profileNames.get(member.user_id) || "Membro da equipe",
    })));
    setSelectedStoreId((current) => nextStores.some((store) => store.id === current) ? current : nextStores[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleRegisters = useMemo(
    () => registers.filter((register) => register.store_id === selectedStoreId),
    [registers, selectedStoreId],
  );

  useEffect(() => {
    setSelectedRegisterId((current) =>
      visibleRegisters.some((register) => register.id === current)
        ? current
        : visibleRegisters.find((register) => register.active)?.id || visibleRegisters[0]?.id || "",
    );
  }, [visibleRegisters]);

  const selectedStore = stores.find((store) => store.id === selectedStoreId) || null;
  const selectedRegister = registers.find((register) => register.id === selectedRegisterId) || null;
  const openSession = sessions.find((session) => session.register_id === selectedRegisterId) || null;
  const ownAssignment = assignments.find(
    (assignment) => assignment.staff_user_id === currentUserId && assignment.store_id === selectedStoreId,
  );
  const effectiveOwnPermissions = canManage
    ? defaultStorePermissions(role)
    : ownAssignment || defaultStorePermissions(role);

  const loadMovements = useCallback(async (sessionId: string) => {
    const { data, error } = await requireSupabase()
      .from("cash_movements")
      .select("id,cash_session_id,kind,direction,payment_method_code,amount,notes,created_at")
      .eq("cash_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setNotice(error.message);
      return;
    }
    setMovements((data || []) as CashMovementRow[]);
  }, []);

  useEffect(() => {
    if (openSession) void loadMovements(openSession.id);
    else setMovements([]);
  }, [openSession?.id, loadMovements]);

  const expectedCash = openSession
    ? expectedCashAmount(openSession.opening_float, movements)
    : 0;

  const run = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir esta ação.");
    } finally {
      setBusyKey("");
    }
  };

  const openCash = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRegisterId) return;
    await run("open-cash", async () => {
      const { error } = await requireSupabase().rpc("staff_open_cash_session", {
        target_register_id: selectedRegisterId,
        next_opening_float: parseMoneyInput(openingFloat),
        next_notes: openingNotes.trim(),
      });
      if (error) throw error;
      setOpeningNotes("");
      setNotice("Caixa aberto. As vendas presenciais já podem ser registradas neste terminal.");
      await load();
    });
  };

  const closeCash = async (event: FormEvent) => {
    event.preventDefault();
    if (!openSession) return;
    await run("close-cash", async () => {
      const { error } = await requireSupabase().rpc("staff_close_cash_session", {
        target_session_id: openSession.id,
        next_counted_cash: parseMoneyInput(countedCash),
        next_notes: closingNotes.trim(),
      });
      if (error) throw error;
      setCountedCash("");
      setClosingNotes("");
      setNotice("Caixa fechado e conferência registrada no histórico financeiro.");
      await load();
    });
  };

  const recordMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!openSession) return;
    await run("cash-movement", async () => {
      const amount = parseMoneyInput(movementAmount);
      if (!amount) throw new Error("Informe um valor maior que zero.");
      const { error } = await requireSupabase().rpc("staff_record_cash_movement", {
        target_session_id: openSession.id,
        movement_kind: movementKind,
        requested_payment_method: "cash",
        requested_amount: amount,
        next_notes: movementNotes.trim(),
        target_order_id: null,
      });
      if (error) throw error;
      setMovementAmount("");
      setMovementNotes("");
      setNotice(movementKind === "supply" ? "Suprimento registrado." : "Sangria registrada.");
      await loadMovements(openSession.id);
    });
  };

  const createStore = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    await run("create-store", async () => {
      const slug = normalizeBusinessSlug(storeSlug || storeName);
      if (!slug || storeName.trim().length < 2) throw new Error("Informe o nome da loja.");
      const { error } = await requireSupabase().rpc("manager_upsert_store", {
        target_store_id: null,
        next_name: storeName.trim(),
        next_slug: slug,
        next_public_label: storePublicLabel.trim(),
        next_address_text: storeAddress.trim(),
        next_pickup_location_id: null,
        next_active: true,
      });
      if (error) throw error;
      setStoreName("");
      setStoreSlug("");
      setStorePublicLabel("");
      setStoreAddress("");
      setNotice("Loja criada e pronta para receber caixas e equipe.");
      await load();
    });
  };

  const createRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !selectedStoreId) return;
    await run("create-register", async () => {
      const code = normalizeBusinessSlug(registerCode || registerName);
      if (!code || registerName.trim().length < 2) throw new Error("Informe o nome do caixa.");
      const { error } = await requireSupabase().rpc("manager_upsert_cash_register", {
        target_register_id: null,
        target_store_id: selectedStoreId,
        next_name: registerName.trim(),
        next_code: code,
        next_device_label: registerDevice.trim(),
        next_active: true,
      });
      if (error) throw error;
      setRegisterName("");
      setRegisterCode("");
      setRegisterDevice("");
      setNotice("Caixa criado e vinculado à loja selecionada.");
      await load();
    });
  };

  const assignmentFor = (member: StaffRow) =>
    assignments.find(
      (assignment) => assignment.staff_user_id === member.user_id && assignment.store_id === selectedStoreId,
    ) || { ...defaultStorePermissions(member.role), staff_user_id: member.user_id, store_id: selectedStoreId };

  const savePermission = async (
    member: StaffRow,
    field: keyof StorePermissionSet,
    checked: boolean,
  ) => {
    if (!canManage || !selectedStoreId) return;
    const current = assignmentFor(member);
    const next = { ...current, [field]: checked };
    await run(`permission-${member.user_id}-${field}`, async () => {
      const { error } = await requireSupabase().rpc("manager_set_staff_store_assignment", {
        target_user_id: member.user_id,
        target_store_id: selectedStoreId,
        next_active: next.active,
        next_can_sell: next.can_sell,
        next_can_open_cash: next.can_open_cash,
        next_can_close_cash: next.can_close_cash,
        next_can_manage_stock: next.can_manage_stock,
        next_can_view_finance: next.can_view_finance,
      });
      if (error) throw error;
      setNotice(`Permissões de ${member.full_name} atualizadas.`);
      await load();
    });
  };

  return (
    <section className="operation-business-hub" aria-busy={loading}>
      <header className="operation-business-heading">
        <div>
          <small>Estrutura da operação</small>
          <h2>Lojas, caixas e equipe no mesmo comando</h2>
          <p>Abra o caixa, movimente dinheiro e controle quem pode vender, conferir estoque ou visualizar o financeiro.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? <p className="operation-business-notice" role="status">{notice}</p> : null}

      <div className="operation-business-metrics">
        <span><Store /><strong>{stores.filter((store) => store.active).length}</strong><small>lojas ativas</small></span>
        <span><MonitorSmartphone /><strong>{registers.filter((register) => register.active).length}</strong><small>caixas ativos</small></span>
        <span><CircleDollarSign /><strong>{sessions.length}</strong><small>caixas abertos</small></span>
        <span><Users /><strong>{staff.filter((member) => member.active).length}</strong><small>pessoas na equipe</small></span>
      </div>

      <nav className="operation-business-tabs" aria-label="Áreas da estrutura operacional">
        <button type="button" className={tab === "cash" ? "active" : ""} onClick={() => setTab("cash")}><Banknote /> Caixa do dia</button>
        <button type="button" className={tab === "structure" ? "active" : ""} onClick={() => setTab("structure")}><Building2 /> Lojas e terminais</button>
        <button type="button" className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}><ShieldCheck /> Equipe e permissões</button>
      </nav>

      {tab === "cash" ? (
        <div className="operation-business-cash">
          <section className="operation-business-selector">
            <label>Loja
              <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)}>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.active ? "" : " · inativa"}</option>)}
              </select>
            </label>
            <label>Caixa / terminal
              <select value={selectedRegisterId} onChange={(event) => setSelectedRegisterId(event.target.value)}>
                {visibleRegisters.map((register) => <option key={register.id} value={register.id}>{register.name}{register.active ? "" : " · inativo"}</option>)}
              </select>
            </label>
            <span className={openSession ? "is-open" : "is-closed"}>
              {openSession ? <CheckCircle2 /> : <KeyRound />}
              <strong>{openSession ? "Caixa aberto" : "Caixa fechado"}</strong>
              <small>{selectedStore?.name || "Selecione uma loja"} · {selectedRegister?.name || "sem terminal"}</small>
            </span>
          </section>

          {!selectedRegister ? <p className="operation-business-empty">Cadastre um caixa ativo para começar a operação financeira.</p> : null}

          {selectedRegister && !openSession ? (
            <form className="operation-business-form" onSubmit={openCash}>
              <header><Banknote /><div><strong>Abrir caixa</strong><small>Informe o dinheiro inicial disponível no terminal.</small></div></header>
              <label>Valor inicial em dinheiro<input value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>
              <label>Observação<textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Ex.: fundo de troco conferido" /></label>
              <button disabled={busyKey === "open-cash" || !effectiveOwnPermissions.can_open_cash}><Plus /> {busyKey === "open-cash" ? "Abrindo…" : "Abrir caixa"}</button>
              {!effectiveOwnPermissions.can_open_cash ? <small className="operation-business-warning">Seu acesso não possui permissão para abrir caixa nesta loja.</small> : null}
            </form>
          ) : null}

          {openSession ? (
            <div className="operation-business-open-session">
              <section className="operation-business-session-summary">
                <span><small>Abertura</small><strong>{formatBusinessMoney(openSession.opening_float)}</strong></span>
                <span><small>Dinheiro esperado</small><strong>{formatBusinessMoney(expectedCash)}</strong></span>
                <span><small>Movimentações</small><strong>{movements.length}</strong></span>
                <span><small>Aberto em</small><strong>{new Date(openSession.opened_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</strong></span>
              </section>

              <form className="operation-business-form compact" onSubmit={recordMovement}>
                <header>{movementKind === "supply" ? <ArrowDownToLine /> : <ArrowUpFromLine />}<div><strong>Movimentar dinheiro</strong><small>Registre suprimento ou sangria imediatamente.</small></div></header>
                <label>Tipo<select value={movementKind} onChange={(event) => setMovementKind(event.target.value as "supply" | "withdrawal")}><option value="supply">Suprimento</option><option value="withdrawal">Sangria</option></select></label>
                <label>Valor<input value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>
                <label>Motivo<textarea value={movementNotes} onChange={(event) => setMovementNotes(event.target.value)} placeholder="Explique a movimentação" /></label>
                <button disabled={busyKey === "cash-movement"}>{movementKind === "supply" ? <ArrowDownToLine /> : <ArrowUpFromLine />}{busyKey === "cash-movement" ? "Registrando…" : "Registrar"}</button>
              </form>

              <section className="operation-business-ledger">
                <header><strong>Movimentações recentes</strong><small>Somente o dinheiro em espécie altera o valor esperado do caixa.</small></header>
                {movements.length ? movements.slice(0, 12).map((movement) => (
                  <div key={movement.id} className={movement.direction === "in" ? "in" : "out"}>
                    <span>{movement.direction === "in" ? "+" : "−"}</span>
                    <p><strong>{movementLabels[movement.kind] || movement.kind}</strong><small>{movement.notes || movement.payment_method_code || "Sem observação"}</small></p>
                    <b>{formatBusinessMoney(movement.amount)}</b>
                    <time>{new Date(movement.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                )) : <p className="operation-business-empty">Nenhuma movimentação registrada neste caixa.</p>}
              </section>

              <form className="operation-business-form close" onSubmit={closeCash}>
                <header><Save /><div><strong>Fechar e conferir caixa</strong><small>Conte apenas o dinheiro físico. Pix e cartões já ficam separados no relatório.</small></div></header>
                <label>Dinheiro contado<input value={countedCash} onChange={(event) => setCountedCash(event.target.value)} inputMode="decimal" placeholder={expectedCash.toFixed(2).replace(".", ",")} required /></label>
                <label>Observação final<textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Registre divergências ou informações do turno" /></label>
                <button disabled={busyKey === "close-cash" || !effectiveOwnPermissions.can_close_cash}><Save /> {busyKey === "close-cash" ? "Fechando…" : "Fechar caixa"}</button>
                {!effectiveOwnPermissions.can_close_cash ? <small className="operation-business-warning">Seu acesso não possui permissão para fechar caixa nesta loja.</small> : null}
              </form>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "structure" ? (
        <div className="operation-business-structure">
          <section className="operation-business-list">
            <header><Store /><div><strong>Lojas cadastradas</strong><small>Uma estrutura preparada para a primeira loja e futuras unidades.</small></div></header>
            {stores.map((store) => (
              <article key={store.id} className={store.id === selectedStoreId ? "selected" : ""} onClick={() => setSelectedStoreId(store.id)}>
                <span><strong>{store.name}</strong><small>{store.public_label || store.address_text || store.slug}</small></span>
                <b>{registers.filter((register) => register.store_id === store.id).length} caixa(s)</b>
              </article>
            ))}
          </section>

          <section className="operation-business-list">
            <header><MonitorSmartphone /><div><strong>Caixas da loja selecionada</strong><small>Cada tablet ou ponto de atendimento pode ter seu próprio caixa.</small></div></header>
            {visibleRegisters.map((register) => (
              <article key={register.id} className={register.id === selectedRegisterId ? "selected" : ""} onClick={() => setSelectedRegisterId(register.id)}>
                <span><strong>{register.name}</strong><small>{register.device_label || register.code}</small></span>
                <b>{sessions.some((session) => session.register_id === register.id) ? "Aberto" : register.active ? "Disponível" : "Inativo"}</b>
              </article>
            ))}
            {!visibleRegisters.length ? <p className="operation-business-empty">Nenhum caixa cadastrado nesta loja.</p> : null}
          </section>

          {canManage ? <>
            <form className="operation-business-form" onSubmit={createStore}>
              <header><Store /><div><strong>Nova loja</strong><small>Cadastre uma unidade sem alterar a loja atual.</small></div></header>
              <label>Nome<input value={storeName} onChange={(event) => { setStoreName(event.target.value); if (!storeSlug) setStoreSlug(normalizeBusinessSlug(event.target.value)); }} placeholder="Ex.: Adoce Passaré" required /></label>
              <label>Identificador<input value={storeSlug} onChange={(event) => setStoreSlug(normalizeBusinessSlug(event.target.value))} placeholder="adoce-passare" required /></label>
              <label>Nome para o cliente<input value={storePublicLabel} onChange={(event) => setStorePublicLabel(event.target.value)} placeholder="Retirada Adoce Passaré" /></label>
              <label>Endereço<textarea value={storeAddress} onChange={(event) => setStoreAddress(event.target.value)} placeholder="Endereço completo da unidade" /></label>
              <button disabled={busyKey === "create-store"}><Plus /> {busyKey === "create-store" ? "Criando…" : "Criar loja"}</button>
            </form>

            <form className="operation-business-form" onSubmit={createRegister}>
              <header><MonitorSmartphone /><div><strong>Novo caixa</strong><small>Será vinculado à loja selecionada acima.</small></div></header>
              <label>Nome<input value={registerName} onChange={(event) => { setRegisterName(event.target.value); if (!registerCode) setRegisterCode(normalizeBusinessSlug(event.target.value)); }} placeholder="Ex.: Caixa principal" required /></label>
              <label>Código<input value={registerCode} onChange={(event) => setRegisterCode(normalizeBusinessSlug(event.target.value))} placeholder="caixa-principal" required /></label>
              <label>Dispositivo<input value={registerDevice} onChange={(event) => setRegisterDevice(event.target.value)} placeholder="Ex.: Tablet balcão 01" /></label>
              <button disabled={busyKey === "create-register" || !selectedStoreId}><Plus /> {busyKey === "create-register" ? "Criando…" : "Criar caixa"}</button>
            </form>
          </> : <p className="operation-business-empty">Somente proprietários e gerentes podem cadastrar lojas e caixas.</p>}
        </div>
      ) : null}

      {tab === "team" ? (
        <div className="operation-business-team">
          <header><Users /><div><strong>Permissões por loja</strong><small>{selectedStore ? `Controle de acesso em ${selectedStore.name}` : "Selecione uma loja"}</small></div></header>
          {staff.map((member) => {
            const permission = assignmentFor(member);
            return (
              <article key={member.user_id}>
                <div className="operation-business-member">
                  <span>{member.full_name.slice(0, 1).toUpperCase()}</span>
                  <p><strong>{member.full_name}</strong><small>{roleLabel(member.role)} · {member.active ? "acesso ativo" : "desativado"}</small></p>
                </div>
                <div className="operation-business-permissions">
                  {([
                    ["active", "Vinculado à loja"],
                    ["can_sell", "Vender"],
                    ["can_open_cash", "Abrir caixa"],
                    ["can_close_cash", "Fechar caixa"],
                    ["can_manage_stock", "Gerenciar estoque"],
                    ["can_view_finance", "Ver financeiro"],
                  ] as Array<[keyof StorePermissionSet, string]>).map(([field, label]) => (
                    <label key={field}>
                      <input
                        type="checkbox"
                        checked={permission[field]}
                        disabled={!canManage || Boolean(busyKey)}
                        onChange={(event) => void savePermission(member, field, event.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
          {!staff.length ? <p className="operation-business-empty">Nenhum membro de equipe encontrado.</p> : null}
          {!canManage ? <p className="operation-business-warning">Você pode consultar suas permissões, mas apenas proprietários e gerentes podem alterá-las.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
