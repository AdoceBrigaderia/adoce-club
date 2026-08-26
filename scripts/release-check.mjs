import { spawnSync } from "node:child_process";

const stages = [
  ["Testes automatizados", ["run", "test"]],
  ["Verificacao de tipos e codigo", ["run", "lint"]],
  ["Compilacao final e documentacao", ["run", "build"]],
];

console.log("\nPORTAO DE PUBLICACAO ADOCE\n");

for (const [label, args] of stages) {
  console.log(`> ${label}`);
  const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm ${args.join(" ")}`]
    : args;
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    console.error(`\nPUBLICACAO BLOQUEADA: ${label} nao foi aprovado.`);
    process.exit(result.status || 1);
  }
}

console.log("\nAPROVADO PARA HOMOLOGACAO VISUAL");
console.log("1. Conferir as telas alteradas no computador e no celular.");
console.log("2. Confirmar textos, links, imagens e dados reais.");
console.log("3. Somente depois usar npm run release:prod.\n");
