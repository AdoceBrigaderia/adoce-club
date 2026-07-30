import path from "node:path";

export const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)(?:[?#][^\s"'`)<>]*)?$/i;

const QUOTED_IMAGE_PATTERN = /(["'`])([^"'`\n\r]+?\.(?:avif|gif|ico|jpe?g|png|svg|webp)(?:[?#][^"'`\n\r]*)?)\1/gi;
const CSS_IMAGE_PATTERN = /url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gi;
const HTML_IMAGE_PATTERN = /(?:src|srcset|content)\s*=\s*(["'])(.*?)\1/gi;

export function isExternalImageReference(value) {
  return /^(?:data:|blob:|https?:\/\/|\/\/)/i.test(value.trim());
}

export function normalizeLocalImageReference(value, sourceFile = "") {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("#") || isExternalImageReference(raw)) return null;

  if (raw.startsWith("/.netlify/images")) {
    try {
      const proxied = new URL(raw, "https://adoce.local").searchParams.get("url");
      return proxied ? normalizeLocalImageReference(proxied, sourceFile) : null;
    } catch {
      return null;
    }
  }

  const withoutQuery = raw.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  if (!IMAGE_EXTENSION_PATTERN.test(withoutQuery)) return null;

  if (withoutQuery.startsWith("/")) return path.posix.normalize(withoutQuery);

  const normalizedSource = sourceFile.replace(/\\/g, "/");
  if (withoutQuery.startsWith("public/")) {
    return `/${path.posix.normalize(withoutQuery.slice("public/".length))}`;
  }

  if (withoutQuery.startsWith("./") || withoutQuery.startsWith("../")) {
    const directory = path.posix.dirname(normalizedSource);
    const resolved = path.posix.normalize(path.posix.join(directory, withoutQuery));
    if (resolved.startsWith("public/")) return `/${resolved.slice("public/".length)}`;
    return null;
  }

  if (normalizedSource === "index.html" || normalizedSource.startsWith("public/")) {
    const baseDirectory = normalizedSource === "index.html"
      ? "public"
      : path.posix.dirname(normalizedSource);
    const resolved = path.posix.normalize(path.posix.join(baseDirectory, withoutQuery));
    if (resolved.startsWith("public/")) return `/${resolved.slice("public/".length)}`;
  }

  return null;
}

export function extractImageReferences(content, sourceFile = "") {
  const references = new Set();
  const add = (candidate) => {
    const normalized = normalizeLocalImageReference(candidate, sourceFile);
    if (normalized) references.add(normalized);
  };

  for (const match of content.matchAll(QUOTED_IMAGE_PATTERN)) add(match[2]);
  for (const match of content.matchAll(CSS_IMAGE_PATTERN)) add(match[2] || match[3]);
  for (const match of content.matchAll(HTML_IMAGE_PATTERN)) {
    const values = match[2].split(",").map((candidate) => candidate.trim().split(/\s+/, 1)[0]);
    values.forEach(add);
  }

  return [...references].sort();
}

export function extractCatalogKeys(content) {
  const keys = new Set();
  const keyPattern = /\bkey\s*:\s*(["'`])([^"'`]+)\1/g;
  for (const match of content.matchAll(keyPattern)) {
    const normalized = normalizeLocalImageReference(match[2], "src/site-visual-assets.ts");
    if (normalized) keys.add(normalized);
  }
  return keys;
}

export function classifyImageReferences({ references, catalogKeys, publicFiles }) {
  const registered = [];
  const unregistered = [];
  const missing = [];

  for (const reference of [...references].sort()) {
    const exists = publicFiles.has(reference);
    const cataloged = catalogKeys.has(reference);
    if (!exists) missing.push(reference);
    else if (cataloged) registered.push(reference);
    else unregistered.push(reference);
  }

  const orphaned = [...publicFiles]
    .filter((file) => !references.has(file) && !catalogKeys.has(file))
    .sort();

  const catalogMissing = [...catalogKeys]
    .filter((file) => !publicFiles.has(file))
    .sort();

  return { registered, unregistered, missing, orphaned, catalogMissing };
}

export function buildAuditReport({ usages, catalogKeys, publicFiles }) {
  const references = new Set(usages.keys());
  const classification = classifyImageReferences({ references, catalogKeys, publicFiles });
  const usageDetails = [...usages.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reference, files]) => ({ reference, files: [...files].sort() }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      references: references.size,
      registered: classification.registered.length,
      unregistered: classification.unregistered.length,
      missing: classification.missing.length,
      catalogMissing: classification.catalogMissing.length,
      publicFiles: publicFiles.size,
      orphaned: classification.orphaned.length,
    },
    ...classification,
    usages: usageDetails,
  };
}

export function auditExitCode(report, strict = false) {
  if (report.missing.length > 0 || report.catalogMissing.length > 0) return 1;
  if (strict && report.unregistered.length > 0) return 2;
  return 0;
}
