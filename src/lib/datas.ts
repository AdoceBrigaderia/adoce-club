const TIME_ZONE = "America/Fortaleza";

const validDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function formatarDataHora(value: string) {
  const date = validDate(value);
  if (!date) return "data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE,
  }).format(date).replace(", ", " às ");
}

export function formatarDataHoraCurta(value: string) {
  const date = validDate(value);
  if (!date) return "data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE,
  }).format(date).replace(", ", " · ");
}

export function formatarHora(value: string) {
  const date = validDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE,
  }).format(date);
}

export function quando(value: string) {
  const date = validDate(value);
  if (!date) return "";
  const data = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE,
  }).format(date);
  return `${data} as ${formatarHora(value).replace(":", "h")}`;
}
