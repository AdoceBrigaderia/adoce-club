import type { Unit } from "./cost-engine";

export const requiredCakeSection = "Desmoldante e irrigação";
export function requiredCakePreparations(workspace: {
  recipes: { id: string; name: string; active: boolean; recipe_kind: string }[];
  versions: { id: string; recipe_id: string; version_number: number; size_code: string | null; yield_unit: string | null; yield_quantity: number | null }[];
}): { kind: "recipe_version"; id: string; quantity: string; unit: Unit; placement: string }[] {
  return [{ name: "DESMOLDANTE FORMAS", quantity: "40", unit: "g" as const }, { name: "IRRIGAÇÃO", quantity: "300", unit: "ml" as const }].map(source => {
    const recipe = workspace.recipes.find(r => r.active && r.recipe_kind === "intermediate" && r.name.trim().toLocaleUpperCase("pt-BR") === source.name);
    const version = recipe && workspace.versions.filter(v => v.recipe_id === recipe.id && v.size_code === null).sort((a, b) => b.version_number - a.version_number)[0];
    if (!version || version.yield_unit !== source.unit || !(Number(version.yield_quantity) > 0)) throw new Error(`Confira a preparação ${source.name} e seu rendimento em ${source.unit}.`);
    return { kind: "recipe_version", id: version.id, quantity: source.quantity, unit: source.unit, placement: requiredCakeSection };
  });
}
