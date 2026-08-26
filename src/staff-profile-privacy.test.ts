import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260812133000_owner_private_staff_profiles.sql", "utf8");
const app = readFileSync("src/AccessApp.tsx", "utf8");
const profile = readFileSync("src/StaffProfileAdmin.tsx", "utf8");

describe("ficha privada da equipe", () => {
  it("mantém dados e originais privados, com RLS de proprietário", () => {
    expect(migration).toContain("alter table public.staff_private_profiles enable row level security");
    expect(migration).toContain("alter table public.staff_private_emails enable row level security");
    expect(migration).toContain("staff_private_profiles_owner_insert");
    expect(migration).toContain("(select private.is_owner())");
    expect(migration).toContain("'staff-profile-media'");
    expect(migration).toContain("owner_set_staff_access");
    expect(migration).toContain("can_view_finance = false");
    expect(migration).toMatch(/'staff-profile-media',[\s\S]*?false,/);
    expect(migration).not.toMatch(/grant .*staff_private_(profiles|emails).*\b(anon|public)\b/i);
  });

  it("só abre a ficha completa para o papel owner", () => {
    expect(app).toContain('view === "team" && role === "owner"');
    expect(app).toContain('view === "team" && role !== "owner"');
  });

  it("usa o editor existente em recorte quadrado e salva por seção", () => {
    expect(profile).toContain('aspectWidth: 1');
    expect(profile).toContain('aspectHeight: 1');
    expect(profile).toContain('Salvar identificação');
    expect(profile).toContain('Salvar contato');
    expect(profile).toContain('Salvar endereço');
    expect(profile).toContain('Salvar anotações');
  });
});
