import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const endpoint = readFileSync(
  new URL("../netlify/functions/public-instant-order.ts", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("./services/public-instant-order.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728165303_harden_public_instant_order_submission.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("submissão pública de pedido instantâneo", () => {
  it("limita abuso por IP e WhatsApp sem persistir os identificadores crus", () => {
    expect(endpoint).toContain('ipRateLimitRule(request, "instant-order:ip"');
    expect(endpoint).toContain('bucket: "instant-order:phone"');
    expect(endpoint).toContain("consumePublicRateLimits");
    expect(endpoint).toContain("PUBLIC_RATE_LIMIT_PEPPER");
  });

  it("mantém uma chave UUID durante a submissão e eventuais retries de sessão", () => {
    expect(client).toContain("const operationKey = crypto.randomUUID()");
    expect(client).toContain("requested_operation_key: operationKey");
    expect(endpoint).toContain('"submit_instant_order_v6"');
    expect(endpoint).toContain("requested_operation_key: operationKey");
  });

  it("serializa a operação e devolve a resposta anterior sem criar outro pedido", () => {
    expect(migration).toContain(
      "'public-instant-order:' || requested_operation_key::text",
    );
    expect(migration).toContain("previous_request.response_payload");
    expect(migration).toContain("jsonb_build_object('idempotent', true)");
    expect(migration).toContain(
      "previous_request.request_hash <> calculated_request_hash",
    );
    expect(migration).toContain("consume_public_endpoint_rate_limit_bff");
    expect(migration).toContain("instant-order:db-phone");
    expect(migration).toContain("instant-order:db-account");
    expect(migration).toContain("caller_id uuid := auth.uid()");
  });

  it("fecha a versão não idempotente e protege a tabela privada", () => {
    expect(migration).toMatch(
      /revoke all on function public\.submit_instant_order_v5\([\s\S]*authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /revoke all on table private\.public_instant_order_requests[\s\S]*public, anon, authenticated;/,
    );
  });
});
