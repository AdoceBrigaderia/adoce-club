import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, History, RotateCcw, UserRound } from "lucide-react";
import type { DynamicImageAsset } from "./image-library-dynamic";
import {
  dynamicImageAssetChangeLabel,
  dynamicImageAssetKey,
  dynamicImageAssetVersionDate,
  dynamicImageAssetVersionIsCurrent,
  type DynamicImageAssetVersion,
} from "./dynamic-image-asset-history";
import {
  listDynamicImageVersions,
  restoreDynamicImageVersion,
} from "./services/bff-dynamic-images";
import "./operation-visual-history.css";

type Props = {
  asset: DynamicImageAsset;
  onRestored: (message: string) => void | Promise<void>;
};

export default function OperationDynamicImageAssetHistoryBff({
  asset,
  onRestored,
}: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DynamicImageAssetVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const assetKey = useMemo(() => dynamicImageAssetKey(asset), [asset]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setVersions(await listDynamicImageVersions(assetKey, 20));
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

  const restore = async (version: DynamicImageAssetVersion) => {
    if (dynamicImageAssetVersionIsCurrent(version, asset.currentUrl)) return;
    setBusyVersionId(version.id);
    setErrorMessage("");
    try {
      await restoreDynamicImageVersion(version.id);
      await onRestored(
        `${asset.label} voltou para a versão de ${dynamicImageAssetVersionDate(version.changed_at)}.`,
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
            const current = dynamicImageAssetVersionIsCurrent(version, asset.currentUrl);
            return (
              <article key={version.id}>
                <img src={version.image_url} alt="" />
                <div>
                  <strong>{dynamicImageAssetChangeLabel(version.change_type)}</strong>
                  <small><Clock3 /> {dynamicImageAssetVersionDate(version.changed_at)}</small>
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
