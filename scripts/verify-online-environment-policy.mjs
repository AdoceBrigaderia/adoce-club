import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const forbiddenDomain = ["adoce", "homologacao"].join("-") + ".netlify.app";
const forbiddenPreviewScript = "release:preview";
const failures = [];

const packageJson = readFileSync(join(root, "package.json"), "utf8");
if (packageJson.includes(forbiddenPreviewScript)) failures.push("package.json ainda oferece release:preview");
if (packageJson.includes("--alias=homologacao")) failures.push("package.json ainda publica alias de homologacao");

const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(?:ts|tsx|js|mjs|cjs|toml|json)$/.test(name)) {
      const source = readFileSync(path, "utf8");
      const file = relative(root, path).replaceAll("\\", "/");
      if (source.includes(forbiddenDomain)) failures.push(`${file} referencia o dominio de homologacao desativado`);
      if (source.includes('env("SITE_URL")')) failures.push(`${file} permite origem dinamica por SITE_URL`);
      if (source.includes("HOMOLOGATION_FAKE")) failures.push(`${file} contem acesso falso de homologacao`);
    }
  }
};

walk(join(root, "netlify", "functions"));
for (const file of ["src/AccessApp.tsx", "src/services/auth.ts", "netlify.toml", ".env.example"]) {
  const source = readFileSync(join(root, file), "utf8");
  if (source.includes(forbiddenDomain)) failures.push(`${file} referencia o dominio de homologacao desativado`);
  if (source.includes("HOMOLOGATION_FAKE")) failures.push(`${file} contem acesso falso de homologacao`);
}

if (failures.length) {
  console.error("Politica de ambiente online reprovada:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Politica de ambiente online aprovada: somente producao oficial; sem homologacao publica.");
