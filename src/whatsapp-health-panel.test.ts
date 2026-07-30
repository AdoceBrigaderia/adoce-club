import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const panel = readFileSync(
  new URL("./OperationWhatsAppHealth.tsx", import.meta.url),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../netlify/functions/meta-whatsapp-health.ts", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-whatsapp-health.css", import.meta.url),
  "utf8",
);

describe("painel de saude do WhatsApp", () => {
  it("usa sessão BFF, guard central e RPC gerencial", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain(
      "manager_get_whatsapp_otp_metrics",
    );
    expect(panel).toContain("getBffSession()");
    expect(panel).toContain('bffRpc<Metrics>("manager_get_whatsapp_otp_metrics"');
    expect(panel).not.toContain("requireSupabase");
    expect(panel).not.toContain("Authorization");
    expect(endpoint).toContain("guardBffRequest(request");
    expect(endpoint).toContain('methods: ["GET"]');
    expect(endpoint).toContain('configuredSiteUrl: env("SITE_URL")');
    expect(endpoint).not.toContain("allowedOrigin(request");
    expect(endpoint).toContain('cookies.get(SURFACE_COOKIE) !== "operation"');
    expect(endpoint).toContain("cookies.get(ACCESS_COOKIE)");
  });

  it("não entrega segredos da Meta ao navegador", () => {
    expect(endpoint).toContain('["owner", "manager"].includes(staff.role)');
    expect(endpoint).toContain("secretsExposed: false");
    expect(endpoint).toContain("phoneNumberId: suffix(");
    expect(endpoint).toContain("wabaId: suffix(");
    expect(endpoint).not.toContain("accessToken:");
    expect(endpoint).not.toContain("appSecret:");
    expect(endpoint).not.toContain("verifyToken:");
  });

  it("mostra configuração, entrega, verificação, falhas e custo", () => {
    expect(panel).toContain("Custo estimado");
    expect(panel).toContain("delivery_rate");
    expect(panel).toContain("verification_rate");
    expect(panel).toContain("recent_failures");
    expect(panel).toContain("health.missing.map");
  });

  it("fica integrado na central e otimizado para toque", () => {
    expect(hub).toContain("<OperationWhatsAppHealth />");
    expect(styles).toContain("min-height:52px");
    expect(styles).toContain("@media(max-width:760px)");
  });
});
