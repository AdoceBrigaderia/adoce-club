import { validateHomologationEnvironment } from "./homologation-environment-core.mjs";

const result = validateHomologationEnvironment(process.env);

console.log("\nPORTÃO DE ISOLAMENTO DA HOMOLOGAÇÃO\n");
for (const [check, passed] of Object.entries(result.checks)) {
  console.log(`${passed ? "[ok]" : "[--]"} ${check}`);
}
for (const warning of result.warnings) {
  console.warn(`[alerta] ${warning}`);
}
if (!result.passed) {
  for (const error of result.errors) {
    console.error(`[bloqueio] ${error}`);
  }
  throw new Error(
    "Publicação de homologação bloqueada: ambiente, origem, segredos do núcleo ou Supabase não passaram pelo isolamento obrigatório.",
  );
}

console.log(
  "\nHomologação isolada: origem canônica, BFF, passkeys, peppers, segredo server-only, chave pública e Supabase autorizado foram validados.\n",
);
