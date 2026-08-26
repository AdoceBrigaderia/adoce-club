// Janelas de retirada do dia.
//
// O cliente escolhia o horario da retirada em campo livre, sem limite nenhum.
// Era possivel reservar e marcar 14h num dia em que o Cantinho da Adoce so
// abre as 19h30 - a pessoa chegava na porta fechada.
//
// A primeira versao devolvia UMA janela, da menor abertura ao maior fechamento.
// Isso quebra quando ha dois pontos de retirada no mesmo dia: fabrica das 10h
// as 16h e Cantinho das 19h30 as 22h virariam "das 10h as 22h", liberando 17h30,
// quando nao ha ninguem em lugar nenhum. Agora trabalhamos com a lista de
// janelas e validamos se o horario cai dentro de alguma delas - nunca no vao.

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

const byStart = (a: PickupWindow, b: PickupWindow) =>
  clockToNumber(a.min) - clockToNumber(b.min);

/**
 * Todas as janelas de retirada ativas do dia, ordenadas e com sobreposicoes
 * unidas. Duas faixas que se encostam viram uma so; faixas separadas por um
 * vao continuam separadas.
 */
export function pickupWindowsForDay(
  hours: PickupHour[],
  weekday: number,
  channelSlugs: string[] = ["in_person"],
): PickupWindow[] {
  const found = hours
    .filter(
      (hour) =>
        hour.active &&
        hour.weekday === weekday &&
        channelSlugs.includes(hour.channel_slug),
    )
    .map((hour) => ({ min: toClock(hour.opens_at), max: toClock(hour.closes_at) }))
    .filter((window) => clockToNumber(window.min) < clockToNumber(window.max))
    .sort(byStart);

  const merged: PickupWindow[] = [];
  for (const window of found) {
    const last = merged[merged.length - 1];
    if (last && clockToNumber(window.min) <= clockToNumber(last.max)) {
      if (clockToNumber(window.max) > clockToNumber(last.max)) last.max = window.max;
      continue;
    }
    merged.push({ ...window });
  }
  return merged;
}

/** Primeira abertura e ultimo fechamento — serve para os atributos min/max do campo. */
export function pickupBoundsForDay(windows: PickupWindow[]): PickupWindow | null {
  if (!windows.length) return null;
  return { min: windows[0].min, max: windows[windows.length - 1].max };
}

export function isPickupTimeAllowed(time: string, windows: PickupWindow[] | null): boolean {
  if (!time) return false;
  if (!windows || !windows.length) return true;
  const chosen = clockToNumber(time);
  if (!Number.isFinite(chosen)) return false;
  return windows.some(
    (window) =>
      chosen >= clockToNumber(window.min) && chosen <= clockToNumber(window.max),
  );
}

const hhmm = (value: string) => value.replace(":", "h");

/** Mensagem em linguagem de cliente, nunca em linguagem de sistema. */
export function pickupWindowMessage(windows: PickupWindow[] | null): string {
  if (!windows || !windows.length) return "Escolha o horário desejado para a retirada.";
  const faixas = windows.map((w) => `${hhmm(w.min)} às ${hhmm(w.max)}`);
  const lista =
    faixas.length === 1
      ? faixas[0]
      : `${faixas.slice(0, -1).join(", ")} ou ${faixas[faixas.length - 1]}`;
  return `A retirada de hoje acontece das ${lista}. Escolha um horário dentro desse período.`;
}

export function pickupWindowHint(windows: PickupWindow[] | null): string {
  if (!windows || !windows.length) return "";
  const faixas = windows.map((w) => `${hhmm(w.min)} às ${hhmm(w.max)}`);
  const lista =
    faixas.length === 1
      ? faixas[0]
      : `${faixas.slice(0, -1).join(", ")} e ${faixas[faixas.length - 1]}`;
  return `Hoje das ${lista}.`;
}
