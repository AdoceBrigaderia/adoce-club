import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728165116_harden_pede_junto_participant_rejoin.sql",
    import.meta.url,
  ),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../netlify/functions/pede-junto-bff.ts", import.meta.url),
  "utf8",
);

describe("identidade do participante no Pede Junto", () => {
  it("não permite trocar o token de um telefone já cadastrado usando só o convite", () => {
    expect(migration).toContain("existing_participant.participant_token_hash");
    expect(migration).toContain(
      "<> private.pede_junto_hash(current_participant_token)",
    );
    expect(migration).not.toContain(
      "participant_token_hash = excluded.participant_token_hash",
    );
  });

  it("mantém o token válido no aparelho autorizado e bloqueia a RPC vulnerável", () => {
    expect(migration).toContain(
      "issued_participant_token := current_participant_token",
    );
    expect(migration).toMatch(
      /revoke all on function public\.join_pede_junto_group\(text,text,text,text\)[\s\S]*service_role;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.join_pede_junto_group_v2\(text,text,text,text,text\)[\s\S]*to service_role;/,
    );
  });

  it("o BFF envia somente o token guardado em cookie HttpOnly para reentrada", () => {
    expect(endpoint).toContain('"join_pede_junto_group_v3"');
    expect(endpoint).toContain(
      "storedAccess?.code === code ? storedAccess.participantToken : null",
    );
    expect(endpoint).not.toContain('"join_pede_junto_group",');
  });
});
