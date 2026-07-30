import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  contentTypeFor,
  createPreviewServer,
  resolveRequestPath,
} from "./serve-homologation-preview.mjs";

async function createFixture() {
  const rootDirectory = await mkdtemp(join(tmpdir(), "adoce-preview-"));
  await mkdir(join(rootDirectory, "assets"));
  await writeFile(join(rootDirectory, "index.html"), '<div id="root">Adoce</div>');
  await writeFile(join(rootDirectory, "assets", "app.js"), "console.log('adoce');");
  return rootDirectory;
}

test("resolve arquivos reais e aplica fallback SPA", async () => {
  const rootDirectory = await createFixture();
  assert.match(resolveRequestPath(rootDirectory, "/").filePath, /index\.html$/);
  assert.match(resolveRequestPath(rootDirectory, "/operacao/venda-rapida").filePath, /index\.html$/);
  assert.match(resolveRequestPath(rootDirectory, "/assets/app.js").filePath, /app\.js$/);
  assert.equal(resolveRequestPath(rootDirectory, "/assets/ausente.js").status, 404);
  assert.equal(resolveRequestPath(rootDirectory, "/%E0%A4%A").status, 400);
});

test("serve o build local com headers mínimos", async (context) => {
  const rootDirectory = await createFixture();
  const server = createPreviewServer({ rootDirectory });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => server.close());

  const address = server.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const indexResponse = await fetch(`${baseUrl}/clube/cartao-digital`);
  assert.equal(indexResponse.status, 200);
  assert.equal(indexResponse.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(indexResponse.headers.get("x-content-type-options"), "nosniff");
  assert.match(await indexResponse.text(), /id="root"/);

  const assetResponse = await fetch(`${baseUrl}/assets/app.js`);
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get("content-type"), "text/javascript; charset=utf-8");

  const missingAsset = await fetch(`${baseUrl}/assets/missing.css`);
  assert.equal(missingAsset.status, 404);

  const postResponse = await fetch(baseUrl, { method: "POST" });
  assert.equal(postResponse.status, 405);
});

test("mapeia tipos de conteúdo usados pelo build", () => {
  assert.equal(contentTypeFor("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("app.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeFor("logo.webp"), "image/webp");
  assert.equal(contentTypeFor("arquivo.bin"), "application/octet-stream");
});
