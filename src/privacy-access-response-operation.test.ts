import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(
  new URL("./OperationPrivacyRequests.tsx", import.meta.url),
  "utf8",
);
const packageMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260727105843_privacy_access_response_package.sql",
    import.meta.url,
  ),
  "utf8",
);
const listMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260727105905_privacy_response_status_list.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("operação da resposta de consulta de dados", () => {
  it("só permite preparar o pacote depois da identidade e do vínculo confirmados", () => {
    expect(operation).toContain('item.privacy_request_type === "access"');
    expect(operation).toContain('identityStatus === "verified"');
    expect(operation).toContain("Boolean(item.profile_id)");
    expect(operation).toContain("Vincule esta solicitação ao cadastro correto");
    expect(packageMigration).toContain("request_row.profile_id is null");
  });

  it("usa os RPCs BFF para preparar e registrar a entrega", () => {
    expect(operation).toContain('"staff_prepare_privacy_access_response"');
    expect(operation).toContain('"staff_mark_privacy_response_delivered"');
    expect(operation).toContain("target_feedback_id: item.id");
    expect(operation).toContain("requested_channel: channel");
    expect(operation).not.toContain("supabase.rpc");
  });

  it("gera arquivo local, permite cópia e exige revisão do destinatário", () => {
    expect(operation).toContain("navigator.clipboard.writeText");
    expect(operation).toContain("new Blob");
    expect(operation).toContain("URL.createObjectURL");
    expect(operation).toContain("Confirme o destinatário antes do envio");
    expect(operation).toContain("adoce-privacidade-${item.protocol}.json");
  });

  it("exibe somente contagens resumidas na interface", () => {
    expect(operation).toContain("accessPackage.loyalty.movement_count");
    expect(operation).toContain("accessPackage.orders.total_count");
    expect(operation).toContain("accessPackage.checkins.total_count");
    expect(operation).not.toContain("JSON.stringify(accessPackage.profile");
  });

  it("carrega o estado persistido de preparação e entrega", () => {
    expect(listMigration).toContain("privacy_response_prepared_at");
    expect(listMigration).toContain("privacy_response_package_version");
    expect(listMigration).toContain("privacy_response_delivered_at");
    expect(listMigration).toContain("privacy_response_delivery_channel");
    expect(operation).toContain("Pacote preparado");
    expect(operation).toContain("Resposta entregue");
  });
});
