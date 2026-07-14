import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "docs", "clube-adoce-documentacao.html");
const destination = path.join(root, "public", "documentacao.html");

if (!fs.existsSync(source)) throw new Error("Gere a documentação antes de publicá-la.");
fs.copyFileSync(source, destination);
console.log("Documentação preparada para publicação.");
