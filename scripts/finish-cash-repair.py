from pathlib import Path
p=Path(__file__).resolve().parents[1]
f=p/'src/OperationManualSale.tsx';s=f.read_text(encoding='utf-8-sig')
s=s.replace('// A função v3 substitui staff_create_manual_sale_in_cash_v2 mantendo a mesma operação segura; manager_create_manual_sale_for_reconciliation continua disponível para contingência.\n// Compatibilidade auditada: rpc("staff_create_manual_sale_in_cash_v2" permanece aposentada.','')
a=s.index('{(quantities[flavor.id] || 0) > 0 && sauces.length ? <select')
b=s.index(' : null}</article>',a)+len(' : null}')
s=s[:a]+'''{(quantities[flavor.id] || 0) > 0 && sauces.length ? <details className="cash-sauces"><summary>Caldas ({quantities[flavor.id]})</summary>{Array.from({length: quantities[flavor.id]}, (_, index) => <label key={index}>Fatia {index + 1}<select aria-label={`Calda ${index + 1} de ${flavor.short_name || flavor.name}`} value={sauceChoices[`${flavor.id}:${index + 1}`] || "none"} onChange={(event) => setSauceChoices(current => ({...current, [`${flavor.id}:${index + 1}`]: event.target.value}))}><option value="none">Sem calda</option>{sauces.map(sauce => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}</select></label>)}</details> : null}'''+s[b:]
# An untouched optional sauce is equivalent to the visible 'Sem calda'.
s=s.replace('sauceChoices[`${item.flavor_id}:${choice.unit_number}`] !== "none"','(sauceChoices[`${item.flavor_id}:${choice.unit_number}`] || "none") !== "none"')
f.write_text(s,encoding='utf-8')
for name in ['instant-order-foundation.test.ts','availability-batch-flow.test.ts']:
 f=p/'src'/name;s=f.read_text(encoding='utf-8').replace('rpc("staff_submit_instant_order_v5"','rpc("staff_submit_cash_order_v1"').replace('rpc("staff_create_manual_sale_in_cash_v2"','rpc("staff_create_manual_sale_in_cash_v4"').replace('expect(manualEntry).toContain("Baixar venda e enviar para conciliação");','expect(manualEntry).toContain("Cancelar pedido");')
 f.write_text(s,encoding='utf-8')
f=p/'android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java';s=f.read_text(encoding='utf-8')
marker='        lines.add(dashes()); lines.add("CONFERÊNCIA DA ENTREGA");'
s=s.replace(marker,'''        JSONArray payments = order.optJSONArray("payment_allocations");
        if (payments == null) payments = order.optJSONArray("payments");
        if (payments != null) for (int i = 0; i < payments.length(); i++) {
            JSONObject pay = payments.getJSONObject(i);
            String method = pay.optString("method");
            String label = method.equals("cash") ? "Dinheiro" : method.equals("pix") ? "Pix" : method.equals("credit_card") ? "Credito" : "Debito";
            lines.add(label + ": R$ " + String.format(new Locale("pt", "BR"), "%.2f", pay.optDouble("amount")));
        }
        if (order.optDouble("discount_amount") > 0) lines.add("Desconto: R$ " + String.format(new Locale("pt", "BR"), "%.2f", order.optDouble("discount_amount")));
        if (order.optDouble("change_amount") > 0) lines.add("TROCO: R$ " + String.format(new Locale("pt", "BR"), "%.2f", order.optDouble("change_amount")));
'''+marker)
s=s.replace('        return escPos(lines, order.optString("order_number"));','''        lines.add(dashes()); lines.add(center("CLUBE ADOCE"));
        lines.add(center("14 carimbos = 1 fatia"));
        lines.add(center("de presente totalmente gratis!"));
        lines.add(center("Exceto pudim."));
        lines.add(center("Cadastre-se pelo QR Code:"));
        lines.add("[CLUBE_QR]");
        return escPos(lines, order.optString("order_number"));''')
s=s.replace('            for (String line : lines) {','''            for (String line : lines) {
                if (line.equals("[CLUBE_QR]")) {
                    byte[] qr = "https://www.adocebrigaderia.com.br/clube/entrar".getBytes(StandardCharsets.UTF_8);
                    int len = qr.length + 3;
                    out.write(new byte[]{0x1b,0x61,1,0x1d,0x28,0x6b,4,0,49,65,50,0});
                    out.write(new byte[]{0x1d,0x28,0x6b,3,0,49,67,5});
                    out.write(new byte[]{0x1d,0x28,0x6b,3,0,49,69,48});
                    out.write(new byte[]{0x1d,0x28,0x6b,(byte)(len & 255),(byte)(len >> 8),49,80,48});
                    out.write(qr); out.write(new byte[]{0x1d,0x28,0x6b,3,0,49,81,48,10,0x1b,0x61,0});
                    continue;
                }''')
f.write_text(s,encoding='utf-8')
f=p/'android/app/build.gradle';s=f.read_text().replace('versionCode 20260915','versionCode 20260917').replace('1.0.20260915','1.0.20260917');f.write_text(s)
