import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const distIndex = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const netlifyConfig = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");

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

console.log("Gate de segurança do build aprovado: CSP, headers e scripts validados.");
