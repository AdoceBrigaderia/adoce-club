from pathlib import Path
root=Path(__file__).resolve().parents[1]
def edit(file,old,new):
 p=root/file
 s=p.read_text(encoding='utf-8-sig')
 if old not in s: raise Exception(f'Not found {file}: {old[:90]}')
 p.write_text(s.replace(old,new),encoding='utf-8')
edit('src/OperationInstantOrders.tsx','import OperationManualSale from "./OperationManualSale";','')
edit('src/OperationInstantOrders.tsx','    <OperationManualSale onCreated={() => void load()} />','')
edit('src/OperationCommercialAdmin.tsx','<div className="operation-title">','<div className="operation-title" hidden={tab === "sales"}>')
edit('src/OperationCommercialAdmin.tsx','<><OperationManualSale onCreated={() => void load()} /><OperationInstantOrders /></>','<OperationManualSale onCreated={() => void load()} />')
edit('src/OperationCommercialAdmin.tsx','<ShoppingCart /> Fatias','<ShoppingCart /> Caixa')
edit('src/AccessApp.tsx','if (path.includes("/operacao/pedidos"))','if (path.includes("/operacao/pedidos") || path.includes("/operacao/caixa"))')
edit('src/AccessApp.tsx','"/operacao/pedidos?tipo=vendas"','"/operacao/caixa"')
edit('src/AccessApp.tsx','<ShoppingCart /> Pedidos','<ShoppingCart /> Caixa')
edit('src/AccessApp.tsx','<ShoppingCart /><span>Pedidos</span>','<ShoppingCart /><span>Caixa</span>')
edit('src/AccessApp.tsx','import "./operation-tablet.css";','import "./operation-tablet.css";\nimport "./cash-register-layout.css";')
edit('src/WhatsAppSupportInbox.tsx','async function supportRequest(','export async function supportRequest(')
edit('src/OperationManualSale.tsx','useMemo, useState','useMemo, useRef, useState')
edit('src/OperationManualSale.tsx','import { Minus, Plus, ShoppingBag, X }','import { Minus, Plus, ShoppingBag, X, Store, MessageCircle, Banknote, CreditCard, Check, Delete, Printer }')
edit('src/OperationManualSale.tsx','import "./operation-commerce-tools.css";','import "./operation-commerce-tools.css";\nimport WhatsAppSupportInbox, { supportRequest } from "./WhatsAppSupportInbox";\nimport OperationInstantOrders from "./OperationInstantOrders";\nimport { printThermalOrder, type ThermalOrder } from "./lib/thermal-printer";')
edit('src/OperationManualSale.tsx','useState<EntryMode>("order")','useState<EntryMode>(() => localStorage.getItem("adoce-cash-channel") === "private" ? "order" : "sale")')
edit('src/OperationManualSale.tsx','useState<ChannelMode>("presential")','useState<ChannelMode>(() => { const saved = localStorage.getItem("adoce-cash-channel"); return saved === "official" || saved === "private" ? saved : "presential"; })')
edit('src/OperationManualSale.tsx','const [draftKey] = useState(() => crypto.randomUUID());','const [draftKey, setDraftKey] = useState(() => crypto.randomUUID());')
edit('src/OperationManualSale.tsx','  const load = useCallback','  const [pendingCount, setPendingCount] = useState(0);\n  const [reservationBusy, setReservationBusy] = useState(false);\n  const reservationLock = useRef(false);\n  const quantitiesRef = useRef<Record<string, number>>({});\n  const [lastSale, setLastSale] = useState<ThermalOrder | null>(null);\n  const [printNotice, setPrintNotice] = useState("");\n  useEffect(() => { const refresh = () => { void supportRequest().then((data) => setPendingCount((data.threads || []).length)).catch(() => setPendingCount(0)); }; refresh(); const timer = window.setInterval(refresh, 15000); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, []);\n  const load = useCallback')
edit('src/OperationManualSale.tsx','Number(availability?.quantity_reserved || 0))','Number(availability?.quantity_reserved || 0) + Number(quantitiesRef.current[flavor.id] || 0))')
edit('src/OperationManualSale.tsx','...(mode === "order" && sauces.length ?', '...(sauces.length ?')
edit('src/OperationManualSale.tsx','sauceChoices[`${flavor.id}:${index + 1}`] }))','(sauceChoices[`${flavor.id}:${index + 1}`] || null) }))')
p=root/'src/OperationManualSale.tsx';s=p.read_text(encoding='utf-8')
a=s.index('  const setQuantity =');b=s.index('  const openCash =',a)
s=s[:a]+'''  const setQuantity = async (flavor: Flavor, value: number) => {
    if (reservationLock.current || busy) return;
    if (!openCashSession) return setNotice("Abra o caixa para reservar as fatias.");
    const next = Math.max(0, Math.min(flavor.remaining, Math.floor(value)));
    const nextQuantities = { ...quantitiesRef.current, [flavor.id]: next };
    reservationLock.current = true; setReservationBusy(true); setNotice("");
    try {
      const { data, error } = await requireSupabase().rpc("staff_set_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_items: Object.entries(nextQuantities).filter(([, quantity]) => quantity > 0).map(([flavor_id, quantity]) => ({ flavor_id, quantity })) });
      if (error) throw error;
      if (!data?.accepted) throw new Error("Estoque insuficiente. Atualize os sabores disponíveis.");
      quantitiesRef.current = nextQuantities; setQuantities(nextQuantities);
      setSauceChoices((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${flavor.id}:`) || Number(key.split(":")[1]) <= next)));
    } catch (error) { setNotice(error instanceof Error ? error.message : String((error as {message?: string}).message || "Não foi possível reservar a fatia.")); }
    finally { reservationLock.current = false; setReservationBusy(false); }
  };
  const cancelDraft = async () => {
    if (reservationLock.current || busy) return;
    setBusy(true);
    try {
      if (openCashSession) { const {error} = await requireSupabase().rpc("staff_release_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey }); if (error) throw error; }
      quantitiesRef.current = {}; setQuantities({}); setSauceChoices({}); setPayments([]); setName(""); setPhone(""); setNotes(""); setPaymentAmount(""); setDiscountKind("none"); setDiscountValue("0"); setDraftKey(crypto.randomUUID()); setNotice("Pedido cancelado. Estoque liberado."); await load();
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  };
  const changeChannel = (next: ChannelMode) => {
    if (reservationLock.current || busy) return;
    if (Object.values(quantitiesRef.current).some(value => value > 0) && next !== channel) return setNotice("Conclua ou cancele o pedido antes de trocar o canal.");
    setChannel(next); setMode(next === "private" ? "order" : "sale"); localStorage.setItem("adoce-cash-channel", next); setNotice("");
  };
''' +s[b:]
s=s.replace('    setBusy(true);\n    const operationKey = crypto.randomUUID();','    if (reservationLock.current || busy) return;\n    if (mode === "sale" && totals.remaining > 0) return setNotice("Adicione o restante por Pix, cartão ou dinheiro para concluir o pagamento.");\n    setBusy(true);\n    const operationKey = draftKey;')
s=s.replace('"staff_submit_instant_order_v5", {','"staff_submit_cash_order_v1", { target_session_id: openCashSession!.id, target_draft_key: draftKey,')
s=s.replace('"staff_create_manual_sale_in_cash_v3", {','"staff_create_manual_sale_in_cash_v4", { target_draft_key: draftKey,')
s=s.replace('    await releaseDraftReservation();','''    if (mode === "sale" && data?.order_id) {
      const { data: receipt } = await requireSupabase().from("instant_orders").select("*,instant_order_items(*,instant_order_item_sauces(*))").eq("id", data.order_id).single();
      if (receipt) { const order = { ...receipt, payments: data.payment_allocations || payments, remaining_balance: data.remaining || 0 } as ThermalOrder; setLastSale(order); try { const printed = await printThermalOrder(order); setPrintNotice(printed === "printed" ? "Cupom impresso" : "Impressão pendente no tablet"); } catch { setPrintNotice("Impressão pendente. Use Reimprimir."); } }
    }
    quantitiesRef.current = {}; setDraftKey(crypto.randomUUID()); setDiscountKind("none"); setDiscountValue("0");''')
