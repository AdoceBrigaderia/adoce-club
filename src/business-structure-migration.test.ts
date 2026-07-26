import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260726124000_business_structure_and_cash.sql", import.meta.url),
  "utf8",
);

describe("migration de lojas, equipe e caixa", () => {
  it("cria as entidades operacionais principais", () => {
    for (const table of [
      "stores",
      "cash_registers",
      "staff_store_assignments",
      "cash_sessions",
      "cash_movements",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
    }
  });

  it("impede mais de uma abertura por caixa", () => {
    expect(migration).toContain("cash_sessions_one_open_per_register");
    expect(migration).toContain("where status = 'open'");
  });

  it("vincula pedidos à loja, caixa e abertura", () => {
    expect(migration).toContain("add column if not exists store_id");
    expect(migration).toContain("add column if not exists cash_register_id");
    expect(migration).toContain("add column if not exists cash_session_id");
  });

  it("protege as tabelas com RLS", () => {
    for (const table of [
      "stores",
      "cash_registers",
      "staff_store_assignments",
      "cash_sessions",
      "cash_movements",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("entrega fluxos completos de abertura, movimentação e fechamento", () => {
    expect(migration).toContain("function public.staff_open_cash_session");
    expect(migration).toContain("function public.staff_record_cash_movement");
    expect(migration).toContain("function public.staff_close_cash_session");
    expect(migration).toContain("function public.manager_cancel_empty_cash_session");
  });

  it("restringe administração e permissões", () => {
    expect(migration).toContain("function public.manager_upsert_store");
    expect(migration).toContain("function public.manager_upsert_cash_register");
    expect(migration).toContain("function public.manager_set_staff_store_assignment");
    expect(migration).toContain("function public.manager_update_staff_member");
    expect(migration).toContain("Somente o proprietario pode alterar proprietarios e gerentes");
  });

  it("não contém identificadores de projetos Supabase", () => {
    expect(migration).not.toContain("vazozolhbehnriytzcdc");
    expect(migration).not.toContain("uefwywizqhfvvijaopcn");
  });
});
