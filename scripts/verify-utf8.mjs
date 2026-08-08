import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".css", ".mjs", ".cjs", ".json", ".md", ".html", ".sql", ".yml", ".yaml",
]);
const mojibake = /[\u00c2\u00c3][\u0080-\u00bf]/u;

export function verifyUtf8Files(files) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const errors = [];
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    let source;
    try {
      source = decoder.decode(bytes);
    } catch {
      errors.push(`${file}: bytes inválidos para UTF-8`);
      continue;
    }
    if (source.includes("\ufffd")) errors.push(`${file}: caractere de substituição UTF-8`);
    if (mojibake.test(source)) errors.push(`${file}: provável reconversão UTF-8/Latin-1`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const errors = verifyUtf8Files(files);
  if (errors.length) {
    console.error("Verificação de UTF-8 reprovada:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`UTF-8 verificado em ${files.length} arquivos rastreados.`);
  }
}
