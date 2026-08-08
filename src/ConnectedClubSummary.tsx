import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Heart, QrCode, Settings2 } from "lucide-react";
import { requireSupabase, supabase as configuredSupabase } from "./lib/supabase";

export type ConnectedClubSummary = {
  firstName: string;
  progress: number;
  rewards: number;
  memberCode: string;
};

async function loadConnectedClubSummary(
  session: Session,
): Promise<ConnectedClubSummary | null> {
  const supabase = requireSupabase();
  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,member_code,account_status")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase
        .from("account_memberships")
        .select("account_id,is_primary")
        .eq("profile_id", session.user.id)
        .eq("active", true),
    ]);

  if (profileError || membershipError || !profile || profile.account_status !== "active") {
    return null;
  }

  const accountId =
    memberships?.find((membership) => membership.is_primary)?.account_id ||
    memberships?.[0]?.account_id;
  if (!accountId) return null;

  const { data: tracks, error: tracksError } = await supabase
    .from("loyalty_tracks")
    .select("id,kind,current_progress")
    .eq("account_id", accountId);
  if (tracksError) return null;

  const mainTrack = tracks?.find((track) => track.kind === "main");
  const { count: rewards, error: rewardsError } = mainTrack
    ? await supabase
        .from("rewards")
        .select("id", { count: "exact", head: true })
        .eq("track_id", mainTrack.id)
        .eq("status", "available")
    : { count: 0, error: null };
  if (rewardsError) return null;

  const fullName = String(profile.full_name || "Cliente Adoce").trim();
  return {
    firstName: fullName.split(/\s+/)[0] || "Cliente",
    progress: Number(mainTrack?.current_progress || 0),
    rewards: Number(rewards || 0),
    memberCode: String(profile.member_code || ""),
  };
}

export function useConnectedClubSummary() {
  const [summary, setSummary] = useState<ConnectedClubSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (session: Session | null) => {
    if (!session) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setSummary(await loadConnectedClubSummary(session));
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = configuredSupabase;
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void refresh(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) window.setTimeout(() => void refresh(session), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
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
