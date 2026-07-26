import { useEffect, useState } from "react";
import OperationBusinessStructureBff from "./OperationBusinessStructureBff";
import { getBffSession, type BffSession } from "./services/bff-auth";

export default function OperationBusinessHub() {
  const [session, setSession] = useState<BffSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getBffSession()
      .then((next) => {
        if (!active) return;
        if (!next || next.user.surface !== "operation") {
          setError("Sua sessão operacional expirou. Entre novamente.");
          return;
        }
        setSession(next);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível abrir a estrutura da operação.",
        );
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
  return <OperationBusinessStructureBff userId={session.user.id} />;
}
