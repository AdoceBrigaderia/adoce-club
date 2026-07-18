import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("limites das consultas da operação", () => {
  const source = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
  const searchBlock = source.slice(
    source.indexOf("const search = useCallback"),
    source.indexOf("const openCustomer = useCallback"),
  );

  it("busca somente dados cadastrais do cliente", () => {
    expect(searchBlock).toContain('from("profiles")');
    expect(searchBlock).not.toContain('from("account_memberships")');
    expect(searchBlock).not.toContain('from("loyalty_tracks")');
    expect(searchBlock).not.toContain('from("rewards")');
    expect(searchBlock).not.toContain('from("ledger_entries")');
  });

  it("não expõe informações de fidelidade no resultado da busca", () => {
    expect(searchBlock).not.toContain("current_progress");
    expect(searchBlock).not.toContain("available_rewards");
    expect(searchBlock).not.toContain("available_reward_id");
  });
});
