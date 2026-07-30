import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = "scripts/generate-homologation-visual-atlas.mjs";
const workflow = readFileSync(
  ".github/workflows/homologation-visual-atlas.yml",
  "utf8",
);
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

  it("empacota o atlas sem npm, deploy ou credenciais externas", () => {
    expect(workflow).toContain("timeout-minutes: 10");
    expect(workflow).toContain("node scripts/generate-homologation-visual-atlas.mjs --check");
    expect(workflow).toContain("validacao-visual-98.html");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("retention-days: 30");
    expect(workflow).not.toContain("npm ci");
    expect(workflow).not.toContain("NETLIFY_AUTH_TOKEN");
    expect(workflow).not.toContain("--prod");
    expect(workflow).not.toContain("supabase");
  });
});
