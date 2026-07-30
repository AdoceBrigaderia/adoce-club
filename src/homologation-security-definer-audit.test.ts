import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const audit = readFileSync(
  new URL("../supabase/tests/homologation_security_definer_live.sql", import.meta.url),
  "utf8",
);

describe("auditoria viva de SECURITY DEFINER da homologação", () => {
  it("é somente leitura e sempre termina em rollback", () => {
    expect(audit.trimStart()).toMatch(/^\\set ON_ERROR_STOP on/);
    expect(audit).toContain("begin;");
    expect(audit.trimEnd()).toMatch(/rollback;$/);
    expect(audit).toContain("pg_advisory_xact_lock");
    expect(audit).not.toMatch(/\b(insert|update|delete|truncate|drop|alter)\b/i);
  });

  it("protege catálogos públicos contra exposição de custos internos", () => {
    expect(audit).toContain("public.get_configurable_product_catalog(text)");
    expect(audit).toContain("public.public_get_cake_builder_catalog(uuid)");
    expect(audit).toContain("has_function_privilege('anon', target, 'EXECUTE')");
    expect(audit).toContain("unit_cost''\\s*,\\s*option\\.unit_cost");
    expect(audit).toContain("to_jsonb(product)");
    expect(audit).toContain("and product.active");
    expect(audit).toContain("and product.published");
  });

  it("exige guarda gerencial e bloqueia execução anônima", () => {
    expect(audit).toContain("public.manager_get_configurable_product_workspace()");
    expect(audit).toContain("public.manager_save_configurable_product(jsonb,jsonb)");
    expect(audit).toContain("private.is_manager()");
    expect(audit).toContain("Função gerencial executável por anon");
    expect(audit).toContain("search_path=\"\"");
  });

  it("exige autenticação e autorização por loja no workspace de encomendas", () => {
    expect(audit).toContain("public.staff_get_service_request_workspace(text,text,integer)");
    expect(audit).toContain("auth.uid()");
    expect(audit).toContain("staff_store_assignments");
    expect(audit).toContain("Workspace de encomendas executável por anon");
  });
});
