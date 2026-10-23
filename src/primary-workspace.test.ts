import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// @ts-expect-error Standalone Node publication guard.
import { verifyPrimaryWorkspace } from "../scripts/verify-primary-workspace.mjs";

// mkdtempSync/rmSync em disco lento (maquina ocupada) podem passar de 5000ms
// sem que haja nenhum bug real - so I/O. Timeout maior so aqui.
const FS_TIMEOUT = 15000;

describe("fonte única do site", () => {
  function fixture(run: (root: string) => void) {
    const root = mkdtempSync(join(tmpdir(), "primary-workspace-test-"));
    try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
  }
  it("bloqueia comandos iniciados por uma cópia externa", () => fixture(root => {
    const copy = join(root, "copy"); mkdirSync(copy);
    expect(() => verifyPrimaryWorkspace(copy, root)).toThrow("BLOQUEADO");
  }), FS_TIMEOUT);
  it("bloqueia um segundo aplicativo escondido dentro da principal", () => fixture(root => {
    mkdirSync(join(root, "release", "src"), { recursive: true });
    writeFileSync(join(root, "release", "package.json"), "{}");
    writeFileSync(join(root, "release", "src", "App.tsx"), "export default function App() {}");
    expect(() => verifyPrimaryWorkspace(root, root)).toThrow("cópias alternativas");
  }), FS_TIMEOUT);
  it("bloqueia uma cópia irmã completa da fonte oficial", () => fixture(container => {
    const primary = join(container, "principal");
    const copy = join(container, "copia");
    mkdirSync(join(primary, "src"), { recursive: true });
    mkdirSync(join(copy, "src"), { recursive: true });
    writeFileSync(join(primary, "package.json"), JSON.stringify({ name: "adoce-fidelidade" }));
    writeFileSync(join(primary, "src", "App.tsx"), "export default function App() {}");
    writeFileSync(join(copy, "package.json"), JSON.stringify({ name: "adoce-fidelidade" }));
    writeFileSync(join(copy, "src", "App.tsx"), "export default function App() {}");
    expect(() => verifyPrimaryWorkspace(primary, primary)).toThrow("cópias externas");
  }), FS_TIMEOUT);
  it("aceita uma única fonte com arquivos normais do produto", () => fixture(root => {
    mkdirSync(join(root, "public"));
    expect(() => verifyPrimaryWorkspace(root, root)).not.toThrow();
  }), FS_TIMEOUT);
  it("não aceita uma marca de desativação com comandos ainda ativos", () => fixture(root => {
    const copy = join(root, "release");
    mkdirSync(join(copy, "src"), { recursive: true });
    writeFileSync(join(copy, "src", "App.tsx"), "export default function App() {}");
    writeFileSync(join(copy, ".source-copy-disabled.json"), JSON.stringify({canonical: "D:/AdoceOnLine"}));
    writeFileSync(join(copy, "package.json"), JSON.stringify({scripts: {build: "vite build"}}));
    expect(() => verifyPrimaryWorkspace(root, root)).toThrow("cópias alternativas");
  }), FS_TIMEOUT);
  it("aceita provisoriamente uma cópia com todos os comandos bloqueados", () => fixture(root => {
    const copy = join(root, "release");
    mkdirSync(join(copy, "src"), { recursive: true });
    writeFileSync(join(copy, "src", "App.tsx"), "export default function App() {}");
    writeFileSync(join(copy, ".source-copy-disabled.json"), JSON.stringify({canonical: "D:/AdoceOnLine"}));
    writeFileSync(join(copy, "package.json"), JSON.stringify({scripts: {build: 'node "D:/AdoceOnLine/scripts/verify-primary-workspace.mjs"'}}));
    expect(() => verifyPrimaryWorkspace(root, root)).not.toThrow();
  }), FS_TIMEOUT);
});
