import { requireSupabase } from "../lib/supabase";

export type ApologySummary = {
  total: number; normal: number; reversed: number; pending: number;
  sent: number; failed: number; uncertain: number;
  examples: { normal: string | null; reversed: string | null };
};
export async function requestApology(mode: "preview" | "send" = "preview") {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session) throw new Error("Sessão obrigatória. Entre novamente.");
  const response = await fetch("/api/duplicate-stamps-apology", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(mode === "send" ? { mode, confirmation: "duplicate-stamps-2026-10:send" } : { mode }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível executar. Confira a auditoria.");
  return result;
}
