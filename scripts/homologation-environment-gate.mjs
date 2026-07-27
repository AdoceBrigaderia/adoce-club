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
    "Publicação de homologação bloqueada: ambiente, domínio ou Supabase não passaram pelo isolamento obrigatório.",
  );
}

console.log(
  "\nHomologação isolada: domínio de produção rejeitado, frontend e Functions no mesmo Supabase autorizado e chave pública validada.\n",
);
