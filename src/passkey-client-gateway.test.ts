import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLIENT_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const gateway = readFileSync(
  new URL("./PasskeyClientGateway.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const manager = readFileSync(
  new URL("./PasskeyManager.tsx", import.meta.url),
  "utf8",
);

describe("gateway BFF do cliente", () => {
  it("permite login do cliente por passkey e senha sem token no navegador", () => {
    expect(gateway).toContain('signInWithPasskeyBff("client"');
    expect(gateway).toContain('surface: "client"');
    expect(gateway).not.toContain("requireSupabase");
    expect(gateway).not.toContain("Authorization");
    expect(gateway).not.toContain("localStorage");
  });

  it("carrega cartão e QR somente por RPCs permitidos no BFF", () => {
    expect(CLIENT_RPC_ALLOWLIST).toContain("customer_get_account_workspace");
    expect(CLIENT_RPC_ALLOWLIST).toContain("issue_customer_qr");
    expect(gateway).toContain('clientBffRpc<CustomerWorkspace>("customer_get_account_workspace")');
    expect(gateway).toContain('clientBffRpc<IssuedQr | IssuedQr[]>("issue_customer_qr")');
  });

  it("usa o gateway seguro nas rotas reais de cliente e operação", () => {
    expect(app).toContain('lazy(() => import("./PasskeyClientGateway"))');
    expect(app).toContain('lazy(() => import("./PasskeyOperationGateway"))');
    expect(app).not.toContain('const AccessApp = lazy');
    expect(main).not.toContain("PasskeyOperationGateway");
  });

  it("permite cadastrar passkeys para cliente e equipe", () => {
    expect(manager).toContain('surface = "operation"');
    expect(manager).toContain("registerPasskeyBff(surface)");
    expect(gateway).toContain('<PasskeyManager surface="client"');
  });

  it("retoma automaticamente o check-in após autenticação", () => {
    expect(gateway).toContain("pendingCustomerCheckInReturn()");
    expect(gateway).toContain("clearCustomerCheckInReturn()");
  });
});
