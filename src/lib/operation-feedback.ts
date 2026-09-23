export type OperationMessageKind = "success" | "error";

const errorPattern =
  /n[ãa]o foi poss[íi]vel|n[ãa]o (possui|tem|est[áa])|erro|inv[áa]lid|insuficiente|precisa[m]? |use no m[íi]nimo|aponte para|acesso n[ãa]o autorizado|sem permiss[ãa]o|falhou|indispon[íi]vel|expirou/i;

// Mensagens técnicas que chegam cruas do Supabase, do navegador ou do Capacitor.
const technicalTranslations: Array<[RegExp, string]> = [
  [/failed to fetch|networkerror|network request failed|load failed/i, "Sem conexão com a internet. Confira a rede e tente de novo."],
  [/jwt expired|invalid jwt|refresh token/i, "Sua sessão expirou. Saia e entre novamente na operação."],
  [/permission denied|row-level security|not authorized|acesso n[ãa]o autorizado/i, "Seu perfil não tem permissão para esta ação. Peça ajuda à gerência."],
  [/duplicate key|already exists/i, "Esse registro já existe."],
  [/timeout|timed out/i, "O servidor demorou para responder. Tente de novo em instantes."],
  [/violates (check|foreign key|not-null) constraint/i, "Algum dado obrigatório está faltando ou é inválido."],
];

// Mensagem em inglês vinda do servidor ou do navegador (palavras típicas de erro técnico).
function looksTechnical(text: string) {
  return (
    !/[áàâãéêíóôõúç]/i.test(text) &&
    /\b(the|is|not|of|to|for|with|failed|error|invalid|unexpected|violates|column|relation|function|does|exist|null|undefined|cannot|unable|issue|request)\b/i.test(text)
  );
}

export function describeOperationMessage(raw: string): { kind: OperationMessageKind; text: string } {
  const text = raw.trim();
  if (!text) return { kind: "success", text: "" };
  for (const [pattern, friendly] of technicalTranslations) {
    if (pattern.test(text)) return { kind: "error", text: friendly };
  }
  if (looksTechnical(text)) {
    return { kind: "error", text: `Não foi possível concluir. Detalhe técnico: ${text}` };
  }
  return { kind: errorPattern.test(text) ? "error" : "success", text };
}
