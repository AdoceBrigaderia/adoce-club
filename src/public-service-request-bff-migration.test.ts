import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727103000_public_service_request_bff_only.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("pré-reserva comercial somente pelo BFF", () => {
  it("adiciona chave idempotente e trava solicitações concorrentes", () => {
    expect(migration).toContain("add column if not exists public_request_key uuid");
    expect(migration).toContain("service_requests_public_request_key_idx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("where request.public_request_key = requested_operation_key");
    expect(migration).toContain("'idempotent', true");
  });

  it("mantém criação e vínculo opcional do cliente na mesma transação", () => {
    expect(migration).toContain("response := public.submit_service_request(");
    expect(migration).toContain("linked_profile_id := requested_profile_id");
    expect(migration).toContain("profile_id = coalesce(linked_profile_id, profile_id)");
    expect(migration).toContain("set search_path = ''");
  });

  it("remove o RPC público do navegador e autoriza somente service_role", () => {
    expect(migration).toMatch(
      /revoke all on function public\.submit_service_request\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.submit_service_request\([\s\S]*to service_role/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.submit_service_request_bff\([\s\S]*from public, anon, authenticated/,
    );
  });
});
