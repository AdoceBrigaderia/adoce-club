import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { loadImage } from "@napi-rs/canvas";

const root = resolve(import.meta.dirname, "..");
const publicDir = join(root, "public");
const stamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
}).format(new Date()).replace(/[ :]/g, "-");
const outputDir = join(root, "exports", `fotos-site-adoce-${stamp}`);
const imagesDir = join(outputDir, "imagens");
const supported = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"]);

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

function safePart(value) {
  return String(value || "imagem")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "imagem";
}

function csv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function dimensions(bytes) {
  try {
    const image = await loadImage(bytes);
    return { width: image.width, height: image.height };
  } catch {
    return { width: null, height: null };
  }
}

const env = parseEnv(await readFile(join(root, ".env.local"), "utf8"));
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Configuração pública do catálogo não encontrada em .env.local.");

await mkdir(imagesDir, { recursive: true });

const references = [];
const failures = [];
const seenHashes = new Map();
const usedPaths = new Map();
const uniqueImages = [];

function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
}

async function saveReference({ source, label, origin, bytes, preferredPath }) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  let savedPath = seenHashes.get(hash);
  if (!savedPath) {
    savedPath = preferredPath;
    const previousHash = usedPaths.get(savedPath);
    if (previousHash && previousHash !== hash) {
      const extension = extname(savedPath);
      savedPath = `${savedPath.slice(0, -extension.length)}-${hash.slice(0, 8)}${extension}`;
    }
    const absolute = join(outputDir, savedPath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    seenHashes.set(hash, savedPath);
    usedPaths.set(savedPath, hash);
    const size = await dimensions(bytes);
    uniqueImages.push({ savedPath, hash, bytes: bytes.length, ...size });
  }
  references.push({
    source,
    label,
    origin,
    savedPath,
    duplicate: savedPath !== preferredPath,
    hash,
  });
}

const localFiles = (await walk(publicDir)).filter((file) => supported.has(extname(file).toLowerCase()));
for (const file of localFiles) {
  const publicPath = relative(publicDir, file).replaceAll("\\", "/");
  const bytes = await readFile(file);
  await saveReference({
    source: `/${publicPath}`,
    label: basename(publicPath, extname(publicPath)),
    origin: "Arquivo do site",
    bytes,
    preferredPath: `imagens/arquivos-do-site/${publicPath}`,
  });
}

const tables = [
  {
    name: "flavors",
    select: "id,name,image_path,whole_cake_image_path,whole_cake_original_image_path",
    fields: ["image_path", "whole_cake_image_path", "whole_cake_original_image_path"],
    label: (row, field) => `${row.name} - ${field}`,
  },
  {
    name: "flavor_images",
    select: "id,flavor_id,image_path,original_image_path,alt_text",
    fields: ["image_path", "original_image_path"],
    label: (row, field) => `${row.alt_text || row.flavor_id} - ${field}`,
  },
  {
    name: "commercial_products",
    select: "id,slug,name,segment,image_url,original_image_url",
    fields: ["image_url", "original_image_url"],
    label: (row, field) => `${row.name} - ${field}`,
  },
  {
    name: "commercial_segment_media",
    select: "segment,image_url,original_image_url,alt_text",
    fields: ["image_url", "original_image_url"],
    label: (row, field) => `${row.alt_text || row.segment} - ${field}`,
  },
  {
    name: "commercial_media_items",
    select: "id,segment,product_id,media_type,image_url,original_image_url,alt_text",
    fields: ["image_url", "original_image_url"],
    label: (row, field) => `${row.alt_text || row.product_id || row.segment || row.id} - ${field}`,
  },
];

