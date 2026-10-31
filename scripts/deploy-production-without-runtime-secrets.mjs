// Publica o build local sem consultar /env da Netlify. O deploy padrao da CLI
// baixa variaveis de functions mesmo com --no-build; este caminho evita isso.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname, "..");
if (process.cwd().toLowerCase() !== root.toLowerCase()) throw new Error("Execute na fonte principal.");
execFileSync(process.execPath, ["scripts/verify-primary-workspace.mjs"], { stdio: "inherit" });
const cache = join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
const cli = readdirSync(cache).map(dir => join(cache, dir, "node_modules", "netlify-cli"))
  .find(dir => existsSync(join(dir, "package.json")) && JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version === "26.2.0");
if (!cli) throw new Error("Instale a CLI oficial 26.2.0 antes de continuar.");
const moduleAt = relative => import(pathToFileURL(join(cli, relative)).href);
const cliRequire = createRequire(join(cli, "package.json"));
const dependency = name => import(pathToFileURL(cliRequire.resolve(name)).href);
const { resolveConfig } = await dependency("@netlify/config");
const { normalizeFunctionsConfig } = await moduleAt("dist/lib/functions/config.js");
// offline:true e ausencia de token impedem qualquer busca de variaveis remotas.
const resolved = await resolveConfig({ cwd: root, repositoryRoot: root, config: join(root, "netlify.toml"), context: "production", offline: true });
const config = resolved.config;
const functionsConfig = normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot: root, siteEnv: {} });
if (!process.argv.includes("--publish")) {
  console.log(JSON.stringify({ mode: "check", source: root, publish: config.build.publish, functions: config.functionsDirectory, runtime_env_requested: false }));
  process.exit(0);
}
// Nao contorna o portao obrigatorio: testa, confere tipos e recompila aqui.
execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run release:check"], { stdio: "inherit" });
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw new Error("Commit necessario antes de publicar.");
const { NetlifyAPI } = await dependency("@netlify/api");
const { deploySite } = await moduleAt("dist/utils/deploy/deploy-site.js");
// Usa somente a autenticacao de hospedagem ja existente na CLI local.
const account = JSON.parse(readFileSync(join(process.env.APPDATA, "netlify", "Config", "config.json"), "utf8"));
const token = account.users[account.userId]?.auth?.token;
if (!token) throw new Error("Login da CLI Netlify necessario.");
const api = new Proxy(new NetlifyAPI(token), { get(target, property) {
  if (/env/i.test(String(property))) throw new Error("Consulta de variaveis remotas proibida neste fluxo.");
  const value = Reflect.get(target, property);
  return typeof value === "function" ? value.bind(target) : value;
} });
const siteId = "bb0c96cd-5af2-4270-a9a8-b63b9637b1f4";
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const tmpDir = resolve(root, ".netlify", "secret-free-function-bundles");
if (tmpDir !== join(root, ".netlify", "secret-free-function-bundles")) throw new Error("Diretorio de pacote invalido.");
mkdirSync(tmpDir, { recursive: true });
const created = await api.createSiteDeploy({ siteId, title: `Fonte oficial ${sha.slice(0, 7)} — sem consulta de segredos`, body: { draft: false } });
console.log(`Deploy de producao criado: ${created.id}`);
const command = { getPathInProject: path => join(root, ".netlify", path) };
const result = await deploySite(command, api, siteId, resolve(root, "dist"), {
  deployId: created.id, config, functionsConfig, fnDir: [resolve(root, "netlify/functions")],
  siteRoot: root, workingDir: root, tmpDir, draft: false, skipFunctionsCache: true,
  statusCb: event => { if (event.phase === "stop") console.log(event.msg); },
});
console.log(JSON.stringify({ deploy_id: result.deployId, state: result.deploy.state, official_url: "https://www.adocebrigaderia.com.br", runtime_env_requested: false }));
