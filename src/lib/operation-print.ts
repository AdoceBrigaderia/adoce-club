export type OperationPrintFormat = "thermal" | "a4";

export function printOperation(format: OperationPrintFormat) {
  document.documentElement.dataset.operationPrintFormat = format;
  window.print();
}
