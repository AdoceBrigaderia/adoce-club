from pathlib import Path
p=Path('android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java')
s=p.read_text(encoding='utf-8')
s=s.replace('private void sendHeartbeat() {', 'private void sendHeartbeat() {\n        pollClosingReports();')
block='''
    private void pollClosingReports() {
        String base = prefs.getString("url", "");
        if (base.isEmpty() || writer == null || tokenExpiresSoon()) return;
        Request request = new Request.Builder().url(base + "/rest/v1/cash_closing_reports?printed_at=is.null&select=id,report&order=created_at.asc&limit=20")
            .header("apikey", prefs.getString("key", "")).header("Authorization", "Bearer " + prefs.getString("access", "")).build();
        http.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call call, java.io.IOException e) { }
            @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                try (response) {
                    if (!response.isSuccessful()) return;
                    JSONArray rows = new JSONArray(response.body().string());
                    for (int i = 0; i < rows.length(); i++) {
                        JSONObject row = rows.getJSONObject(i); String id = row.getString("id");
                        if (!printingIds.add("closing:" + id)) continue;
                        printerExecutor.execute(() -> {
                            try {
                                if (!prefs.getBoolean("closing_printed_" + id, false)) {
                                    writeReceipt(closingReceipt(row.getJSONObject("report")));
                                    prefs.edit().putBoolean("closing_printed_" + id, true).commit();
                                }
                                JSONObject body = new JSONObject().put("target_report_id", id);
                                Request ack = new Request.Builder().url(base + "/rest/v1/rpc/staff_ack_cash_closing_print")
                                    .header("apikey", prefs.getString("key", "")).header("Authorization", "Bearer " + prefs.getString("access", ""))
                                    .post(RequestBody.create(body.toString(), MediaType.get("application/json"))).build();
                                try (Response acknowledged = http.newCall(ack).execute()) { }
                                setState("fechamento impresso");
                            } catch (Exception e) { setState("impressao do fechamento pendente"); }
                            finally { printingIds.remove("closing:" + id); }
                        });
                    }
                } catch (Exception e) { Log.e(TAG, "Falha ao ler fechamento", e); }
            }
        });
    }

    private String cashMoney(double value) { return String.format(new Locale("pt", "BR"), "R$ %.2f", value); }
    private byte[] closingReceipt(JSONObject report) throws Exception {
        List<String> lines = new ArrayList<>(); JSONObject session = report.getJSONObject("session");
        lines.add(center("ADOCE BRIGADERIA")); lines.add(center("FECHAMENTO DE CAIXA"));
        lines.add("Abertura: " + formatDate(session.optString("opened_at")));
        lines.add("Fechamento: " + formatDate(session.optString("closed_at"))); lines.add(dashes());
        JSONArray slices = report.getJSONArray("slices"); int quantity = 0;
        for (int i=0;i<slices.length();i++) { JSONObject item=slices.getJSONObject(i); quantity+=item.optInt("quantity"); wrap(lines,item.optString("name")+": "+item.optInt("quantity")); }
        lines.add("TOTAL DE FATIAS: " + quantity); lines.add(dashes()); lines.add("RECEBIMENTOS NESTE CAIXA");
        String[] codes={"cash","pix","credit_card","debit_card"}; String[] labels={"Dinheiro","Pix","Credito","Debito"};
        JSONArray payments=report.getJSONArray("payments");
        for(int i=0;i<codes.length;i++) { double total=0; for(int j=0;j<payments.length();j++) { JSONObject pay=payments.getJSONObject(j); if(codes[i].equals(pay.optString("method"))) total+=pay.optDouble("amount"); } lines.add(labels[i]+": "+cashMoney(total)); }
        wrap(lines,"Inclui pagamentos de vendas anteriores."); lines.add(dashes());
        lines.add("Fundo: "+cashMoney(session.optDouble("opening_float")));
        lines.add("Esperado: "+cashMoney(session.optDouble("expected_cash")));
        lines.add("Contado: "+cashMoney(session.optDouble("counted_cash")));
        lines.add("Diferenca: "+cashMoney(session.optDouble("cash_difference"))); lines.add(dashes());
        lines.add("PAGAMENTOS PENDENTES"); JSONArray pending=report.getJSONArray("pending"); double debt=0;
        for(int i=0;i<pending.length();i++) { JSONObject item=pending.getJSONObject(i); debt+=item.optDouble("remaining"); wrap(lines,item.optString("customer_name")); wrap(lines,item.optString("order_number")+": "+cashMoney(item.optDouble("remaining"))); }
        if(pending.length()==0) lines.add("Nenhum"); lines.add("TOTAL PENDENTE: "+cashMoney(debt));
        wrap(lines,"Pendencias nao sao dinheiro recebido.");
        return escPos(lines,"FECHAMENTO DE CAIXA");
    }

'''
s=s.replace('    private byte[] receipt(JSONObject order)',block+'    private byte[] receipt(JSONObject order)')
s=s.replace('lines.add(dashes()); lines.add("CONFERÊNCIA DA ENTREGA");', 'if (order.optBoolean("payment_deferred") && !"approved".equals(order.optString("payment_status"))) { lines.add("PAGAMENTO PENDENTE"); lines.add("A RECEBER: " + cashMoney(order.optDouble("total") - order.optDouble("amount_paid"))); }\n        lines.add(dashes()); lines.add("CONFERÊNCIA DA ENTREGA");')
p.write_text(s,encoding='utf-8')
