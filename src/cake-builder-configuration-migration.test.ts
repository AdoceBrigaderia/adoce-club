import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728073000_cake_builder_configuration.sql",
    import.meta.url,
  ),
  "utf8",
);

const publicCatalog = migration.slice(
  migration.indexOf("create or replace function public.public_get_cake_builder_catalog"),
  migration.indexOf("create or replace function public.staff_get_cake_builder_configuration"),
);

const canonicalizer = migration.slice(
  migration.indexOf("create or replace function private.canonicalize_cake_builder_selection"),
  migration.indexOf("create or replace function public.public_get_cake_builder_catalog"),
);

describe("configuração segura do montador de tortas", () => {
  it("protege configuração, opções e custos por RLS e menor privilégio", () => {
    expect(migration).toContain("alter table public.cake_builder_templates enable row level security");
    expect(migration).toContain("alter table public.cake_builder_options enable row level security");
    expect(migration).toContain("alter table public.service_request_cake_builds enable row level security");
    expect(migration).toContain(
      "revoke all on public.cake_builder_options from public, anon, authenticated",
    );
    expect(migration).toContain("grant all on public.cake_builder_options to service_role");
  });

  it("não expõe custo interno no catálogo público", () => {
    expect(publicCatalog).toContain("price_adjustment");
    expect(publicCatalog).not.toContain("unit_cost");
    expect(publicCatalog).toContain("option.active");
    expect(publicCatalog).toContain("option.published");
  });

  it("preserva a ordem e a repetição das camadas antes da validação", () => {
    expect(canonicalizer).toContain("cake_builder_jsonb_uuid_array(");
    expect(canonicalizer).toContain("requested_builder->'cake_layers'");
    expect(canonicalizer).toContain("requested_builder->'filling_layers'");
    expect(canonicalizer).toContain("cardinality(cake_ids) <> template_row.cake_layers");
    expect(canonicalizer).toContain("cardinality(filling_ids) <> template_row.filling_layers");
    expect(canonicalizer).toContain("unnest(cake_ids) with ordinality");
    expect(canonicalizer).toContain("unnest(filling_ids) with ordinality");
  });

  it("recalcula preço e custo somente com opções ativas do banco", () => {
    expect(canonicalizer).toContain("product.base_price");
    expect(canonicalizer).toContain("sum(option.price_adjustment)");
    expect(canonicalizer).toContain("sum(option.unit_cost)");
    expect(canonicalizer).toContain("option.template_id = template_row.id");
    expect(canonicalizer).toContain("option.active and option.published");
    expect(canonicalizer).toContain("estimated_internal_cost");
  });

  it("mantém administração somente para owner/manager e BFF somente no service role", () => {
    expect(migration).toContain("if not private.is_manager() then");
    expect(migration).toContain(
      "revoke all on function public.manager_save_cake_builder_configuration(",
    );
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).toContain(
      "revoke all on function public.submit_service_request_bff(",
    );
    expect(migration).toContain("to service_role");
  });

  it("mantém idempotência transacional e histórico canônico da encomenda", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("public_request_key = requested_operation_key");
    expect(migration).toContain("insert into public.service_request_cake_builds");
    expect(migration).toContain("canonical_selection");
    expect(migration).toContain("selection_summary");
  });
});
