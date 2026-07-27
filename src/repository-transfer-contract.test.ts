import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const decisions = readFileSync(
  new URL("../docs/DECISOES-TECNICAS.md", import.meta.url),
  "utf8",
);
const consolidationScript = readFileSync(
  new URL("../continuar_consolidacao_fonte_oficial.ps1", import.meta.url),
  "utf8",
);

const CURRENT_REPOSITORY = "AdoceBrigaderia/adoce-club";
const PREVIOUS_REPOSITORY = "RMBPS/adoce-club";
const DEVELOPMENT_BRANCH = "reestruturacao/ux-crm-operacao-imagens-v1";

describe("contrato operacional após a transferência do repositório", () => {
  it("declara a organização atual como origem oficial", () => {
    expect(decisions).toContain(`Repositório oficial: \`${CURRENT_REPOSITORY}\``);
    expect(decisions).toContain(`Branch de desenvolvimento: \`${DEVELOPMENT_BRANCH}\``);
  });

  it("mantém o endereço anterior somente como referência histórica", () => {
    const previousReferences = decisions.match(/RMBPS\/adoce-club/g) ?? [];

    expect(previousReferences).toHaveLength(1);
    expect(decisions).toContain("permanece apenas como redirecionamento histórico");
    expect(decisions).toContain("não deve ser usado em novas automações");
  });

  it("aponta o script operacional para a organização atual", () => {
    expect(consolidationScript).toContain(
      '$TargetRepository = "https://github.com/AdoceBrigaderia/adoce-club.git"',
    );
    expect(consolidationScript).toContain(
      'Write-Host "Repositorio: AdoceBrigaderia/adoce-club"',
    );
    expect(consolidationScript).not.toContain(
      "https://github.com/RMBPS/adoce-club.git",
    );
  });

  it("preserva o bloqueio explícito de produção", () => {
    expect(decisions).toContain("Produção não será alterada durante o desenvolvimento");
    expect(decisions).toContain("Merge e publicação em produção exigem aprovação expressa");
    expect(decisions).toContain("backup, rollback e smoke tests");
    expect(consolidationScript).toContain(
      "Nenhuma alteracao foi publicada no site de producao.",
    );
  });
});
