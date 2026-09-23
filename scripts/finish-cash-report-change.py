from pathlib import Path
p=Path('supabase/migrations/20260918010000_cash_receivables.sql')
s=p.read_text(encoding='utf-8'); start=s.index('create or replace function public.staff_cash_closing_report')
report=s[start:].replace("'slices',coalesce", "'pix_change',coalesce((select jsonb_agg(x) from (select coalesce(change_pix_source,'Conta pessoal') source,sum(change_pix_amount) amount from public.instant_orders where cash_session_id=s.id and status='completed' and change_pix_amount>0 group by change_pix_source) x),'[]'),\n 'slices',coalesce")
p=Path('supabase/migrations/20260918010200_cash_pix_change.sql');p.write_text(p.read_text(encoding='utf-8')+'\n'+report,encoding='utf-8')
p=Path('src/cash-receivables.ts');s=p.read_text(encoding='utf-8').replace('"Pendências não são dinheiro recebido.",', '"Pendências não são dinheiro recebido.", "--------------------------------", "TROCO DEVOLVIDO POR PIX", ...(report.pix_change?.length ? report.pix_change.map(item => `${item.source}: ${cashMoney(item.amount)}`) : ["Nenhum"]), "Troco por Pix não sai da gaveta.",');p.write_text(s,encoding='utf-8')
p=Path('android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java');s=p.read_text(encoding='utf-8')
s=s.replace('return escPos(lines,"FECHAMENTO DE CAIXA");', '''lines.add(dashes()); lines.add("TROCO DEVOLVIDO POR PIX");
        JSONArray pixChanges=report.optJSONArray("pix_change");
        if(pixChanges==null || pixChanges.length()==0) lines.add("Nenhum");
        else for(int i=0;i<pixChanges.length();i++) { JSONObject change=pixChanges.getJSONObject(i); wrap(lines,change.optString("source")+": "+cashMoney(change.optDouble("amount"))); }
        wrap(lines,"Troco por Pix nao sai da gaveta.");
        return escPos(lines,"FECHAMENTO DE CAIXA");''')
s=s.replace('if (order.optDouble("change_amount") > 0) lines.add', 'if (order.optDouble("change_pix_amount") > 0) { lines.add("Troco por Pix: " + cashMoney(order.optDouble("change_pix_amount"))); wrap(lines,"Conta: " + order.optString("change_pix_source")); lines.add("Troco em dinheiro: " + cashMoney(order.optDouble("change_amount") - order.optDouble("change_pix_amount"))); }\n        if (order.optDouble("change_amount") > 0) lines.add')
p.write_text(s,encoding='utf-8')
p=Path('src/OperationManualSale.tsx');s=p.read_text(encoding='utf-8').replace('setPaymentAmount(""); setDiscountKind', 'setDeferred(false); setChangePix("0"); setPaymentAmount(""); setDiscountKind')
s=s.replace('`Venda ${data?.order_number || ""} registrada, estoque atualizado e pagamento contabilizado.`', 'deferred ? `Venda ${data?.order_number || ""} concluída com pagamento pendente.` : `Venda ${data?.order_number || ""} registrada, estoque atualizado e pagamento contabilizado.`')
p.write_text(s,encoding='utf-8')
p=Path('src/cash-register-layout.css');p.write_text(p.read_text(encoding='utf-8')+'\n.cash-session-actions{display:flex;gap:10px;flex-wrap:wrap;padding:12px 0}.cash-session-actions button{min-height:44px;padding:10px 18px;border:1px solid #dcbcaf;border-radius:12px;background:#fff8ef;color:#432115}.cash-register-page .cash-modal input[type=checkbox]{width:22px;height:22px;vertical-align:middle}.cash-register-page .cash-modal section{margin:12px 0}.cash-register-page .cash-modal pre{font-size:13px}\n',encoding='utf-8')
