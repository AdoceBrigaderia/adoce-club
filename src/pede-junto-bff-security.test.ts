import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  new URL("./GroupOrderPage.tsx", import.meta.url),
  "utf8",
);
const helper = readFileSync(new URL("./pede-junto.ts", import.meta.url), "utf8");
const client = readFileSync(
  new URL("./services/pede-junto-bff.ts", import.meta.url),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../netlify/functions/pede-junto-bff.ts", import.meta.url),
  "utf8",
);
const hardeningMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260728170307_harden_pede_junto_public_writes.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Pede Junto pelo BFF", () => {
  it("remove tokens e Supabase direto da superfície pública", () => {
    for (const source of [page, helper, client]) {
      expect(source).not.toContain("requireSupabase");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("participant_token");
      expect(source).not.toContain("organizer_token");
      expect(source).not.toContain("Authorization");
    }
    expect(page).toContain('from "./services/pede-junto-bff"');
  });

  it("mantém capacidades reais em cookie HttpOnly e envia apenas booleanos", () => {
    expect(endpoint).toContain('GROUP_ACCESS_COOKIE = "__Host-adoce-group-access"');
    expect(endpoint).toContain("HttpOnly");
    expect(endpoint).toContain("SameSite=Strict");
    expect(endpoint).toContain("participant: Boolean(current?.participantToken)");
    expect(endpoint).toContain("organizer: Boolean(current?.organizerToken)");
    expect(endpoint).not.toContain("participant_token: result.participant_token");
    expect(endpoint).not.toContain("organizer_token: result.organizer_token");
  });

  it("exige origem e CSRF para alterar escolhas ou enviar o grupo", () => {
    expect(endpoint).toContain("strictAllowedOrigin(request)");
    expect(endpoint).toContain("validGroupCsrf(request)");
    expect(client).toContain('headers["X-Adoce-Group-CSRF"] = csrf');
    expect(client).toContain('credentials: "same-origin"');
    expect(client).toMatch(
      /request<\{ room: PedeJuntoRoom; access: PedeJuntoAccess \}>\(\s+"select"/,
    );
    expect(client).toContain('>("submit", { group_code: code }, true)');
  });

  it("preserva criação, entrada, atualização, convite e encerramento", () => {
    expect(page).toContain("createPedeJuntoGroup");
    expect(page).toContain("joinPedeJuntoGroup");
    expect(page).toContain("loadPedeJuntoRoom");
    expect(page).toContain("setPedeJuntoSelection");
    expect(page).toContain("submitPedeJuntoGroup");
    expect(page).toContain("Convidar no WhatsApp");
    expect(page).toContain("Cada um paga o seu");
  });

  it("limita e torna idempotentes as escritas públicas de criação e entrada", () => {
    expect(endpoint).toContain("consumePublicRateLimits");
    expect(endpoint).toContain("pede-junto-create:ip");
    expect(endpoint).toContain("pede-junto-join:phone");
    expect(endpoint).toContain('"create_pede_junto_group_v2"');
    expect(endpoint).toContain('"join_pede_junto_group_v3"');
    expect(client).toContain("pendingOperationKeys");
    expect(client).toContain("crypto.randomUUID()");
    expect(client).toContain("requested_operation_key: key.value");
    expect(hardeningMigration).toContain("pg_advisory_xact_lock");
    expect(hardeningMigration).toContain(
      "private.pede_junto_write_requests",
    );
    expect(hardeningMigration).toContain("jsonb_build_object('idempotent', true)");
    expect(hardeningMigration).toMatch(
      /revoke all on function public\.create_pede_junto_group\([\s\S]*service_role;/,
    );
  });
});
