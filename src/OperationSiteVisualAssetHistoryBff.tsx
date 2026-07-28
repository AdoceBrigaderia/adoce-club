import { useCallback, useEffect, useState } from "react";
import { Clock3, History, RotateCcw, UserRound } from "lucide-react";
import {
  siteVisualAssetChangeLabel,
  siteVisualAssetVersionDate,
  siteVisualAssetVersionIsCurrent,
  type SiteVisualAssetVersion,
} from "./site-visual-asset-history";
import {
  listSiteVisualVersions,
  restoreSiteVisualAssetVersion,
} from "./services/bff-site-visual";
import "./operation-visual-history.css";

type Props = {
  assetKey: string;
  label: string;
  currentUrl?: string | null;
  onRestored: (message: string) => void | Promise<void>;
};

export default function OperationSiteVisualAssetHistoryBff({
  assetKey,
  label,
  currentUrl,
  onRestored,
}: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<SiteVisualAssetVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setVersions(await listSiteVisualVersions(assetKey));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível carregar o histórico.",
      );
    } finally {
      setLoading(false);
    }
  }, [assetKey]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const restore = async (version: SiteVisualAssetVersion) => {
    if (siteVisualAssetVersionIsCurrent(version, currentUrl)) return;
    setBusyVersionId(version.id);
    setErrorMessage("");
    try {
      await restoreSiteVisualAssetVersion(version.id);
      await onRestored(
        `${label} voltou para a versão de ${siteVisualAssetVersionDate(version.changed_at)}.`,
      );
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível restaurar esta versão.",
      );
    } finally {
      setBusyVersionId("");
    }
  };

  return (
    <section className="operation-visual-history">
      <button
        type="button"
        className="operation-visual-history-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <History />
        <span>
          <strong>Histórico da imagem</strong>
          <small>Ver alterações e restaurar versões anteriores</small>
        </span>
        <span>{open ? "Fechar" : "Abrir"}</span>
      </button>
      {open ? (
        <div className="operation-visual-history-panel">
          {loading ? <p>Carregando histórico…</p> : null}
          {errorMessage ? (
            <p className="operation-visual-history-error">{errorMessage}</p>
          ) : null}
          {!loading && !errorMessage && versions.length === 0 ? (
            <p>Nenhuma alteração registrada.</p>
          ) : null}
          {versions.map((version) => {
            const current = siteVisualAssetVersionIsCurrent(version, currentUrl);
            return (
              <article key={version.id}>
                <img src={version.image_url || version.default_url} alt="" />
                <div>
                  <strong>{siteVisualAssetChangeLabel(version.change_type)}</strong>
                  <small><Clock3 /> {siteVisualAssetVersionDate(version.changed_at)}</small>
                  <small><UserRound /> {version.changed_by_name || "Sistema Adoce"}</small>
                </div>
                {current ? (
                  <span className="operation-visual-history-current">Versão atual</span>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busyVersionId)}
                    onClick={() => void restore(version)}
                  >
                    <RotateCcw />
                    {busyVersionId === version.id ? "Restaurando…" : "Restaurar"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
