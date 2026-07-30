const pendingKeys = new Map<string, string>();

export function pendingOperationKey(
  scope: string,
  payload: Record<string, unknown>,
) {
  const fingerprint = `${scope}:${JSON.stringify(payload)}`;
  const current = pendingKeys.get(fingerprint);
  if (current) return { fingerprint, value: current };
  const value = crypto.randomUUID();
  pendingKeys.set(fingerprint, value);
  return { fingerprint, value };
}

export function completeOperation(fingerprint: string) {
  pendingKeys.delete(fingerprint);
}
