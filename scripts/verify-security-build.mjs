import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distIndex = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const netlifyConfig = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
const browserSupabase = readFileSync(
  new URL("../src/lib/supabase.ts", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const registrationSource = readFileSync(
  new URL("../src/CustomerRegistrationBffPage.tsx", import.meta.url),
  "utf8",
);

const cspMatch = netlifyConfig.match(/Content-Security-Policy\s*=\s*"([^"]+)"/);
if (!cspMatch) throw new Error("CSP ausente no netlify.toml.");
const csp = cspMatch[1];

const requiredHeaders = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
];

for (const header of requiredHeaders) {
  if (!netlifyConfig.includes(`${header} =`)) {
    throw new Error(`Cabeçalho obrigatório ausente: ${header}`);
  }
}

if (csp.includes("'unsafe-eval'")) throw new Error("CSP permite unsafe-eval.");
const scriptDirective = csp.match(/script-src [^;]+/)?.[0] || "";
if (scriptDirective.includes("'unsafe-inline'")) {
  throw new Error("script-src ainda permite JavaScript inline.");
}

if (/localStorage|sessionStorage/.test(browserSupabase)) {
  throw new Error("Cliente Supabase do navegador ainda acessa armazenamento persistente.");
}
if (!browserSupabase.includes("persistSession: false")) {
  throw new Error("Cliente Supabase do navegador ainda pode persistir sessão.");
}
if (!browserSupabase.includes("autoRefreshToken: false")) {
  throw new Error("Cliente Supabase do navegador ainda renova tokens diretamente.");
}
if (!appSource.includes('import("./CustomerRegistrationBffPage")')) {
  throw new Error("Cadastro público real não está roteado para o BFF.");
}
for (const marker of ["requireSupabase", "auth.setSession", "Authorization"]) {
  if (registrationSource.includes(marker)) {
    throw new Error(`Cadastro BFF contém acesso proibido no navegador: ${marker}`);
  }
}

const scripts = [...distIndex.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for (const [, attributes, body] of scripts) {
  if (/\bsrc=/.test(attributes)) continue;
  if (/type=["']application\/ld\+json["']/.test(attributes)) {
    const digest = createHash("sha256").update(body).digest("base64");
    if (!csp.includes(`'sha256-${digest}'`)) {
      throw new Error("O JSON-LD compilado não está autorizado pelo hash da CSP.");
    }
    continue;
  }
  if (body.trim()) throw new Error("Build contém JavaScript executável inline.");
}

const externalExecutableScript = scripts.find(([, attributes]) => {
  const source = attributes.match(/\bsrc=["']([^"']+)["']/)?.[1];
  return source && /^(?:https?:)?\/\//.test(source);
});
if (externalExecutableScript) {
  throw new Error("Build carrega script executável de origem externa.");
}

function filesInside(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    return entry.isDirectory() ? filesInside(target) : [target];
  });
}

const productionFiles = filesInside(distDirectory);
const javascriptFiles = productionFiles.filter((file) => file.endsWith(".js"));
const forbiddenLegacyMarkers = [
  "adoce-fidelidade-v1",
  "contas de demonstração",
  "#prototipo",
  "LegacyPrototype",
  "adoce-remember-login",
  "/api/customer-phone-login",
  "/api/staff-phone-login",
];

for (const file of javascriptFiles) {
  const source = readFileSync(file, "utf8");
  for (const marker of forbiddenLegacyMarkers) {
    if (source.includes(marker)) {
      throw new Error(
        `Bundle produtivo contém marcador proibido: ${marker} em ${file.slice(dirname(distDirectory).length)}`,
      );
    }
  }
}

if (productionFiles.some((file) => /LegacyPrototype/i.test(file))) {
  throw new Error("Build produtivo gerou chunk do protótipo legado.");
}

console.log(
  "Gate de segurança aprovado: CSP, headers, scripts, isolamento do protótipo, cadastro BFF e ausência de persistência de tokens validados.",
);
