import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727082125_site_feedback_notification_routing.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("roteamento interno das mensagens do site", () => {
  it("enriquece somente eventos de feedback com uma rota corporativa estável", () => {
    expect(migration).toContain("new.topic = 'site_feedback.created'");
    expect(migration).toContain("'notification_channel', 'email'");
    expect(migration).toContain(
      "'notification_route', 'business.atendimento'",
    );
    expect(migration).toContain("route_site_feedback_outbox_trigger");
  });

  it("não persiste endereço, senha ou credencial do Google Workspace", () => {
    expect(migration).not.toContain("@adocebrigaderia.com.br");
    expect(migration).not.toMatch(/password|access_token|private_key/i);
  });

  it("mantém a função privada, invoker e inacessível ao navegador", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function private.route_site_feedback_outbox()",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toContain("grant execute");
  });

  it("faz backfill idempotente apenas quando a rota ainda não existe", () => {
    expect(migration).toContain("update public.outbox_events");
    expect(migration).toContain("where topic = 'site_feedback.created'");
    expect(migration).toContain(
      "coalesce(payload->>'notification_route', '') = ''",
    );
  });
});
