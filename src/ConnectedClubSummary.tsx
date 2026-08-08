import { useCallback, useEffect, useState } from "react";
import { Heart, QrCode, Settings2 } from "lucide-react";

export type ConnectedClubSummary = {
  firstName: string;
  progress: number;
  completedCycles: number;
  referralProgress: number;
  rewards: number;
  memberCode: string;
};

export async function loadConnectedClubSummary(): Promise<ConnectedClubSummary | null> {
  const response = await fetch("/api/customer-club-summary", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error("Não foi possível abrir o Clube agora.");
  return response.json() as Promise<ConnectedClubSummary>;
}

export function useConnectedClubSummary() {
  const [summary, setSummary] = useState<ConnectedClubSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setSummary(await loadConnectedClubSummary());
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch(() => { if (active) setSummary(null); }).finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { summary, loading };
}

export function ConnectedHomeClubCard({ summary }: { summary: ConnectedClubSummary }) {
  const remaining = Math.max(0, 14 - summary.progress);
  return (
    <aside className="public-connected-club" aria-label="Seu cartão Clube Adoce">
      <div className="public-connected-club-head">
        <div>
          <span>Olá, {summary.firstName}!</span>
          <strong>Meus carimbos</strong>
        </div>
        <b>{summary.progress}<small> de 14</small></b>
      </div>
      <div className="public-connected-stamps" aria-label={`${summary.progress} de 14 carimbos`}>
        {Array.from({ length: 14 }, (_, index) => (
          <span className={index < summary.progress ? "filled" : ""} key={index}>
            <Heart />
          </span>
        ))}
      </div>
      <p>
        {summary.rewards > 0
          ? `${summary.rewards} fatia${summary.rewards === 1 ? "" : "s"} grátis disponível${summary.rewards === 1 ? "" : "is"}.`
          : `Faltam ${remaining} carimbo${remaining === 1 ? "" : "s"} para sua fatia grátis.`}
      </p>
      <div className="public-connected-club-actions">
        <a href="/#minha-conta"><Heart /> Abrir meu cartão</a>
        <a href="/#minha-conta?view=qr"><QrCode /> Meu QR</a>
        <a href="/#minha-conta?view=profile"><Settings2 /> Preferências</a>
      </div>
    </aside>
  );
}
