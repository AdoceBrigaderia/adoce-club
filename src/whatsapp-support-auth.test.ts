import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorizeStaffRequest } from "../netlify/functions/_shared/whatsapp-auth";

const supportSource = readFileSync(
  new URL("../netlify/functions/whatsapp-support.ts", import.meta.url),
  "utf8",
);
const authSource = readFileSync(
  new URL("../netlify/functions/_shared/whatsapp-auth.ts", import.meta.url),
  "utf8",
);

describe("autorizacao do atendimento humano pelo WhatsApp", () => {
  it("sempre identifica o operador mesmo com a autenticacao publica", () => {
    expect(supportSource).toContain("authorizeStaffRequest(request, admin)");
    expect(supportSource).not.toContain("authorizeWhatsAppRequest(request, admin)");

    const staffAuthorization = authSource.slice(
      authSource.indexOf("export async function authorizeStaffRequest"),
      authSource.indexOf("export type RateLimitResult"),
    );
    expect(staffAuthorization).toContain('admin.auth.getUser(accessToken)');
    expect(staffAuthorization).toContain('.from("staff_members")');
    expect(staffAuthorization).toContain('["owner", "manager"]');
    expect(staffAuthorization).not.toContain("whatsappAuthAccessMode()");
  });

  it("autoriza proprietario ativo com uma sessao valida", async () => {
    const admin = {
      auth: {
        getUser: async () => ({ data: { user: { id: "staff-user-id" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role: "owner", active: true }, error: null }),
          }),
        }),
      }),
    };

    const result = await authorizeStaffRequest(
      new Request("https://www.adocebrigaderia.com.br/api/whatsapp/support", {
        headers: { Authorization: "Bearer valid-session" },
      }),
      admin as never,
    );

    expect(result.actorUserId).toBe("staff-user-id");
    expect(result.errorResponse).toBeNull();
  });

  it("recusa a caixa humana quando nao existe sessao operacional", async () => {
    const result = await authorizeStaffRequest(
      new Request("https://www.adocebrigaderia.com.br/api/whatsapp/support"),
      {} as never,
    );

    expect(result.actorUserId).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });
});
