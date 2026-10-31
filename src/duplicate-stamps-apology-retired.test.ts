import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("pacote final não contém emissor, painel nem gatilho da comunicação pontual", () => {
  for (const path of [
    "netlify/functions/duplicate-stamps-apology.ts",
    "netlify/functions/_shared/duplicate-stamps-apology.ts",
    "netlify/functions/_shared/duplicate-stamps-apology-data.ts",
    "src/DuplicateStampsApologyControl.tsx", "src/services/duplicate-stamps-apology.ts",
  ]) expect(existsSync(new URL(`../${path}`, import.meta.url))).toBe(false);
  expect(readFileSync(new URL("../netlify.toml", import.meta.url), "utf8")).not.toContain('[functions."duplicate-stamps-apology"]');
  expect(readFileSync(new URL("./OperationAuditDecisions.tsx", import.meta.url), "utf8")).not.toContain("duplicateStampApology");
});

it("migração de retirada remove só RPC de reserva e preserva tabelas e auditoria", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261031210000_retire_duplicate_stamp_apology_sender.sql", import.meta.url), "utf8");
  expect(sql).toContain("drop function if exists public.server_claim_duplicate_stamp_apology(uuid,uuid)");
  expect(sql).toContain("stamps.duplicate_apology_retired");
  expect(sql).not.toMatch(/\b(?:delete\s+from|truncate|drop\s+table|update\s+public\.)/i);
});
