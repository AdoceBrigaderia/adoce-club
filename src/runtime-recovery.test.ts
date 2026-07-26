import { describe, expect, it } from "vitest";
import {
  PRELOAD_RECOVERY_STORAGE_KEY,
  recoveryTimestamp,
  shouldRecoverPreloadError,
} from "./runtime-recovery";

describe("recuperação de atualização do portal", () => {
  it("permite a primeira recuperação", () => {
    expect(shouldRecoverPreloadError(0, 20_000)).toBe(true);
    expect(shouldRecoverPreloadError(Number.NaN, 20_000)).toBe(true);
  });

  it("bloqueia ciclos de recarregamento em menos de dez segundos", () => {
    expect(shouldRecoverPreloadError(15_001, 20_000)).toBe(false);
  });

  it("libera uma nova tentativa depois da janela de segurança", () => {
    expect(shouldRecoverPreloadError(10_000, 20_000)).toBe(true);
  });

  it("lê o horário armazenado de forma previsível", () => {
    const storage = {
      getItem(key: string) {
        return key === PRELOAD_RECOVERY_STORAGE_KEY ? "12345" : null;
      },
    };
    expect(recoveryTimestamp(storage)).toBe(12345);
  });
});
