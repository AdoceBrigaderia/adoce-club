import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./OperationPrivacyRequests.tsx", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("painel operacional de privacidade", () => {
  it("usa somente o BFF autorizado e integra a Central da Operação", () => {
    expect(component).toContain('bffRpc<PrivacyRequest[]>');
    expect(component).toContain('"staff_list_privacy_requests"');
    expect(component).toContain('"staff_update_privacy_request"');
    expect(component).not.toContain("requireSupabase");
    expect(component).not.toContain("from(\"site_feedback\")");
    expect(hub).toContain("<OperationPrivacyRequests />");
    expect(policy).toContain('"staff_list_privacy_requests"');
    expect(policy).toContain('"staff_update_privacy_request"');
  });

  it("oferece filtros, contato, notas e ações rápidas", () => {
    expect(component).toContain("Solicitações de privacidade");
    expect(component).toContain("Novas");
    expect(component).toContain("Em análise");
    expect(component).toContain("Marcar resolvida");
    expect(component).toContain("Responder por e-mail");
    expect(component).toContain("Responder no WhatsApp");
    expect(component).toContain("Anotação interna");
  });

  it("oculta o módulo quando o backend nega a capacidade", () => {
    expect(component).toContain('includes("não autorizado")');
    expect(component).toContain("if (hidden) return null");
  });
});
