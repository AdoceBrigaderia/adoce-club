import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = "scripts/generate-homologation-visual-atlas.mjs";
const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("atlas visual de homologação", () => {
  it("valida exatamente 8 áreas e 98 pontos sem dependências externas", () => {
    const output = execFileSync(process.execPath, [script, "--check"], {
      encoding: "utf8",
    });

    expect(output).toContain("ok: 8 áreas e 98 pontos validados");
  });

  it("gera HTML responsivo, rastreável e sem coordenadas produtivas", () => {
    const directory = mkdtempSync(join(tmpdir(), "adoce-visual-atlas-"));
    temporaryDirectories.push(directory);
    const outputFile = join(directory, "validacao-visual-98.html");

    execFileSync(process.execPath, [script, "--out", outputFile]);
    const html = readFileSync(outputFile, "utf8");

    expect(html.match(/data-checkpoint=/g)).toHaveLength(98);
    expect(html).toContain("Validação visual — 98 pontos");
    expect(html).toContain('src="/site/logo.webp"');
    expect(html).toContain("sessionStorage");
    expect(html).toContain("Copiar relatório");
    expect(html).toContain("Produção: não alterada");
    expect(html).not.toContain("adocebrigaderia.com.br");
    expect(html).not.toContain("uefwywizqhfvvijaopcn");
    expect(html).not.toContain("bb0c96cd-5af2-4270-a9a8-b63b9637b1f4");
  });
});
