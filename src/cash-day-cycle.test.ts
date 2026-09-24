import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cashDayAction } from "./cash-day-cycle";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

// Fortaleza = UTC-3. 23h em Fortaleza = 02h UTC do dia seguinte.
describe("ciclo diário do caixa", () => {
  const openedToday = "2026-09-24T11:00:00Z"; // 08h em Fortaleza, 24/09

  it("não faz nada durante o dia", () => {
    expect(cashDayAction({ openedAt: openedToday, now: new Date("2026-09-24T20:00:00Z") })).toBe("none");
  });

  it("pede o fechamento a partir das 23h", () => {
    expect(cashDayAction({ openedAt: openedToday, now: new Date("2026-09-25T02:00:00Z") })).toBe("prompt-close");
  });

  it("respeita o adiamento de 30 minutos e volta a perguntar depois", () => {
    const now = new Date("2026-09-25T02:10:00Z");
    expect(cashDayAction({ openedAt: openedToday, now, snoozedUntil: now.getTime() + 20 * 60 * 1000 })).toBe("none");
    expect(cashDayAction({ openedAt: openedToday, now, snoozedUntil: now.getTime() - 1 })).toBe("prompt-close");
  });

  it("fecha automaticamente à meia-noite, mesmo com adiamento ativo", () => {
    const midnight = new Date("2026-09-25T03:00:00Z");
    expect(cashDayAction({ openedAt: openedToday, now: midnight, snoozedUntil: midnight.getTime() + 60_000 })).toBe("auto-close");
  });

  it("fecha automaticamente um caixa esquecido aberto de outro dia", () => {
    expect(cashDayAction({ openedAt: "2026-09-20T12:00:00Z", now: new Date("2026-09-24T12:00:00Z") })).toBe("auto-close");
  });

  it("exige caixa aberto para qualquer venda e imprime abertura e fechamento", () => {
    const cash = read("src/OperationManualSale.tsx");
    const migration = read("supabase/migrations/20260924120000_cash_day_cycle_and_whatsapp_contacts.sql");
    const tablet = read("android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java");
    expect(cash).toContain('if (!openCashSession) return setNotice("Abra o caixa e informe o dinheiro inicial antes da primeira venda do dia.");');
    expect(cash).toContain('rpc("staff_open_cash_with_report"');
    expect(migration).toContain("create table if not exists public.cash_opening_reports");
    expect(migration).toContain("function public.staff_auto_close_cash_with_report");
    expect(migration).toContain("counted_cash = round(expected, 2)");
    expect(tablet).toContain("pollOpeningReports();");
    expect(tablet).toContain("FECHAMENTO AUTOMATICO");
  });
});
