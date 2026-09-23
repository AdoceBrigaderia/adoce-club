from pathlib import Path
base=Path('supabase/migrations/20260917190900_cash_payment_variables.sql').read_text(encoding='utf-8')
base=base[base.index('create or replace function'):]
base=base.replace('staff_create_manual_sale_in_cash_v3','staff_create_manual_sale_in_cash_v5')
base=base.replace("requested_notes text default ''", "requested_notes text default '',\n  requested_change jsonb default '{}'::jsonb")
base=base.replace('  response jsonb;', '  response jsonb;\n  pix_change numeric := round(coalesce((requested_change->>\'pix\')::numeric,0),2);\n  change_source text := left(btrim(coalesce(requested_change->>\'source\',\'Conta pessoal\')),100);')
base=base.replace("  if v_change > 0 then", "  if pix_change < 0 or pix_change > v_change then raise exception 'Revise o troco por Pix'; end if;\n  if pix_change > 0 and change_source='' then raise exception 'Informe a conta usada no troco por Pix'; end if;\n  if v_change-pix_change > 0 then")
base=base.replace("'cash',v_change,target.id", "'cash',v_change-pix_change,target.id")
base=base.replace('  update public.instant_orders set subtotal=', '  update public.instant_orders set change_pix_amount=pix_change,change_pix_source=case when pix_change>0 then change_source else null end where id=target.id;\n  update public.instant_orders set subtotal=')
base=base.replace('jsonb,jsonb,text)', 'jsonb,jsonb,text,jsonb)')
# Preserve the established idempotency action across versions so upgrades cannot duplicate a retry.
base=base.replace("'manual_sale_in_cash_v5'", "'manual_sale_in_cash_v3'")
wrapper=Path('supabase/migrations/20260917191000_cash_reservation_integrity.sql').read_text(encoding='utf-8')
wrapper=wrapper[wrapper.index('create or replace function public.staff_create_manual_sale_in_cash_v4'):wrapper.index('create or replace function public.staff_submit_cash_order_v1')]
wrapper=wrapper.replace('staff_create_manual_sale_in_cash_v4','staff_create_manual_sale_in_cash_v6').replace('staff_create_manual_sale_in_cash_v3','staff_create_manual_sale_in_cash_v5')
wrapper=wrapper.replace("requested_notes text default '')", "requested_notes text default '',requested_change jsonb default '{}')")
wrapper=wrapper.replace('requested_payments,requested_notes);', 'requested_payments,requested_notes,requested_change);').replace('jsonb,jsonb,text)', 'jsonb,jsonb,text,jsonb)')
sql="alter table public.instant_orders add column if not exists change_pix_amount numeric(10,2) not null default 0 check(change_pix_amount>=0), add column if not exists change_pix_source text;\n"+base+wrapper
Path('supabase/migrations/20260918010200_cash_pix_change.sql').write_text(sql,encoding='utf-8')
p=Path('src/OperationManualSale.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('{ validateDeferredSale }','{ validateDeferredSale, splitChange }')
s=s.replace('const [deferred,', 'const [changePix, setChangePix] = useState("0");\n  const [changeSource, setChangeSource] = useState("Conta pessoal");\n  const [deferred,')
s=s.replace('    setBusy(true);\n    const operationKey', '    try { splitChange(totals.change, Number(changePix.replace(",", "."))); } catch (error) { return setNotice((error as Error).message); }\n    setBusy(true);\n    const operationKey')
s=s.replace('"staff_create_manual_sale_in_cash_v4"','"staff_create_manual_sale_in_cash_v6"')
s=s.replace('requested_payments: payments, requested_notes:', 'requested_payments: payments, requested_change: { pix: Number(changePix.replace(",", ".")), source: changeSource }, requested_notes:')
s=s.replace('setDeferred(false); quantitiesRef.current', 'setChangePix("0"); setDeferred(false); quantitiesRef.current')
s=s.replace('<div className="cash-payment-balance">', '{totals.change > 0 && !deferred ? <section><label>Valor do troco devolvido por Pix<input inputMode="decimal" value={changePix} onChange={event => setChangePix(event.target.value)} /></label><label>Conta de onde saiu o Pix<input value={changeSource} onChange={event => setChangeSource(event.target.value)} /></label><p>Informe aqui depois de fazer o Pix. O sistema apenas registra a devolução.</p><p>Troco em dinheiro: {money(Math.max(0, totals.change - (Number(changePix.replace(",", ".")) || 0)))}</p></section> : null}<div className="cash-payment-balance">')
p.write_text(s,encoding='utf-8')
