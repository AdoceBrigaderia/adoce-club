import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import OperationBusinessStructure from "./OperationBusinessStructure";
import { requireSupabase } from "./lib/supabase";

export default function OperationBusinessHub() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void requireSupabase().auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setError(sessionError?.message || "Não foi possível abrir a estrutura da operação.");
        return;
      }
      setSession(data.session);
    });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <p className="operation-dashboard-notice" role="status">{error}</p>;
  }
  if (!session) {
    return <p className="operation-dashboard-notice">Carregando lojas, caixas e equipe…</p>;
  }
  return <OperationBusinessStructure session={session} />;
}
