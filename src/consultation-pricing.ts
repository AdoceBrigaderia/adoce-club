export function isPriceOnRequest(name: string): boolean {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR") === "torta de pudim";
}
