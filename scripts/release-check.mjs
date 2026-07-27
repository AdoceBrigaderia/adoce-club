import { spawnSync } from "node:child_process";

const stages = [
  ["Gate integral de homologação", ["run", "verify"]],
];

console.log("\nPORTÃO DE PUBLICAÇÃO ADOCE\n");

for (const [label, args] of stages) {
  console.log(`> ${label}`);
  const command =
    process.platform === "win32"
      ? process.env.ComSpec || "cmd.exe"
      : "npm";
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `npm ${args.join(" ")}`]
      : args;
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    console.error(`\nPUBLICAÇÃO BLOQUEADA: ${label} não foi aprovado.`);
    process.exit(result.status || 1);
  }
}

console.log("\nAPROVADO PARA HOMOLOGAÇÃO VISUAL");
console.log("1. Conferir telas no computador, tablet e celular.");
console.log("2. Validar login, passkeys, NFC/QR, vendas, caixa e fidelidade.");
console.log("3. Confirmar textos, links, imagens e dados do ambiente de homologação.");
console.log("4. Produção continua sujeita ao portão de aprovação expressa.\n");
