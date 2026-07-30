import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_REF = "vazozolhbehnriytzcdc";
const EXPECTED_URL = `https://${EXPECTED_REF}.supabase.co`;
const PAGE_SIZE = 100;

export function safeStoragePath(value) {
  const normalized = String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
    throw new Error(`Caminho de Storage inválido: ${value}`);
  }
  return parts.join("/");
}

export function safeBucketName(value) {
  const name = String(value || "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(name)) {
    throw new Error(`Bucket inválido: ${value}`);
  }
  return name;
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function listFolder(client, bucket, prefix = "") {
  const result = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Falha ao listar ${bucket}/${prefix}: ${error.message}`);
    const entries = data || [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) result.push(safeStoragePath(path));
      else result.push(...(await listFolder(client, bucket, safeStoragePath(path))));
    }
    if (entries.length < PAGE_SIZE) break;
  }
  return result;
}

export async function backupStorage({ projectUrl, serviceRoleKey, outputDirectory, commit, label }) {
  if (projectUrl !== EXPECTED_URL) throw new Error("Somente a URL de homologação é permitida.");
  if (!serviceRoleKey) throw new Error("Chave protegida do Storage não configurada.");
  if (!/^[0-9a-f]{40}$/i.test(commit || "")) throw new Error("SHA completo obrigatório.");

  const root = resolve(outputDirectory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const client = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: buckets, error: bucketError } = await client.storage.listBuckets();
  if (bucketError) throw new Error(`Falha ao listar buckets: ${bucketError.message}`);

  const manifest = {
    schema_version: 1,
    environment: "homologation",
    project_ref: EXPECTED_REF,
    commit,
    label,
    created_at: new Date().toISOString(),
    buckets: [],
    totals: { buckets: 0, objects: 0, bytes: 0 },
    production: { accessed: false, altered: false },
  };

  for (const rawBucket of buckets || []) {
    const bucket = safeBucketName(rawBucket.name);
    const paths = await listFolder(client, bucket);
    const bucketManifest = { name: bucket, public: Boolean(rawBucket.public), objects: [] };
    for (const path of paths) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) throw new Error(`Falha ao baixar ${bucket}/${path}: ${error?.message || "sem conteúdo"}`);
      const bytes = Buffer.from(await data.arrayBuffer());
      const destination = join(root, "objects", bucket, safeStoragePath(path));
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { mode: 0o600 });
      bucketManifest.objects.push({
        path,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        content_type: data.type || "application/octet-stream",
      });
      manifest.totals.objects += 1;
      manifest.totals.bytes += bytes.byteLength;
    }
    manifest.buckets.push(bucketManifest);
  }
  manifest.totals.buckets = manifest.buckets.length;
  await writeFile(join(root, "storage-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

async function main() {
  const outputDirectory = process.env.BACKUP_OUTPUT_DIRECTORY;
  const commit = process.env.BACKUP_COMMIT;
  const label = process.env.BACKUP_LABEL || "storage-homologacao";
  const manifest = await backupStorage({
    projectUrl: process.env.SUPABASE_HOMOLOGATION_URL,
    serviceRoleKey: process.env.SUPABASE_HOMOLOGATION_SERVICE_ROLE_KEY,
    outputDirectory,
    commit,
    label,
  });
  process.stdout.write(`${JSON.stringify({ ok: true, totals: manifest.totals })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
