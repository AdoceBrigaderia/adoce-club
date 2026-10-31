import { describe, expect, it } from "vitest";
import { loadApology } from "../netlify/functions/_shared/duplicate-stamps-apology-data";

function database() {
  const ledger = Array.from({ length: 144 }, (_, i) => ({ track_id: `track-${i % 100}`, subject_profile_id: `profile-${i % 100}`, stamps_delta: i < 89 ? -2 : -1 }));
  const tables: Record<string, { data: unknown[]; count?: number; error: unknown }> = {
    ledger_entries: { data: ledger, count: 144, error: null },
    profiles: { data: Array.from({ length: 100 }, (_, i) => ({ id: `profile-${i}`, full_name: "Ana Maria", phone_e164: "+5585999999999" })), error: null },
    loyalty_tracks: { data: Array.from({ length: 100 }, (_, i) => ({ id: `track-${i}`, current_progress: 5 })), error: null },
    rewards: { data: Array.from({ length: 8 }, (_, i) => ({ track_id: `track-${i}` })), error: null },
    audit_events: { data: [], count: 0, error: null },
  };
  const admin = { from: (table: string) => {
    const query: Record<string, unknown> = { then: (resolve: (result: unknown) => void) => resolve(tables[table]) };
    for (const method of ["select", "like", "limit", "in", "eq"]) query[method] = () => query;
    return query;
  } };
  return { tables, admin };
}

describe("leitura segura do incidente", () => {
  it("agrupa as 144 reversões em 100 cartões e exclui todo marcador anterior", async () => {
    const { tables, admin } = database();
    tables.audit_events = { data: [
      { entity_id: "track-0", action: "stamps.duplicate_apology_sent" },
      { entity_id: "track-1", action: "stamps.duplicate_apology_failed" },
      { entity_id: "track-2", action: "stamps.duplicate_apology_claimed" },
    ], count: 3, error: null };
    const result = await loadApology(admin as never);
    expect(result).toMatchObject({ total: 100, normal: 92, reversed: 8, pending: 97, sent: 1, failed: 1, uncertain: 1 });
    expect(result.recipients.map(row => row.track_id)).not.toContain("track-0");
  });
  it("interrompe para escopo inesperado ou leitura parcial de auditoria", async () => {
    const scope = database(); scope.tables.ledger_entries.count = 145;
    await expect(loadApology(scope.admin as never)).rejects.toThrow("incident_scope_mismatch");
    const audit = database(); audit.tables.audit_events.count = 1;
    await expect(loadApology(audit.admin as never)).rejects.toThrow("recipient_read_failed");
    const rewards = database(); rewards.tables.rewards.data.pop();
    await expect(loadApology(rewards.admin as never)).rejects.toThrow("incident_reward_mismatch");
  });
  it("não ignora erros de leitura nem clientes sem perfil/telefone", async () => {
    const error = database(); error.tables.profiles.error = { code: "database_down" };
    await expect(loadApology(error.admin as never)).rejects.toThrow("recipient_read_failed");
    const missing = database(); missing.tables.profiles.data.pop();
    await expect(loadApology(missing.admin as never)).rejects.toThrow("invalid_recipient");
  });
});
