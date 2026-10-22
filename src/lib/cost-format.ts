export const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatQuantity = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const formatUnitCost = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: value < 0.01 ? 5 : 2, maximumFractionDigits: 6 });
export const formatDate = (date: string) => date.split("-").reverse().join("/");
