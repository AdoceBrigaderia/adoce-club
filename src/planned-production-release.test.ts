import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260723094500_release_planned_production_into_inventory.sql",
    import.meta.url,
  ),
  "utf8",
);
const admin = readFileSync(
  new URL("./WeeklyMenuAdmin.tsx", import.meta.url),
  "utf8",
);
const dashboard = readFileSync(
  new URL("./OperationDashboard.tsx", import.meta.url),
  "utf8",
);

describe("liberação segura da produção planejada", () => {
  it("não transforma planejamento em estoque sem confirmação do gestor", () => {
    expect(migration).toContain("public.staff_release_weekly_production");
    expect(migration).toContain("not private.is_manager()");
    expect(migration).toContain("release_date <> fortaleza_today");
    expect(migration).toContain("channel_slug = 'online_orders'");
  });

  it("soma somente o saldo ainda não liberado e impede duplicidade", () => {
    expect(migration).toContain(
      "menu.quantity_planned > menu.quantity_released",
    );
    expect(migration).toContain(
      "release_quantity := menu_item.quantity_planned - menu_item.quantity_released",
    );
    expect(migration).toContain(
      "+ excluded.quantity_available",
    );
    expect(migration).toContain(
      "quantity_released = quantity_released + release_quantity",
    );
    expect(migration).toContain("'already_released', true");
  });

  it("preserva sobras, reservas e uma trilha de auditoria", () => {
    expect(migration).toContain(
      "perform private.carry_forward_flavor_inventory(release_date)",
    );
    expect(migration).toContain(
      "- public.flavor_availability.quantity_reserved",
    );
    expect(migration).toContain("inventory.production_released");
    expect(migration).toContain(
      "confirmed_production_plus_existing_physical_balance",
    );
  });

  it("expõe confirmação clara na operação e alerta no painel inicial", () => {
    expect(admin).toContain(
      "Confirmar produção e liberar estoque",
    );
    expect(admin).toContain(
      "Elas serão somadas às sobras que já existem no estoque",
    );
    expect(dashboard).toContain("productionPending");
    expect(dashboard).toContain("fatias aguardam liberação");
  });
});
