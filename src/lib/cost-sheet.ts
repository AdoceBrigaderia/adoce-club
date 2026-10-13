import type { Unit } from "./cost-engine";

export const slicePackagingSection = "Embalagens e descartáveis por fatia";
export const sliceFinishingSection = "Finalização por fatia";
export const isPerSliceSection = (section: string) => section === slicePackagingSection || section === sliceFinishingSection;
export function suggestedSliceFinishing(workspace: {
  recipes: { id: string; name: string; active: boolean }[];
  versions: { id: string; recipe_id: string; version_number: number; size_code: string | null; yield_unit: string | null; yield_quantity: number | null }[];
}): { kind: "recipe_version"; id: string; quantity: string; unit: Unit; placement: string }[] {
  const recipe = workspace.recipes.find(r => r.active && r.name.trim().toLocaleUpperCase("pt-BR") === "CALDA");
  const version = recipe && workspace.versions.filter(v => v.recipe_id === recipe.id && v.size_code === null).sort((a, b) => b.version_number - a.version_number)[0];
  return version && version.yield_unit === "unit" && Number(version.yield_quantity) > 0
    ? [{ kind: "recipe_version", id: version.id, quantity: "1", unit: "unit", placement: sliceFinishingSection }] : [];
}
export function suggestedSlicePackaging(workspace: {
  recipes: { id: string; name: string; active: boolean }[];
  versions: { id: string; recipe_id: string; version_number: number; size_code: string | null; yield_quantity: number | null; yield_unit: string | null }[];
  components: { recipe_version_id: string; placement: string; component_kind: string; item_id: string | null; quantity: number | null; unit: string; sort_order: number }[];
}): { kind: "item"; id: string; quantity: string; unit: Unit; placement: string }[] {
  const source = workspace.recipes.find(r => r.active && r.name.localeCompare("Abacaxi com Coco", "pt-BR", { sensitivity: "base" }) === 0);
  const version = source && workspace.versions.filter(v => v.recipe_id === source.id && v.size_code === "G").sort((a, b) => b.version_number - a.version_number)[0];
  if (!version || version.yield_unit !== "slice" || !version.yield_quantity) return [];
  return workspace.components.filter(c => c.recipe_version_id === version.id && c.placement === slicePackagingSection && c.component_kind === "item" && c.item_id && c.quantity && c.quantity > 0)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({ kind: "item", id: c.item_id!, quantity: packagingQuantity(c.quantity, version.yield_quantity!, "edit"), unit: c.unit as Unit, placement: slicePackagingSection }));
}
// Persist quantities for a whole cake, keeping purchasing and financial exports consistent.
export function packagingQuantity(quantity: string | number | null, slices: number, direction: "save" | "edit"): string {
  if (quantity == null || quantity === "") return "";
  if (!Number.isSafeInteger(slices) || slices <= 0) throw new Error("Informe um rendimento válido em fatias");
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Informe a quantidade usada por fatia");
  return String(Math.round((direction === "save" ? value * slices : value / slices) * 1e6) / 1e6);
}
export const cakeSections = [
  { name: "Discos de bolo", hint: "Adicione os três discos. Cada seleção carrega o rendimento de um disco.", count: 3 },
  { name: "Recheios", hint: "Adicione os dois recheios. Cada seleção carrega uma preparação completa.", count: 2 },
  { name: "Misturas", hint: "Acrescente geleias, outras preparações ou insumos aos recheios.", count: 0 },
  { name: "Cobertura", hint: "Use uma preparação inteira ou ajuste a quantidade para uma parte dela. Acrescente os insumos da cobertura.", count: 0 },
  { name: slicePackagingSection, hint: "Informe a quantidade para uma fatia. O sistema multiplica pelo rendimento da torta. Sacolas e caixas compartilhadas entre várias fatias pertencem ao pedido.", count: 0 },
  { name: sliceFinishingSection, hint: "Preparações e insumos servidos na entrega. Informe o consumo de uma fatia: Calda = 1 unidade. O custo usa o rendimento cadastrado da preparação, e o planejamento multiplica pelas fatias da torta.", count: 0 },
];

export function selectedComponentQuantity(kind: "item" | "recipe_version", source?: { consumption_unit?: string; yield_unit?: string | null; yield_quantity?: number | null }): { quantity: string; unit: Unit } {
  const supported: Unit[] = ["g", "kg", "ml", "l", "unit"];
  const unit = (kind === "item" ? source?.consumption_unit : source?.yield_unit) as Unit;
  return {
    quantity: kind === "recipe_version" && source?.yield_quantity != null ? String(source.yield_quantity) : "",
    unit: supported.includes(unit) ? unit : "g",
  };
}
