import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const distIndex = readSource("../dist/index.html");
const netlifyConfig = readSource("../netlify.toml");
const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
const browserSupabase = readSource("../src/lib/supabase.ts");
const appSource = readSource("../src/App.tsx");
const registrationSource = readSource("../src/CustomerRegistrationBffPage.tsx");
const instantOrderSource = readSource("../src/InstantOrderPanel.tsx");
const instantOrderClient = readSource("../src/services/public-instant-order.ts");
const operationHub = readSource("../src/OperationBusinessHub.tsx");
const customerGateway = readSource("../src/PasskeyClientGateway.tsx");
const googleWalletClient = readSource("../src/services/google-wallet.ts");

const liveBffSources = [
  "../src/PasskeyClientGateway.tsx",
  "../src/PasskeyOperationGateway.tsx",
  "../src/OperationBusinessHub.tsx",
  "../src/OperationCustomerCheckIns.tsx",
  "../src/OperationManualSale.tsx",
  "../src/OperationQuickLoyalty.tsx",
  "../src/OperationCustomer360.tsx",
  "../src/OperationContingencySale.tsx",
  "../src/OperationCashReconciliation.tsx",
  "../src/OperationQuickCash.tsx",
  "../src/OperationWhatsAppHealth.tsx",
  "../src/OperationReports.tsx",
  "../src/OperationBusinessStructureBff.tsx",
  "../src/CustomerGoogleWalletButton.tsx",
  "../src/services/google-wallet.ts",
].map((path) => ({ path, source: readSource(path) }));

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
  throw new Error(
    "Cliente Supabase do navegador ainda acessa armazenamento persistente.",
  );
}
if (!browserSupabase.includes("persistSession: false")) {
  throw new Error("Cliente Supabase do navegador ainda pode persistir sessão.");
}
if (!browserSupabase.includes("autoRefreshToken: false")) {
  throw new Error(
    "Cliente Supabase do navegador ainda renova tokens diretamente.",
  );
}
if (!appSource.includes('import("./CustomerRegistrationBffPage")')) {
  throw new Error("Cadastro público real não está roteado para o BFF.");
}
for (const marker of ["requireSupabase", "auth.setSession", "Authorization"]) {
  if (registrationSource.includes(marker)) {
    throw new Error(
      `Cadastro BFF contém acesso proibido no navegador: ${marker}`,
    );
  }
}
for (const marker of [
  "requireSupabase",
  "auth.getSession",
  '.rpc("submit_instant_order_v5"',
  "Authorization",
]) {
  if (instantOrderSource.includes(marker)) {
    throw new Error(
      `Pedido público contém acesso proibido no navegador: ${marker}`,
    );
  }
}
if (!instantOrderSource.includes("submitPublicInstantOrder")) {
  throw new Error("Pedido público real não usa o cliente BFF seguro.");
}
if (!instantOrderClient.includes('fetch("/api/public-instant-order"')) {
  throw new Error(
    "Cliente do pedido público não aponta para o endpoint BFF oficial.",
  );
}

const forbiddenLiveBrowserMarkers = [
  "requireSupabase",
  "@supabase/supabase-js",
  "auth.setSession",
  "auth.getSession",
  "localStorage",
  "sessionStorage",
  "Authorization",
];
for (const { path, source } of liveBffSources) {
  for (const marker of forbiddenLiveBrowserMarkers) {
    if (source.includes(marker)) {
      throw new Error(
        `Fluxo real contém acesso proibido no navegador: ${marker} em ${path}`,
      );
    }
  }
}

if (!operationHub.includes("<OperationManualSale />")) {
  throw new Error("A operação real não expõe a venda rápida.");
}
if (!customerGateway.includes("<CustomerGoogleWalletButton")) {
  throw new Error("O cartão real do cliente não oferece Google Wallet.");
}
if (!googleWalletClient.includes('fetch("/api/google-wallet-pass"')) {
  throw new Error("Google Wallet não está isolado no endpoint BFF oficial.");
}

const scripts = [...distIndex.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for (const [, attributes, body] of scripts) {
  if (/\bsrc=/.test(attributes)) continue;
  if (/type=["']application\/ld\+json["']/.test(attributes)) {
    const digest = createHash("sha256").update(body).digest("base64");
    if (!csp.includes(`'sha256-${digest}'`)) {
      throw new Error(
        "O JSON-LD compilado não está autorizado pelo hash da CSP.",
      );
    }
    continue;
  }
  if (body.trim())
    throw new Error("Build contém JavaScript executável inline.");
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
  "GOOGLE_WALLET_PRIVATE_KEY",
  "BEGIN PRIVATE KEY",
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
  "Gate de segurança aprovado: CSP, headers, scripts, isolamento do protótipo, cadastro, pedidos, operação real e Google Wallet pelo BFF, sem persistência de tokens ou segredos no bundle.",
);
