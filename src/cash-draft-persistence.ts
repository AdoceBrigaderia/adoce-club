// Implemented after the regression test proves the contract.
export const cashDraftStorageKey = (sessionId: string) => `adoce:cash-draft:${sessionId}`;

export const cashDraftRequestedItems = (quantities: Record<string, number>) => Object.entries(quantities)
  .filter(([, quantity]) => quantity > 0)
  .map(([flavor_id, quantity]) => ({ flavor_id, quantity }));
