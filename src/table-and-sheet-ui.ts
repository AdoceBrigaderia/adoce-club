export type TableViewport = {
  headerTop: number;
  tableBottom: number;
  headerHeight: number;
  visible: boolean;
};

export function floatingTableIndex(tables: TableViewport[], top: number) {
  return tables.findIndex(table => table.visible && table.headerHeight > 0 && table.headerTop < top && table.tableBottom > top + table.headerHeight);
}

const compactHeaders: Record<string, string> = {
  "Ingredientes da torta": "Ingredientes\nda torta",
  "Ingredientes por fatia": "Ingredientes\npor fatia",
  "Descartáveis por fatia": "Descartáveis\npor fatia",
  "Finalização por fatia": "Finalização\npor fatia",
  "Custo total por fatia": "Custo total\npor fatia",
  "Margem após custos e taxas": "Margem após\ncustos e taxas",
  "Preço de venda ideal": "Preço ideal\nde venda",
  "Margem no preço ideal": "Margem no\npreço ideal",
};

export const compactCostHeader = (title: string) => compactHeaders[title] || title;

type ProblemRow = { id: string; quantity: string; label?: string };

export function firstProblemRow(rows: ProblemRow[], missing: string[]) {
  const structurallyIncomplete = rows.findIndex(row => !row.id || !row.quantity || Number(row.quantity) <= 0);
  if (structurallyIncomplete >= 0) return structurallyIncomplete;
  const normalizedMissing = missing.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const named = rows.findIndex(row => row.label && normalizedMissing.includes(row.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")));
  return named >= 0 ? named : rows.length ? 0 : -1;
}

type Usage = { used: boolean; cakes: string[] };
type ItemIdentity = { id: string; name: string; internalCode: string };

const words = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").split(/[^a-z0-9]+/).filter(word => word.length >= 4);

export function describeItemUsage(item: ItemIdentity, usage: Usage | undefined, similar: { item: ItemIdentity; usage: Usage }[]) {
  if (usage?.cakes.length) return usage.cakes.join(" · ");
  if (usage?.used) return "Usado em preparações; sem torta vinculada";
  const tokens = new Set(words(item.name));
  const alternative = similar.find(candidate => candidate.item.id !== item.id && candidate.usage.used && words(candidate.item.name).some(word => tokens.has(word)));
  return alternative
    ? `Sem uso neste cadastro. A ficha ${alternative.usage.cakes[0] || "técnica"} usa outro item: ${alternative.item.name} · ${alternative.item.internalCode}.`
    : "Sem uso em composição";
}
