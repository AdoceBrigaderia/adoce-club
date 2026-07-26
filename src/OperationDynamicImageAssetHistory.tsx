import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, History, RotateCcw, UserRound } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { requireSupabase } from "./lib/supabase";
import type { DynamicImageAsset } from "./image-library-dynamic";
import {
  dynamicImageAssetChangeLabel,
  dynamicImageAssetKey,
  dynamicImageAssetRestorePlan,
  dynamicImageAssetVersionDate,
  dynamicImageAssetVersionIsCurrent,
  type DynamicImageAssetVersion,
} from "./dynamic-image-asset-history";
import "./operation-visual-history.css";

type OperationDynamicImageAssetHistoryProps = {
  asset: DynamicImageAsset;
  session: Session;
  onRestored: (message: string) => void | Promise<void>;
};

const VERSION_FIELDS = [
  "id",
  "asset_key",
  "asset_kind",
  "owner_id",
  "label",
  "image_url",
  "original_image_url",
  "change_type",
  "changed_by",
  "changed_by_name",
  "changed_at",
].join(",");

export default function OperationDynamicImageAssetHistory({
  asset,
  session,
  onRestored,
}: OperationDynamicImageAssetHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DynamicImageAssetVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const assetKey = useMemo(() => dynamicImageAssetKey(asset), [asset]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await requireSupabase()
      .from("dynamic_image_asset_versions")
      .select(VERSION_FIELDS)
      .eq("asset_key", assetKey)
      .order("changed_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setVersions((data || []) as DynamicImageAssetVersion[]);
  }, [assetKey]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const restore = async (version: DynamicImageAssetVersion) => {
    if (dynamicImageAssetVersionIsCurrent(version, asset.currentUrl)) return;
    setBusyVersionId(version.id);
    setErrorMessage("");
    try {
      const supabase = requireSupabase();
      const plan = dynamicImageAssetRestorePlan(asset, version, session.user.id);
      const result = plan.mode === "upsert"
        ? await supabase.from(plan.table).upsert(plan.values, { onConflict: plan.onConflict })
        : await supabase.from(plan.table).update(plan.values).eq(plan.matchColumn, plan.matchValue);
      if (result.error) throw result.error;
      await onRestored(`${asset.label} voltou para a versão de ${dynamicImageAssetVersionDate(version.changed_at)}.`);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível restaurar esta versão.");
    } finally {
      setBusyVersionId("");
    }
  };

  return <section className="operation-visual-history">
    <button
      type="button"
      className="operation-visual-history-toggle"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
    >
      <History />
      <span><strong>Histórico da imagem</strong><small>Ver alterações e restaurar versões anteriores</small></span>
      <span>{open ? "Fechar" : "Abrir"}</span>
    </button>

    {open ? <div className="operation-visual-history-panel">
      {loading ? <p className="operation-visual-loading">Carregando histórico…</p> : null}
      {errorMessage ? <p className="operation-commercial-notice" role="alert">{errorMessage}</p> : null}
      {!loading && !errorMessage && versions.length === 0
        ? <p className="operation-visual-history-empty">Esta imagem ainda não possui alterações registradas.</p>
        : null}
      {!loading && versions.length > 0 ? <div className="operation-visual-history-list">
        {versions.map((version) => {
          const isCurrent = dynamicImageAssetVersionIsCurrent(version, asset.currentUrl);
          const working = busyVersionId === version.id;
          return <article key={version.id} className="operation-visual-history-version">
            <img src={version.image_url} alt={`Versão anterior de ${asset.label}`} />
            <div>
              <strong>{dynamicImageAssetChangeLabel(version.change_type)}</strong>
              <span><Clock3 /> {dynamicImageAssetVersionDate(version.changed_at)}</span>
              <span><UserRound /> {version.changed_by_name || "Usuário não identificado"}</span>
            </div>
            <button
              type="button"
              disabled={isCurrent || working}
              onClick={() => void restore(version)}
            >
              <RotateCcw /> {isCurrent ? "Versão atual" : working ? "Restaurando…" : "Restaurar"}
            </button>
          </article>;
        })}
      </div> : null}
    </div> : null}
  </section>;
}
