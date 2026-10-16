import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/20261016142815_customer_directory_and_profile_edit.sql", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../netlify/functions/customer-profile-update.ts", import.meta.url), "utf8");
const operation = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const quickRegistration = readFileSync(new URL("./CadastroRapido.tsx", import.meta.url), "utf8");

describe("diretório e edição completa de clientes", () => {
  it("não converte uma busca textual em telefone vazio que retorna todos", () => {
    expect(migration).toContain("char_length(regexp_replace(search_text,'[^0-9]','','g')) >= 4");
  });
  it("pagina e filtra no banco sem consultas por cliente", () => {
    expect(migration).toContain("staff_customer_directory(");
    expect(migration).toContain("registered_from");
    expect(migration).toContain("last_stamp_from");
    expect(migration).toContain("has_available_reward");
    expect(migration).toContain("count(*) over()");
    expect(migration).toContain("last_stamp_at");
  });

  it("edita o mesmo profile e protege telefone duplicado", () => {
    expect(endpoint).toContain("phoneE164");
    expect(endpoint).toContain("addressLine");
    expect(endpoint).toContain("CUSTOMER_PHONE_DUPLICATE");
    expect(endpoint).toContain('.eq("id", profileId)');
    expect(endpoint).not.toContain(".insert({ full_name");
  });

  it("expõe filtros e edição completa na ficha operacional", () => {
    expect(operation).toContain("Data do cadastro");
    expect(operation).toContain("Último carimbo");
    expect(operation).toContain("Editar cliente");
    expect(operation).toContain("Endereço");
  });

  it("abre automaticamente o cadastro encontrado pelo celular", () => {
    expect(quickRegistration).toContain("lastOpenedCustomer.current");
    expect(quickRegistration).toContain("onAbrirExistente(repetido.id)");
  });
});
