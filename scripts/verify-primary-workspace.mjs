import { realpathSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const primaryWorkspace = "D:/AdoceOnLine";
export function verifyPrimaryWorkspace(directory = process.cwd(), expected = primaryWorkspace) {
  const actual = realpathSync(directory).replaceAll("\\", "/").toLowerCase();
  const canonical = realpathSync(expected).replaceAll("\\", "/").toLowerCase();
  if (actual !== canonical) throw new Error("BLOQUEADO: este projeto só pode ser atualizado, testado e compilado em D:\\AdoceOnLine.");
  const duplicates = [];
  const ignored = new Set(["node_modules", ".git", ".netlify", "dist", "build", ".gradle", ".java-tmp", "tmp"]);
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const child = join(current, entry.name);
      if (existsSync(join(child, "package.json")) && existsSync(join(child, "src", "App.tsx"))) {
        const disabledFile = join(child, ".source-copy-disabled.json");
        const project = JSON.parse(readFileSync(join(child, "package.json"), "utf8"));
        const disabled = existsSync(disabledFile)
          && JSON.parse(readFileSync(disabledFile, "utf8")).canonical === primaryWorkspace
          && Object.keys(project.scripts || {}).length > 0
          && !existsSync(join(child, ".netlify", "state.json"))
          && Object.values(project.scripts || {}).every(command => command === 'node "D:/AdoceOnLine/scripts/verify-primary-workspace.mjs"');
        if (!disabled) duplicates.push(relative(directory, child));
        // Copies blocked by every npm command await owner-side deletion when
        // automatic execution policy rejects recursive filesystem removal.
        continue;
      } else if (existsSync(join(child, ".netlify", "state.json"))) {
        const state = JSON.parse(readFileSync(join(child, ".netlify", "state.json"), "utf8"));
        if (state.siteId === "bb0c96cd-5af2-4270-a9a8-b63b9637b1f4") duplicates.push(relative(directory, child));
      }
      walk(child);
    }
  }
  walk(directory);
  if (duplicates.length) throw new Error(`BLOQUEADO: cópias alternativas do site dentro da pasta principal: ${duplicates.join(", ")}`);
  const projectName = existsSync(join(expected, "package.json"))
    ? JSON.parse(readFileSync(join(expected, "package.json"), "utf8")).name
    : "adoce-fidelidade";
  const externalCopies = [];
  for (const entry of readdirSync(dirname(expected), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const sibling = join(dirname(expected), entry.name);
    if (realpathSync(sibling).replaceAll("\\", "/").toLowerCase() === canonical) continue;
    const siblingPackage = join(sibling, "package.json");
    if (!existsSync(siblingPackage) || !existsSync(join(sibling, "src", "App.tsx"))) continue;
    const siblingProject = JSON.parse(readFileSync(siblingPackage, "utf8"));
    if (siblingProject.name === projectName) externalCopies.push(sibling);
  }
  if (externalCopies.length) throw new Error(`BLOQUEADO: cópias externas da fonte oficial: ${externalCopies.join(", ")}`);
  return actual;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifyPrimaryWorkspace(); console.log("Fonte única verificada: D:\\AdoceOnLine."); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
