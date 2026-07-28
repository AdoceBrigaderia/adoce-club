import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OPERATION_RPC_ALLOWLIST,
  isAllowedOperationRpc,
} from "../netlify/functions/_shared/bff-rpc-policy";

const serverSource = readFileSync(
  new URL("../netlify/functions/auth-bff-rpc.ts", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("./services/bff-rpc.ts", import.meta.url),
  "utf8",
);

describe("RPCs protegidos pelo BFF", () => {
  it("mantém allowlist explícita das operações liberadas", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_get_business_workspace");
    expect(OPERATION_RPC_ALLOWLIST).toContain(
      "staff_create_manual_sale_in_cash_v2",
    );
    expect(OPERATION_RPC_ALLOWLIST).toContain("manager_update_staff_member");
    expect(isAllowedOperationRpc("staff_open_cash_session")).toBe(true);
    expect(isAllowedOperationRpc("qualquer_rpc_injetada")).toBe(false);
  });

  it("exige cookie operacional, origem confiável e CSRF", () => {
    expect(serverSource).toContain("allowedOrigin(request");
    expect(serverSource).toContain("validCsrf(request)");
    expect(serverSource).toContain('cookies.get(SURFACE_COOKIE) !== "operation"');
    expect(serverSource).toContain("cookies.get(ACCESS_COOKIE)");
  });

  it("preserva RLS usando o JWT do usuário e nunca service role", () => {
    expect(serverSource).toContain("Authorization: `Bearer ${accessToken}`");
    expect(serverSource).toContain("SUPABASE_PUBLISHABLE_KEY");
    expect(serverSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serverSource).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("não permite ao navegador escolher endpoints ou enviar bearer token", () => {
    expect(serverSource).toContain("isAllowedOperationRpc(body.rpc)");
    expect(clientSource).toContain('fetch("/api/auth-bff-rpc"');
    expect(clientSource).toContain('"X-CSRF-Token": csrfToken');
    expect(clientSource).not.toContain("Authorization");
    expect(clientSource).not.toContain("requireSupabase");
  });

  it("renova cookies no servidor e repete uma única vez após 401", () => {
    expect(clientSource).toContain('errorPayload.code !== "session_refresh_required"');
    expect(clientSource).toContain("await getBffSession()");
    expect(clientSource).toContain("const retry = await requestRpc");
  });
});
