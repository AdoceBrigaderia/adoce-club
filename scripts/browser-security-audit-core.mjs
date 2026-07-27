import { extname, relative, sep } from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const DEFAULT_IGNORED_PATTERNS = [
  /(?:^|\/)node_modules(?:\/|$)/,
  /(?:^|\/)dist(?:\/|$)/,
  /(?:^|\/)artifacts(?:\/|$)/,
  /(?:^|\/)coverage(?:\/|$)/,
  /\.d\.(?:ts|mts|cts)$/,
  /\.(?:test|spec)\.[cm]?[jt]sx?$/,
  /(?:^|\/)LegacyPrototype(?:\.|\/)/i,
  /(?:^|\/)legacy(?:\/|$)/i,
  /(?:^|\/)demo(?:\/|$)/i,
  /(?:^|\/)prototype(?:\/|$)/i,
];

const AUTH_STORAGE_CONTEXT =
  /(?:auth|access[_-]?token|refresh[_-]?token|bearer|supabase|remember[-_ ]?login|credential|jwt|password)/i;

const RULES = [
  {
    id: "client-secret-environment",
    severity: "critical",
    description:
      "Segredo foi referenciado por variável VITE_ e pode entrar no bundle público.",
    pattern:
      /\bVITE_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|SERVICE_ROLE|ACCESS_TOKEN|REFRESH_TOKEN|APP_SECRET|PEPPER)[A-Z0-9_]*\b/g,
  },
  {
    id: "private-key-material",
    severity: "critical",
    description:
      "Material de chave privada foi encontrado em código do navegador.",
    pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
  },
  {
    id: "browser-session-api",
    severity: "critical",
    description: "Fluxo do navegador manipula diretamente a sessão Supabase.",
    pattern:
      /\.auth\.(?:setSession|getSession|refreshSession|onAuthStateChange|exchangeCodeForSession)\s*\(/g,
  },
  {
    id: "browser-authentication-api",
    severity: "critical",
    description:
      "Superfície real autentica diretamente pelo cliente Supabase, fora do BFF.",
    pattern:
      /\.auth\.(?:signInWithPassword|signInWithOtp|verifyOtp|signOut|updateUser|resetPasswordForEmail)\s*\(/g,
  },
  {
    id: "bearer-token-in-browser",
    severity: "critical",
    description: "Código do navegador monta cabeçalho Bearer manualmente.",
    pattern:
      /(?:Authorization\s*["']?\s*[:=][^\n]{0,120}Bearer\s+|Bearer\s+\$\{[^}]+\})/gi,
  },
  {
    id: "token-response-shape",
    severity: "critical",
    description:
      "Superfície real referencia access_token/refresh_token no navegador.",
    pattern: /\b(?:access_token|refresh_token)\b/g,
  },
  {
    id: "direct-supabase-sdk-import",
    severity: "warning",
    description: "Módulo do navegador importa o SDK Supabase diretamente.",
    pattern: /from\s+["']@supabase\/supabase-js["']/g,
    exceptPaths: new Set(["src/lib/supabase.ts"]),
    ignoreTypeOnlyImport: true,
  },
];

function toPosix(path) {
  return path.split(sep).join("/");
}

export function isAuditableSource(
  path,
  ignoredPatterns = DEFAULT_IGNORED_PATTERNS,
) {
  const normalized = toPosix(path);
  if (!SOURCE_EXTENSIONS.has(extname(normalized))) return false;
  return !ignoredPatterns.some((pattern) => pattern.test(normalized));
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function sourceLineAt(source, index) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const endCandidate = source.indexOf("\n", index);
  const end = endCandidate === -1 ? source.length : endCandidate;
  return source.slice(start, end).trim().slice(0, 240);
}

function isTypeOnlyImport(source, index) {
  const line = sourceLineAt(source, index);
  return /^import\s+type\b/.test(line);
}

function storageViolations(path, source) {
  const findings = [];
  const storagePattern = /\b(?:localStorage|sessionStorage)\b/g;
  for (const match of source.matchAll(storagePattern)) {
    const start = Math.max(0, match.index - 180);
    const end = Math.min(source.length, match.index + 260);
    const context =
      source.slice(start, match.index) +
      source.slice(match.index + match[0].length, end);
    if (!AUTH_STORAGE_CONTEXT.test(context)) continue;
    findings.push({
      id: "persistent-auth-storage",
      severity: "critical",
      description:
        "Armazenamento do navegador é usado em contexto de autenticação ou token.",
      path,
      line: lineNumberAt(source, match.index),
      excerpt: sourceLineAt(source, match.index),
      developmentOnly: false,
    });
  }
  return findings;
}

export function auditBrowserSource(path, source) {
  const normalizedPath = toPosix(path);
  if (!isAuditableSource(normalizedPath)) return [];

  const findings = [...storageViolations(normalizedPath, source)];
  for (const rule of RULES) {
    if (rule.exceptPaths?.has(normalizedPath)) continue;
    for (const match of source.matchAll(rule.pattern)) {
      if (rule.ignoreTypeOnlyImport && isTypeOnlyImport(source, match.index)) {
        continue;
      }
      findings.push({
        id: rule.id,
        severity: rule.severity,
        description: rule.description,
        path: normalizedPath,
        line: lineNumberAt(source, match.index),
        excerpt: sourceLineAt(source, match.index),
        developmentOnly: false,
      });
    }
  }
  return findings;
}

export function auditBrowserFiles(files) {
  const findings = files.flatMap(({ path, source }) =>
    auditBrowserSource(path, source),
  );
  const critical = findings.filter((item) => item.severity === "critical");
  const warnings = findings.filter((item) => item.severity === "warning");
  return {
    generatedAt: new Date().toISOString(),
    filesScanned: files.filter(({ path }) => isAuditableSource(path)).length,
    critical,
    warnings,
    passed: critical.length === 0,
  };
}

export function relativeSourcePath(root, absolutePath) {
  return toPosix(relative(root, absolutePath));
}
