import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyUtf8Files } from "./verify-utf8.mjs";

test("reprova bytes que não são UTF-8", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "adoce-utf8-"));
  const file = path.join(directory, "texto.ts");
  await writeFile(file, Buffer.from([0xc3, 0x28]));
  try {
    assert.match(verifyUtf8Files([file]).join("\n"), /bytes inválidos para UTF-8/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reprova texto recodificado como Latin-1", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "adoce-utf8-"));
  const file = path.join(directory, "texto.tsx");
  await writeFile(file, `const texto = 'produ${"\u00c3\u00a7"}ão';\n`, "utf8");
  try {
    assert.match(verifyUtf8Files([file]).join("\n"), /reconversão UTF-8\/Latin-1/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
