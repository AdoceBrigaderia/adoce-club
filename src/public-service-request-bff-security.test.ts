import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const endpoint = readFileSync(
  new URL("../netlify/functions/public-service-request.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./services/public-service-request.ts", import.meta.url),
  "utf8",
);
const supabaseAdapter = readFileSync(
  new URL("./lib/supabase.ts", import.meta.url),
  "utf8",
);
const catalog = readFileSync(
  new URL("./CommercialCatalog.tsx", import.meta.url),
  "utf8",
);

describe("corte BFF da pré-reserva comercial", () => {
  it("valida origem, tamanho e conteúdo antes de chamar o banco", () => {
    expect(endpoint).toContain('request.headers.get("origin")');
    expect(endpoint).toContain("allowedOrigin");
    expect(endpoint).toContain("contentLength > 16_384");
    expect(endpoint).toContain("UUID.test(operationKey)");
    expect(endpoint).toContain("EMAIL.test(customerEmail)");
    expect(endpoint).toContain("end <= start");
  });

  it("mantém o segredo somente na Function e vincula cliente apenas por cookie HttpOnly", () => {
    expect(endpoint).toContain("ACCESS_COOKIE");
    expect(endpoint).toContain("SURFACE_COOKIE");
    expect(endpoint).toContain("SUPABASE_SECRET_KEY");
    expect(endpoint).toContain("submit_service_request_bff");
    expect(endpoint).not.toContain("VITE_SUPABASE_SECRET_KEY");
    expect(service).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("usa chave idempotente e repete falha transitória sem duplicar", () => {
    expect(service).toContain("const operationKey = crypto.randomUUID()");
    expect(service).toContain("send(input, operationKey)");
    expect(service).toContain("[502, 503, 504]");
  });

  it("intercepta o RPC legado sem alterar a experiência pública", () => {
    expect(catalog).toContain('.rpc("submit_service_request"');
    expect(supabaseAdapter).toContain(
      'if (functionName === "submit_service_request")',
    );
    expect(supabaseAdapter).toContain("protectedServiceRequestRpc(args)");
    expect(supabaseAdapter).toContain("submitPublicServiceRequest");
  });
});
