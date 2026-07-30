import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkpoints } from "../scripts/generate-homologation-visual-atlas.mjs";
import {
  generateImages,
  renderSvg,
  slugify,
} from "../scripts/export-homologation-visual-atlas-images.mjs";

const workflowPath = ".github/workflows/homologation-visual-atlas.yml";
const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "adoce-atlas-images-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("imagens separadas do atlas visual", () => {
  it("normaliza nomes de arquivo sem perder a identificação", () => {
    expect(slugify("Clube e cartão digital")).toBe("clube-e-cartao-digital");
    expect(slugify("Fidelidade +1, +2 e +3")).toBe("fidelidade-1-2-e-3");
  });

  it("gera uma representação conceitual rastreável e protegida", () => {
    const point = checkpoints()[0];
    const svg = renderSvg(point, 0, "data:image/webp;base64,AA==");

    expect(svg).toContain("Portal Adoce");
    expect(svg).toContain("Representação conceitual");
    expect(svg).toContain("produção não alterada");
    expect(svg).toContain(`Checkpoint ${point.id}`);
    expect(svg).toContain("data:image/webp;base64,AA==");
    expect(svg).not.toContain("adocebrigaderia.com.br");
    expect(svg).not.toContain("uefwywizqhfvvijaopcn");
  });

  it("exporta exatamente 98 SVGs, índice e manifesto", async () => {
    const outputDirectory = await temporaryDirectory();
    const manifest = await generateImages({
      outputDirectory,
      logoPath: resolve("public/site/logo.webp"),
    });
    const files = await readdir(join(outputDirectory, "imagens"));
    const savedManifest = JSON.parse(
      await readFile(join(outputDirectory, "manifest.json"), "utf8"),
    );
    const index = await readFile(join(outputDirectory, "index.html"), "utf8");

    expect(manifest.totalAreas).toBe(8);
    expect(manifest.totalImages).toBe(98);
    expect(manifest.productionChanged).toBe(false);
    expect(files.filter((file) => file.endsWith(".svg"))).toHaveLength(98);
    expect(new Set(files).size).toBe(98);
    expect(savedManifest.totalImages).toBe(98);
    expect(savedManifest.format).toBe("svg");
    expect(index.match(/class="card"/g)).toHaveLength(98);
    expect(index).toContain("Produção não alterada");
  });

  it("empacota o commit exato com ZIP e checksums verificáveis", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).not.toContain(
      "ref: reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(workflow).toContain(
      'test "${GITHUB_REF_NAME}" = "${AUTHORIZED_BRANCH}"',
    );
    expect(workflow).toContain(
      'test "$(git rev-parse HEAD)" = "${GITHUB_SHA}"',
    );
    expect(workflow).toContain(
      "export-homologation-visual-atlas-images.mjs --check",
    );
    expect(workflow).toContain("Imagens separadas: 98 SVGs");
    expect(workflow).toContain("Confirmar isolamento dos artefatos");
    expect(workflow).toMatch(/grep -R[\s\S]+artifacts\/atlas-visual/);
    expect(workflow).not.toMatch(
      /grep -R[\s\S]+scripts\/export-homologation-visual-atlas-images\.mjs/,
    );
    expect(workflow).toContain("Gerar pacote ZIP verificável");
    expect(workflow).toContain("SHA256SUMS.txt");
    expect(workflow).toContain("sha256sum \"${package_file}\"");
    expect(workflow).toContain("unzip -tq \"${package_file}\"");
    expect(workflow).toContain(
      "grep -Ec '^artifacts/atlas-visual/imagens-separadas/imagens/[^/]+\\.svg$'",
    );
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("id: upload");
    expect(workflow).toContain(
      "atlas-visual-adoce-98-${{ github.sha }}",
    );
    expect(workflow).toContain("artifacts/entrega");
    expect(workflow).toContain("retention-days: 30");
    expect(workflow).not.toContain("npm ci");
    expect(workflow).not.toContain("NETLIFY_AUTH_TOKEN");
    expect(workflow).not.toContain("--prod");
    expect(workflow).not.toContain("supabase");
  });

  it("publica o link direto do artefato no issue e registra falhas", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("issues: write");
    expect(workflow).toContain("steps.upload.outputs.artifact-url");
    expect(workflow).toContain("steps.upload.outputs.artifact-digest");
    expect(workflow).toContain("Registrar download no issue de acompanhamento");
    expect(workflow).toContain("Baixar o ZIP com as 98 imagens");
    expect(workflow).toContain("issue_number: 3");
    expect(workflow).toContain("if: ${{ success() }}");
    expect(workflow).toContain("Registrar falha do empacotamento");
    expect(workflow).toContain("if: ${{ failure() }}");
    expect(workflow).toContain("Produção: **não alterada**");
  });
});
