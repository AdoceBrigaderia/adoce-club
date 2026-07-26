import { useCallback, useEffect, useState } from "react";
import { Clock3, History, RotateCcw, UserRound } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { requireSupabase } from "./lib/supabase";
import {
  siteVisualAssetChangeLabel,
  siteVisualAssetRestorePayload,
  siteVisualAssetVersionDate,
  siteVisualAssetVersionIsCurrent,
  type SiteVisualAssetVersion,
} from "./site-visual-asset-history";
import "./operation-visual-history.css";

type OperationVisualAssetHistoryProps = {
  assetKey: string;
  label: string;
  currentUrl?: string | null;
  session: Session;
  onRestored: (message: string) => void | Promise<void>;
};

const VERSION_FIELDS = [
  "id",
  "asset_key",
  "label",
  "section",
  "default_url",
  "image_url",
  "original_image_url",
  "alt_text",
  "active",
  "change_type",
  "changed_by",
  "changed_by_name",
  "changed_at",
].join(",");

export default function OperationVisualAssetHistory({
  assetKey,
  label,
  currentUrl,
  session,
  onRestored,
}: OperationVisualAssetHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<SiteVisualAssetVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await requireSupabase()
      .from("site_visual_asset_versions")
      .select(VERSION_FIELDS)
      .eq("asset_key", assetKey)
      .order("changed_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setVersions((data || []) as unknown as SiteVisualAssetVersion[]);
  }, [assetKey]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const restore = async (version: SiteVisualAssetVersion) => {
    if (siteVisualAssetVersionIsCurrent(version, currentUrl)) return;
    setBusyVersionId(version.id);
    setErrorMessage("");
    try {
      const { error } = await requireSupabase()
        .from("site_visual_assets")
        .upsert(siteVisualAssetRestorePayload(version, session.user.id), {
          onConflict: "asset_key",
        });
      if (error) throw error;
      await onRestored(`${label} voltou para a versão de ${siteVisualAssetVersionDate(version.changed_at)}.`);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível restaurar esta versão.");
    } finally {
      setBusyVersionId("");
    }
  };

  return <section className="operation-visual-history">
    <button type="button" className="operation-visual-history-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <History />
      <span><strong>Histórico da imagem</strong><small>Ver alterações e restaurar versões anteriores</small></span>
      <span>{open ? "Fechar" : "Abrir"}</span>
    </button>
    {open ? <div className="operation-visual-history-panel">
      {loading ? <p>Carregando histórico…</p> : null}
      {errorMessage ? <p className="operation-visual-history-error">{errorMessage}</p> : null}
      {!loading && !errorMessage && versions.length === 0 ? <p>Nenhuma alteração registrada.</p> : null}
      {versions.map((version) => {
        const current = siteVisualAssetVersionIsCurrent(version, currentUrl);
        return <article key={version.id}>
          <img src={version.image_url || version.default_url} alt="" />
          <div>
            <strong>{siteVisualAssetChangeLabel(version.change_type)}</strong>
            <small><Clock3 /> {siteVisualAssetVersionDate(version.changed_at)}</small>
            <small><UserRound /> {version.changed_by_name || "Sistema Adoce"}</small>
          </div>
          {current ? <span className="operation-visual-history-current">Versão atual</span> : <button type="button" disabled={Boolean(busyVersionId)} onClick={() => void restore(version)}><RotateCcw /> {busyVersionId === version.id ? "Restaurando…" : "Restaurar"}</button>}
        </article>;
      })}
    </div> : null}
  </section>;
}
