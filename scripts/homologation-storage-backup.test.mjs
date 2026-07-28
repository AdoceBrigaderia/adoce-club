import assert from "node:assert/strict";
import test from "node:test";
import { safeBucketName, safeStoragePath, sha256 } from "./homologation-storage-backup.mjs";

test("normaliza caminhos seguros sem permitir travessia", () => {
  assert.equal(safeStoragePath("/produtos/fatia.webp"), "produtos/fatia.webp");
  assert.equal(safeStoragePath("galeria\\foto.jpg"), "galeria/foto.jpg");
  assert.throws(() => safeStoragePath("../segredo"), /inválido/);
  assert.throws(() => safeStoragePath("pasta/../segredo"), /inválido/);
  assert.throws(() => safeStoragePath(""), /inválido/);
});

test("aceita somente nomes seguros de bucket", () => {
  assert.equal(safeBucketName("site-assets"), "site-assets");
  assert.equal(safeBucketName("produtos_2026"), "produtos_2026");
  assert.throws(() => safeBucketName("bucket/com/barra"), /inválido/);
  assert.throws(() => safeBucketName(""), /inválido/);
});

test("calcula SHA-256 determinístico", () => {
  const digest = sha256(Buffer.from("Adoce"));
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, sha256(Buffer.from("Adoce")));
  assert.notEqual(digest, sha256(Buffer.from("Adoce!")));
});