s=s.replace('setAfterSale(true); onCreated();','setAfterSale(mode === "sale"); onCreated(); void load();')
s=s.replace('onClick={() => { setChannel("presential"); setMode("sale"); }}','onClick={() => changeChannel("presential")}')
s=s.replace('onClick={() => { setChannel("official"); setMode("order"); }}','onClick={() => changeChannel("official")}')
s=s.replace('onClick={() => { setChannel("private"); setMode("sale"); }}','onClick={() => changeChannel("private")}')
s=s.replace('<b className="cash-badge">3</b>','{pendingCount > 0 ? <b className="cash-badge">{pendingCount}</b> : null}')
s=s.replace('<ShoppingBag /> Presencial','<Store /> Presencial').replace('<ShoppingBag /> WhatsApp','<MessageCircle /> WhatsApp')
s=s.replace('Registre pedidos recebidos no WhatsApp particular sem enviar mensagem automática.','Cadastre o pedido combinado no WhatsApp particular. As etapas serão comunicadas pelo número oficial.')
s=s.replace('<div className="cash-register-layout"><main>','{channel === "official" ? <div className="cash-official"><WhatsAppSupportInbox /><OperationInstantOrders /></div> : <div className="cash-register-layout"><main>')
s=s.replace('<span className="sr-only">Baixar venda e enviar para conciliação</span>','')
s=s.replace('</aside></div>','</aside></div>}')
# Remove duplicated closed-cash panel outside the register layout.
a=s.index('    {mode === "sale" && !openCashSession ?',s.index('</aside></div>}'))
b=s.index('    {quantityEditor ?',a);s=s[:a]+s[b:]
s=s.replace('mode === "sale" && !openCashSession','!openCashSession')
s=s.replace('className="cash-register-flavors"','className="cash-register-flavors" aria-busy={reservationBusy}')
s=s.replace('onClick={() => setQuantity(', 'disabled={reservationBusy || busy} onClick={() => void setQuantity(')
s=s.replace('<div className="cash-register-mobile-fields">','<div className="cash-register-mobile-fields" hidden={channel === "presential"}>')
s=s.replace('setPaymentModal(true)', 'mode === "order" ? void submit() : setPaymentModal(true)')
s=s.replace('disabled={busy || !items.length}', 'disabled={busy || reservationBusy || !items.length}')
s=s.replace('"Finalizar venda"}', '(mode === "order" ? "Registrar pedido" : "Finalizar venda")}')
s=s.replace('<label>Forma de pagamento<select','<label hidden={mode === "sale"}>Forma de pagamento<select')
s=s.replace('<button type="button" className="commerce-primary-action" onClick={() => void submit()}>Confirmar pagamento</button>','<button type="button" className="commerce-primary-action" disabled={busy || reservationBusy || totals.remaining > 0} onClick={() => void submit()}>{busy ? "Finalizando…" : totals.remaining > 0 ? "Adicione o pagamento restante" : "Confirmar pagamento"}</button>')
s=s.replace('<h3>Quantidade</h3>','<button type="button" className="cash-modal-close" onClick={() => setQuantityEditor(null)} aria-label="Fechar teclado"><X /></button><h3>Quantidade</h3>')
s=s.replace('key={key} onClick','className={key === 0 ? "cash-keypad-zero" : ""} key={key} onClick')
s=s.replace('<button type="button" className="cash-keypad-confirm"','<button type="button" onClick={() => setQuantityDraft(value => value.slice(0,-1))} aria-label="Apagar último dígito"><Delete /></button><button type="button" className="cash-keypad-confirm"')
s=s.replace('if (quantityEditor) setQuantity(', 'if (quantityEditor) void setQuantity(')
s=s.replace('>✓</button>','><Check /></button>')
s=s.replace('key={value} onClick={() => setMethod(value)}>', 'key={value} onClick={() => setMethod(value)}>{value === "cash" ? <Banknote /> : value === "pix" ? <span className="cash-pix-symbol">Pix</span> : <CreditCard />}')
s=s.replace('<label>{method === "cash" ?', '<p hidden={method !== "pix"} className="cash-pix-help">Caso o aparelho do cliente esteja com dificuldade de ler o QR Code, informe esta chave Pix: <strong>PAGAMENTOS@ADOCEBRIGADERIA.COM.BR</strong></p><label>{method === "cash" ?')
s=s.replace('{item.method} <strong>', '{item.method === "cash" ? "Dinheiro" : item.method === "pix" ? "Pix" : item.method === "card_credit" ? "Crédito" : "Débito"} <strong>')
s=s.replace('<h3>Venda finalizada</h3>','<h3>Venda finalizada</h3><p>{printNotice}</p>{lastSale ? <button type="button" onClick={() => void printThermalOrder(lastSale, true).then(() => setPrintNotice("Cupom enviado para impressão")).catch(() => setPrintNotice("Impressora indisponível. Tente novamente."))}><Printer /> Reimprimir</button> : null}')
s=s.replace('<button type="button" onClick={() => setAfterSale(false)}>Lançar carimbos</button>','<button type="button" onClick={() => { window.location.href = `/operacao/clientes?pedido=${encodeURIComponent(lastSale?.id || "")}`; }}>Lançar carimbos</button>')
p.write_text(s,encoding='utf-8')
