import test from "node:test";
import assert from "node:assert/strict";
import {
  auditExitCode,
  buildAuditReport,
  extractCatalogKeys,
  extractImageReferences,
  normalizeLocalImageReference,
} from "./image-library-audit-core.mjs";

test("normaliza caminhos públicos e remove query string", () => {
  assert.equal(normalizeLocalImageReference("/site/logo.webp?v=2", "src/App.tsx"), "/site/logo.webp");
  assert.equal(normalizeLocalImageReference("public/site/logo.webp", "scripts/task.mjs"), "/site/logo.webp");
  assert.equal(normalizeLocalImageReference("./icons/icon-192.png", "public/manifest.webmanifest"), "/icons/icon-192.png");
});

test("ignora URLs externas e caminhos relativos fora de public", () => {
  assert.equal(normalizeLocalImageReference("https://cdn.example.com/cake.webp", "src/App.tsx"), null);
  assert.equal(normalizeLocalImageReference("./asset.webp", "src/App.tsx"), null);
});

test("resolve imagem servida pelo proxy da Netlify", () => {
  assert.equal(
    normalizeLocalImageReference("/.netlify/images?url=%2Fsite%2Fhero.webp&w=1200", "src/App.tsx"),
    "/site/hero.webp",
  );
});

test("extrai referências de TypeScript, CSS e srcset", () => {
  const content = `
    const logo = "/site/logo.webp";
    .hero { background-image: url('/site/hero.jpg?v=1'); }
    <source srcset="/site/card-640.webp 640w, /site/card-1280.webp 1280w" />
  `;
  assert.deepEqual(extractImageReferences(content, "src/App.tsx"), [
    "/site/card-1280.webp",
    "/site/card-640.webp",
    "/site/hero.jpg",
    "/site/logo.webp",
  ]);
});

test("extrai somente chaves de imagens locais do catálogo", () => {
  const keys = extractCatalogKeys(`[
    { key: "/site/logo.webp" },
    { key: "https://cdn.example.com/external.webp" },
    { key: "/site/hero.webp" },
  ]`);
  assert.deepEqual([...keys].sort(), ["/site/hero.webp", "/site/logo.webp"]);
});

test("classifica cobertura, arquivos quebrados e órfãos", () => {
  const usages = new Map([
    ["/site/logo.webp", new Set(["src/App.tsx"])],
    ["/site/uncataloged.webp", new Set(["src/Home.tsx"])],
    ["/site/missing.webp", new Set(["src/Home.tsx"])],
  ]);
  const report = buildAuditReport({
    usages,
    catalogKeys: new Set(["/site/logo.webp", "/site/catalog-missing.webp"]),
    publicFiles: new Set(["/site/logo.webp", "/site/uncataloged.webp", "/site/orphan.webp"]),
  });

  assert.deepEqual(report.registered, ["/site/logo.webp"]);
  assert.deepEqual(report.unregistered, ["/site/uncataloged.webp"]);
  assert.deepEqual(report.missing, ["/site/missing.webp"]);
  assert.deepEqual(report.catalogMissing, ["/site/catalog-missing.webp"]);
  assert.deepEqual(report.orphaned, ["/site/orphan.webp"]);
  assert.equal(auditExitCode(report), 1);
});

test("modo estrito falha quando uma imagem usada não está cadastrada", () => {
  const report = {
    missing: [],
    catalogMissing: [],
    unregistered: ["/site/uncataloged.webp"],
  };
  assert.equal(auditExitCode(report, false), 0);
  assert.equal(auditExitCode(report, true), 2);
});
