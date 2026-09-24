// Regras puras do ciclo diário do caixa (fuso America/Fortaleza, UTC-3 sem horário de verão).

export const fortalezaDateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(date);

export const fortalezaHour = (date: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Fortaleza", hour: "2-digit", hourCycle: "h23" }).format(date));

export type CashDayAction = "none" | "prompt-close" | "auto-close";

/**
 * - Caixa aberto em outro dia (meia-noite passou ou caixa esquecido) → fechar automaticamente.
 * - A partir das 23h do mesmo dia → pedir o fechamento, salvo se adiado há menos de 30 min.
 */
export function cashDayAction({ openedAt, now, snoozedUntil = 0 }: { openedAt: string; now: Date; snoozedUntil?: number }): CashDayAction {
  if (!openedAt) return "none";
  const opened = new Date(openedAt);
  if (Number.isNaN(opened.getTime())) return "none";
  if (fortalezaDateKey(opened) < fortalezaDateKey(now)) return "auto-close";
  if (fortalezaHour(now) >= 23 && now.getTime() >= snoozedUntil) return "prompt-close";
  return "none";
}
