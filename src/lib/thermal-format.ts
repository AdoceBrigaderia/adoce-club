// Formatação de cupons para a impressora térmica de 58 mm (32 colunas).
// Marcadores lidos pelo app do tablet (AdoceOrderService.escPosMarked):
//   "#H texto" → destaque (negrito, grande e centralizado)
//   "#B texto" → negrito
// Linhas sem marcador saem normais. Acentos são mantidos (a impressora usa CP860).

export const WIDTH = 32;

export const money = (value: number | string | null | undefined) =>
  `R$ ${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const signedMoney = (value: number) => (value < 0 ? `-${money(Math.abs(value))}` : money(value));

export const dashes = () => "-".repeat(WIDTH);
export const doubleLine = () => "=".repeat(WIDTH);

export const center = (text: string) => {
  const clean = text.slice(0, WIDTH);
  return " ".repeat(Math.max(0, Math.floor((WIDTH - clean.length) / 2))) + clean;
};

/** Texto à esquerda e valor à direita na mesma linha (quebra o texto se não couber). */
export const pair = (label: string, value: string | number) => {
  const right = String(value);
  const room = WIDTH - right.length - 1;
  if (label.length <= room) return [label + " ".repeat(WIDTH - label.length - right.length) + right];
  return [...wrap(label), " ".repeat(Math.max(0, WIDTH - right.length)) + right];
};

export const wrap = (text: string, width = WIDTH) => {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut < 1) cut = width;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) lines.push(rest);
  return lines;
};

export const title = (text: string) => `#B ${text.toUpperCase()}`;
export const highlight = (text: string) => `#H ${text}`;

const tz = "America/Fortaleza";
export const dateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(new Date(value)) : "-";
export const timeOnly = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(value)) : "-";
export const dateOnly = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: tz }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "-";

export const cashNumber = (value: number | string | null | undefined) => `Nº ${String(value ?? "-").padStart(4, "0")}`;

export const methodLabel = (code: string) =>
  ({ cash: "Dinheiro", pix: "Pix", credit_card: "Crédito", debit_card: "Débito", payroll: "Desconto em folha" } as Record<string, string>)[code] || code;

export const channelLabel = (code: string) =>
  ({ operation: "Balcão / operação", site: "Site", whatsapp: "WhatsApp" } as Record<string, string>)[code] || code;

/** Remove os marcadores para mostrar o cupom na tela. */
export const plainText = (lines: string[]) => lines.map((line) => line.replace(/^#[HB] /, "")).join("\n");

export const header = (...titleLines: string[]) => [highlight("ADOCE BRIGADERIA"), ...titleLines.map((line) => `#B ${center(line)}`)];

export const footer = (lines: string[] = []) => [...lines, "", ""];

export const percent = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%";
