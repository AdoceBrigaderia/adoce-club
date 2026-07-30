export const PRELOAD_RECOVERY_STORAGE_KEY = "adoce-preload-recovery";
export const PRELOAD_RECOVERY_WINDOW_MS = 10_000;

export function shouldRecoverPreloadError(
  lastReload: number,
  now = Date.now(),
  windowMs = PRELOAD_RECOVERY_WINDOW_MS,
) {
  if (!Number.isFinite(lastReload) || lastReload <= 0) return true;
  return now - lastReload >= windowMs;
}

export function recoveryTimestamp(storage: Pick<Storage, "getItem">) {
  return Number(storage.getItem(PRELOAD_RECOVERY_STORAGE_KEY) || 0);
}
