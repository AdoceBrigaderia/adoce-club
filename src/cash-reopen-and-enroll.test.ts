import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { enrollFieldsError, enrollSummary, wantsEnroll } from "./sale-club-enroll";
import { closingReceipt, type FullClosingReport } from "./lib/cash-reports";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("reabertura do caixa", () => {
  const migration = read("supabase/migrations/20260926090000_reopen_cash_session.sql");

  it("só gerente/proprietário, só no mesmo dia e guarda o fechamento anterior", () => {
    expect(migration).toContain("not private.is_manager()");
    expect(migration).toContain("(s.closed_at at time zone 'America/Fortaleza')::date <> (now() at time zone 'America/Fortaleza')::date");
    expect(migration).toContain("insert into private.cash_closing_history");
    expect(migration).toContain("delete from public.cash_closing_reports where session_id = s.id");
  });

  it("fechamento automático de caixa reaberto mantém a diferença contada antes", () => {
    expect(migration).toContain("counted_cash = round(expected + diff, 2), cash_difference = diff");
  });

  it("o ciclo diário conta o dia pela reabertura e a Gestão mostra o botão só no dia", () => {
    expect(read("src/CashDayGuard.tsx")).toContain("openedAt: current.reopened_at || current.opened_at");
    const management = read("src/OperationManagement.tsx");
    expect(management).toContain('rpc("manager_reopen_cash_session"');
    expect(management).toContain("fortalezaDateKey(new Date(s.closed_at)) === today");
  });

  it("cupom avisa que o caixa foi reaberto", () => {
    const report = { number: 3, summary: undefined, session: { reopen_count: 1 } } as FullClosingReport;
    expect(closingReceipt(report).join("\n")).toContain("Relatório indisponível.");
    expect(read("src/lib/cash-reports.ts")).toContain("Caixa reaberto");
  });
});

describe("cadastro no Clube no fechamento da venda", () => {
  it("é opcional: campos vazios não bloqueiam a venda", () => {
    expect(enrollFieldsError("", "")).toBe("");
    expect(wantsEnroll("", "")).toBe(false);
  });

  it("se começou a preencher, exige nome, sobrenome e WhatsApp com DDD", () => {
    expect(enrollFieldsError("Maria", "85999998888")).toContain("sobrenome");
    expect(enrollFieldsError("Maria Silva", "9999")).toContain("DDD");
    expect(enrollFieldsError("Maria Silva", "(85) 99999-8888")).toBe("");
  });

  it("resume carimbos e boas-vindas para o atendente", () => {
    const text = enrollSummary({ existing: false, fullName: "Maria Silva", stampsAdded: 3, progress: 3, newRewards: 0, welcomeSent: true, stampsMessageSent: true, warnings: [] });
    expect(text).toContain("Maria cadastrado(a) no Clube.");
    expect(text).toContain("3 carimbos lançado(s)");
    expect(text).toContain("Boas-vindas");
  });

  it("servidor lança um carimbo por fatia paga (sem fatias de fidelidade) e não repete", () => {
    const fn = read("netlify/functions/staff-enroll-sale-customer.ts");
    expect(fn).toContain("!item.is_reward");
    expect(fn).toContain("idempotency_key: `sale-order:${orderId}`");
    expect(fn).toContain('.eq("action", "customer.enrolled_at_sale")');
    const messages = read("netlify/functions/_shared/loyalty-messages.ts");
    expect(messages).toContain("cada fatia comprada vale 1 carimbo e, ao juntar 14 carimbos, você ganha uma fatia tradicional grátis");
    expect(messages).toContain('env("TWILIO_CLUB_WELCOME_CONTENT_SID")');
  });
});
