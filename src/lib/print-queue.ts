import { requireSupabase } from "./supabase";

// Envia um cupom já formatado (32 colunas) para a fila que o tablet imprime.
// Funciona de qualquer aparelho: o tablet do balcão consulta a fila e imprime.
export async function queuePrint(title: string, lines: string[]) {
  const safeLines = lines.slice(0, 600).map((line) => line.slice(0, 64));
  const { error } = await requireSupabase().rpc("staff_queue_print_job", { requested_title: title.slice(0, 80), requested_lines: safeLines });
  if (error) throw error;
}

export async function queuePrints(jobs: Array<{ title: string; lines: string[] }>) {
  for (const job of jobs) if (job.lines.length) await queuePrint(job.title, job.lines);
}