for (const table of tables) {
  try {
    const endpoint = `${supabaseUrl}/rest/v1/${table.name}?select=${encodeURIComponent(table.select)}`;
    const response = await fetchWithTimeout(endpoint, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const rows = await response.json();
    for (const row of rows) {
      for (const field of table.fields) {
        const value = row[field];
        if (!value || typeof value !== "string") continue;
        try {
          let bytes;
          let extension = extname(new URL(value, supabaseUrl).pathname).toLowerCase();
          if (!supported.has(extension)) extension = ".jpg";
          if (value.startsWith("/")) {
            const local = join(publicDir, value.replace(/^\/+/, ""));
            bytes = await readFile(local);
          } else {
            const imageResponse = await fetchWithTimeout(value);
            if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);
            bytes = Buffer.from(await imageResponse.arrayBuffer());
          }
          const label = table.label(row, field);
          await saveReference({
            source: value,
            label,
            origin: `${table.name}.${field}`,
            bytes,
            preferredPath: `imagens/catalogo-online/${safePart(table.name)}/${safePart(label)}${extension}`,
          });
        } catch (error) {
          failures.push({ source: value, origin: `${table.name}.${field}`, error: error.message });
        }
      }
    }
  } catch (error) {
    failures.push({ source: table.name, origin: "Consulta ao catálogo", error: error.message });
  }
}

const sizeByPath = new Map(uniqueImages.map((item) => [item.savedPath, item]));
const rows = references.map((item) => ({ ...item, ...sizeByPath.get(item.savedPath) }));
const csvHeader = ["arquivo_no_pacote", "nome_ou_uso", "origem", "endereco_original", "largura_px", "altura_px", "tamanho_bytes", "sha256", "copia_identica_reaproveitada"];
const csvText = [
  csvHeader.map(csv).join(";"),
  ...rows.map((row) => [row.savedPath, row.label, row.origin, row.source, row.width, row.height, row.bytes, row.hash, row.duplicate ? "sim" : "não"].map(csv).join(";")),
].join("\r\n");
await writeFile(join(outputDir, "mapa-das-imagens.csv"), `\ufeff${csvText}`, "utf8");

const cards = uniqueImages
  .map((item) => {
    const uses = references.filter((reference) => reference.savedPath === item.savedPath);
    return `<article><img src="${html(item.savedPath.replaceAll("\\", "/"))}" alt=""><h2>${html(basename(item.savedPath))}</h2><p>${item.width || "?"} × ${item.height || "?"} px · ${(item.bytes / 1024).toFixed(0)} KB</p><ul>${uses.map((use) => `<li><strong>${html(use.label)}</strong><br><small>${html(use.origin)} · ${html(use.source)}</small></li>`).join("")}</ul></article>`;
  })
  .join("");
const report = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fotos do site Adoce</title><style>body{font:16px Arial;margin:0;background:#fff7f1;color:#39150d}header{padding:32px;max-width:1200px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;padding:0 32px 40px;max-width:1400px;margin:auto}article{background:white;border:1px solid #eccfc2;border-radius:18px;overflow:hidden;padding-bottom:16px}img{width:100%;height:220px;object-fit:contain;background:#f9eee7}h2,p,ul{margin:12px 16px}h2{font-size:18px}small{overflow-wrap:anywhere;color:#845e52}li{margin-bottom:10px}</style></head><body><header><h1>Fotos do site Adoce</h1><p>${uniqueImages.length} arquivos únicos · ${references.length} referências encontradas · ${failures.length} falhas.</p><p>Use o arquivo <strong>mapa-das-imagens.csv</strong> para localizar de onde cada foto veio e onde ela está cadastrada.</p></header><main class="grid">${cards}</main></body></html>`;
await writeFile(join(outputDir, "galeria-para-conferencia.html"), report, "utf8");

const readme = `PACOTE DE FOTOS DO SITE ADOCE\r\n\r\nEste pacote é uma cópia para edição. Nada foi removido ou alterado no site.\r\n\r\n- Abra galeria-para-conferencia.html para ver todas as imagens.\r\n- Abra mapa-das-imagens.csv para saber o endereço original e o cadastro relacionado.\r\n- Imagens idênticas foram guardadas apenas uma vez; o mapa conserva todas as referências.\r\n- Antes de substituir uma imagem, mantenha uma cópia da original e preserve a proporção indicada no mapa.\r\n\r\nResumo: ${uniqueImages.length} imagens únicas; ${references.length} referências; ${failures.length} falhas.\r\n`;
await writeFile(join(outputDir, "LEIA-ME.txt"), readme, "utf8");
await writeFile(join(outputDir, "falhas.json"), JSON.stringify(failures, null, 2), "utf8");

console.log(JSON.stringify({ outputDir, unique: uniqueImages.length, references: references.length, failures: failures.length }, null, 2));
