import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const netlify = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");

describe("recuperação segura depois de uma nova publicação", () => {
  it("recarrega uma única vez quando um arquivo antigo deixa de existir", () => {
    expect(main).toContain('window.addEventListener("vite:preloadError"');
    expect(main).toContain("adoce-preload-recovery");
    expect(main).toContain("window.location.reload()");
  });

  it("não guarda navegação nem arquivos versionados no service worker", () => {
    expect(worker).not.toContain('  "/",');
    expect(worker).toContain('event.request.mode === "navigate"');
    expect(worker).toContain('pathname.startsWith("/assets/")');
  });

  it("obriga o navegador a conferir uma versão nova do HTML", () => {
    expect(netlify).toContain('for = "/index.html"');
    expect(netlify).toContain('for = "/404.html"');
    expect(netlify).toContain('Cache-Control = "no-cache, no-store, must-revalidate"');
  });
});
