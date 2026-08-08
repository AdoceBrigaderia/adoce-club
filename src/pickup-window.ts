// Janela de retirada do dia.
//
// O cliente escolhia o horario da retirada em campo livre, sem limite nenhum.
// Era possivel reservar e marcar 14h num dia em que o Cantinho da Adoce so
// abre as 19h30 - a pessoa chegava na porta fechada. Estas funcoes definem a
// janela valida a partir do proprio cadastro de horarios.

export type PickupHour = {
  channel_slug: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
};

export type PickupWindow = {
  min: string;
  max: string;
};

/** "19:30:00" e "19:30" viram "19:30". */
export function toClock(value: string): string {
  return value.slice(0, 5);
}

/** "19:30" vira 19.5, para comparacao numerica. */
export function clockToNumber(value: string): number {
  const [hour, minute] = toClock(value).split(":");
  const hours = Number(hour);
  const minutes = Number(minute || "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours + minutes / 60;
}

/**
 * Menor abertura e maior fechamento entre as janelas de retirada ativas do dia.
 * Quando ha mais de um ponto (fabrica durante o dia + Cantinho a noite), a
 * janela cobre do primeiro ao ultimo.
 */
export function pickupWindowForDay(
  hours: PickupHour[],
  weekday: number,
  channelSlugs: string[] = ["in_person"],
): PickupWindow | null {
  const windows = hours.filter(
    (hour) =>
      hour.active &&
      hour.weekday === weekday &&
      channelSlugs.includes(hour.channel_slug),
  );
  if (!windows.length) return null;

  const min = windows.reduce(
    (earliest, hour) =>
      clockToNumber(hour.opens_at) < clockToNumber(earliest) ? hour.opens_at : earliest,
    windows[0].opens_at,
  );
  const max = windows.reduce(
    (latest, hour) =>
      clockToNumber(hour.closes_at) > clockToNumber(latest) ? hour.closes_at : latest,
    windows[0].closes_at,
  );

  return { min: toClock(min), max: toClock(max) };
}

export function isPickupTimeAllowed(time: string, window: PickupWindow | null): boolean {
  if (!time) return false;
  if (!window) return true;
  const chosen = clockToNumber(time);
  if (!Number.isFinite(chosen)) return false;
  return chosen >= clockToNumber(window.min) && chosen <= clockToNumber(window.max);
}

/** Mensagem em linguagem de cliente, nunca em linguagem de sistema. */
export function pickupWindowMessage(window: PickupWindow | null): string {
  if (!window) return "Escolha o hor?rio desejado para a retirada.";
  return `A retirada de hoje acontece das ${window.min.replace(":", "h")} ?s ${window.max.replace(":", "h")}. Escolha um hor?rio dentro desse per?odo.`;
}

export function pickupWindowHint(window: PickupWindow | null): string {
  if (!window) return "";
  return `Hoje das ${window.min.replace(":", "h")} ?s ${window.max.replace(":", "h")}.`;
}
