import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gateway = readFileSync(
  new URL("./PasskeyOperationGateway.tsx", import.meta.url),
  "utf8",
);
const manager = readFileSync(
  new URL("./PasskeyManager.tsx", import.meta.url),
  "utf8",
);
const main = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const styles = readFileSync(
  new URL("./passkey-operation-gateway.css", import.meta.url),
  "utf8",
);

describe("gateway operacional seguro", () => {
  it("assume a rota operacional sem alterar produção", () => {
    expect(gateway).toContain('location.hash.startsWith("#operacao")');
    expect(main).toContain("<PasskeyOperationGateway />");
    expect(gateway).toContain("<OperationBusinessHub />");
  });

  it("oferece senha e biometria pelo BFF", () => {
    expect(gateway).toContain("signInWithPasskeyBff");
    expect(gateway).toContain("bffPasswordLogin");
    expect(gateway).toContain("bffLogout");
    expect(gateway).not.toContain("requireSupabase");
    expect(gateway).not.toContain("Authorization");
  });

  it("abre a gestão de biometria somente depois do login", () => {
    expect(gateway).toContain("<PasskeyManager");
    expect(gateway).toContain("Gerenciar biometria");
    expect(gateway.indexOf("session ? (")).toBeLessThan(
      gateway.indexOf("Gerenciar biometria"),
    );
    expect(manager).toContain("registerPasskeyBff");
    expect(manager).toContain("deletePasskeyBff");
    expect(manager).toContain("renamePasskeyBff");
  });

  it("mantém áreas de toque grandes", () => {
    expect(styles).toContain("min-height:86px");
    expect(styles).toContain("min-height:62px");
    expect(styles).toContain("min-height:58px");
  });
});
