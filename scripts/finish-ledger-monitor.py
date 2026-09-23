from pathlib import Path
p=Path('supabase/migrations/20260918010200_cash_pix_change.sql');s=p.read_text(encoding='utf-8');s=s[s.index('create or replace function public.staff_cash_closing_report'):]
s=s.replace("'session',to_jsonb(s),", "'session',to_jsonb(s)||jsonb_build_object('expected_cash',coalesce(s.expected_cash,private.cash_expected_amount(s.id))),\n 'expenses',coalesce((select jsonb_agg(jsonb_build_object('description',notes,'method',payment_method_code,'amount',amount) order by created_at) from public.cash_movements where cash_session_id=s.id and kind='expense'),'[]'),")
p=Path('supabase/migrations/20260918121500_chat_monitoring_and_cash_expense.sql');p.write_text(p.read_text(encoding='utf-8')+'\n'+s,encoding='utf-8')
p=Path('src/cash-receivables.ts');s=p.read_text(encoding='utf-8').replace('  pix_change?:', '  expenses?: Array<{ description: string; method: string; amount: number }>;\n  pix_change?:')
s=s.replace('"TROCO DEVOLVIDO POR PIX",', '"DESPESAS", ...(report.expenses?.length ? report.expenses.map(item => `${item.description} · ${paymentLabels[item.method] || item.method}: ${cashMoney(item.amount)}`) : ["Nenhuma"]), "--------------------------------", "TROCO DEVOLVIDO POR PIX",')
p.write_text(s,encoding='utf-8')
p=Path('android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java');s=p.read_text(encoding='utf-8').replace('lines.add(dashes()); lines.add("TROCO DEVOLVIDO POR PIX");','''lines.add(dashes()); lines.add("DESPESAS");
        JSONArray expenses=report.optJSONArray("expenses");
        if(expenses==null || expenses.length()==0) lines.add("Nenhuma");
        else for(int i=0;i<expenses.length();i++) { JSONObject expense=expenses.getJSONObject(i); wrap(lines,expense.optString("description")); wrap(lines,expense.optString("method")+": "+cashMoney(expense.optDouble("amount"))); }
        lines.add(dashes()); lines.add("TROCO DEVOLVIDO POR PIX");''');p.write_text(s,encoding='utf-8')
p=Path('src/whatsapp-support-inbox.css');p.write_text(p.read_text(encoding='utf-8')+'\n.whatsapp-support-messages{max-height:55dvh;min-height:15rem;overflow-y:auto;overscroll-behavior:contain}.whatsapp-support-conversation form>div{grid-template-columns:minmax(0,1fr) auto}@media(max-width:760px){.whatsapp-support-conversation form>div{grid-template-columns:1fr}}\n',encoding='utf-8')
# Remove the obsolete send-a-message-to-close branch; closing is independent of provider availability.
p=Path('netlify/functions/whatsapp-support.ts');s=p.read_text(encoding='utf-8');s=s.replace('import { mainMenuMessage } from "./_shared/whatsapp-order-bot";\n','')
start=s.index('    const outgoingBody = action === "close"');end=s.index(';',start)+1
s=s[:start]+'    const outgoingBody = body;'+s[end:]
start=s.index('    if (action === "close") {',s.index('const outgoingBody'))
end=s.index('    return json({ ok: true, messageSid:',start)
s=s[:start]+s[end:];s=s.replace('closed: action === "close"','closed: false');p.write_text(s,encoding='utf-8')
