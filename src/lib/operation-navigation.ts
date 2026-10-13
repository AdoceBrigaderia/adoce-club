// Navegação interna da Adoce Operação disparada por telas filhas (Caixa, painel),
// sem recarregar a página. O AccessApp escuta este evento e troca de tela.

export const operationNavigateEvent = "adoce-operation-navigate";

export type StampSale = { orderNumber: string; quantity: number };

export type OperationAreaRequest =
  | { view: "products"; contentTab?: "catalog" | "today" }
  | { view: "attend"; stampSale?: StampSale }
  | { view: "orders"; channel?: "presential" | "official" }
  | { view: "dashboard" };

export function openOperationArea(request: OperationAreaRequest) {
  window.dispatchEvent(new CustomEvent<OperationAreaRequest>(operationNavigateEvent, { detail: request }));
}

// Quantidade de fatias pagas de uma venda: é o que vira carimbo no Clube.
export function paidSliceCount(order: { instant_order_items?: Array<{ quantity: number; is_reward?: boolean | null }> }) {
  return (order.instant_order_items || [])
    .filter((item) => !item.is_reward)
    .reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
}
