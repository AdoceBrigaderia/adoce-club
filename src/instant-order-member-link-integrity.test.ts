import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260812185124_prevent_instant_order_wrong_member_stamps.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("integridade do vinculo entre pedido e membro", () => {
  it("invalida profile_id quando o telefone do cadastro diverge do pedido", () => {
    expect(migration).toContain("new.profile_id is not null and not exists");
    expect(migration).toContain("new.profile_id := null");
    expect(migration).toContain("instant_order.invalid_profile_link_removed");
  });

  it("so reconhece um unico perfil ativo com o mesmo telefone", () => {
    expect(migration).toContain("profile.active");
    expect(migration).toContain("matching_profile_count = 1");
    expect(migration).toContain("matching_profile_count <> 1");
  });

  it("preserva pedidos concluidos ao reparar dados existentes", () => {
    expect(migration).toContain(
      "target.status not in ('completed', 'cancelled', 'expired')",
    );
  });
});
