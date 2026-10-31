import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Banco Postgres embutido e descartavel, sem rede e sem credenciais reais.
// Instalar para este ensaio: npm install --no-save --package-lock=false --prefix .private/apology-sql @electric-sql/pglite
const { PGlite } = await import("../.private/apology-sql/node_modules/@electric-sql/pglite/dist/index.js");
const db = new PGlite();
const track = "10000000-0000-0000-0000-000000000001";
const owner = "20000000-0000-0000-0000-000000000001";
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create table public.staff_members(user_id uuid primary key, role text, active boolean);
  create table public.ledger_entries(track_id uuid, idempotency_key text);
  create table public.loyalty_tracks(id uuid, current_progress integer);
  create table public.rewards(track_id uuid, status text);
  create table public.audit_events(id bigint generated always as identity, actor_user_id uuid, action text, entity_type text, entity_id text, payload jsonb);
  alter table public.audit_events enable row level security;
  grant select, insert, update, delete on public.audit_events to authenticated;
  grant usage on sequence public.audit_events_id_seq to authenticated;
  create policy legacy_manager_insert on public.audit_events for insert to authenticated with check (true);
  create policy test_manager_read on public.audit_events for select to authenticated using (true);
  create policy test_manager_update on public.audit_events for update to authenticated using (true);
  create policy test_manager_delete on public.audit_events for delete to authenticated using (true);
  insert into public.staff_members values ('${owner}','owner',true);
  insert into public.ledger_entries values ('${track}','dup-reversal:test');
  insert into public.loyalty_tracks values ('${track}',5);
  insert into public.rewards values ('${track}','reversed');
`);
const original = JSON.stringify((await db.query(`select (select jsonb_agg(l) from ledger_entries l) ledger, (select jsonb_agg(t) from loyalty_tracks t) tracks, (select jsonb_agg(r) from rewards r) rewards`)).rows);
await db.exec(readFileSync("supabase/migrations/20261031200000_duplicate_stamp_apology_guard.sql", "utf8"));
const claim = () => db.query("select public.server_claim_duplicate_stamp_apology($1,$2) as claimed", [track, owner]);
assert.equal((await claim()).rows[0].claimed, true);
assert.equal((await claim()).rows[0].claimed, false);
await assert.rejects(db.query("insert into audit_events(action,entity_type,entity_id) values ('stamps.duplicate_apology_claimed','loyalty_track',$1)", [track]), /unique constraint/);
await assert.rejects(db.query("select public.server_claim_duplicate_stamp_apology($1,$2)", [track, "20000000-0000-0000-0000-000000000002"]), /owner_required/);
await assert.rejects(db.query("select public.server_claim_duplicate_stamp_apology($1,$2)", ["10000000-0000-0000-0000-000000000002", owner]), /incident_track_required/);
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}`);
  await assert.rejects(claim(), /permission denied/);
  await db.exec("reset role");
}
await db.exec("set role authenticated");
await assert.rejects(db.query("insert into audit_events(action,entity_type,entity_id) values ('stamps.duplicate_apology_sent','loyalty_track',$1)", [track]), /row-level security/);
await db.query("insert into audit_events(action,entity_type,entity_id) values ('unrelated.action','other',$1)", [track]);
await assert.rejects(db.query("update audit_events set action='stamps.duplicate_apology_sent' where action='unrelated.action'"), /row-level security/);
assert.equal((await db.query("delete from audit_events where action='stamps.duplicate_apology_claimed' returning id")).rows.length, 0);
assert.equal((await db.query("update audit_events set action='tampered' where action='stamps.duplicate_apology_claimed' returning id")).rows.length, 0);
await db.exec("reset role");
await db.exec("set role service_role");
assert.equal((await claim()).rows[0].claimed, false);
await db.exec("reset role");
// Um envio legado sem reserva tambem bloqueia o RPC.
await db.query("delete from audit_events");
await db.query("insert into audit_events(action,entity_type,entity_id) values ('stamps.duplicate_apology_sent','loyalty_track',$1)", [track]);
assert.equal((await claim()).rows[0].claimed, false);
await assert.rejects(db.query("insert into audit_events(action,entity_type,entity_id) values ('stamps.duplicate_apology_sent','loyalty_track',$1)", [track]), /unique constraint/);
const after = JSON.stringify((await db.query(`select (select jsonb_agg(l) from ledger_entries l) ledger, (select jsonb_agg(t) from loyalty_tracks t) tracks, (select jsonb_agg(r) from rewards r) rewards`)).rows);
assert.equal(after, original);
await db.close();
console.log("SQL validado localmente: reserva unica, roles, bloqueio de envio anterior, preservacao de ledger/cartoes/premios.");
