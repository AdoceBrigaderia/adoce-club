import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, ExternalLink, History, RotateCcw, UserRound, Video } from "lucide-react";
import type { GalleryImageItem, GalleryOwner } from "./image-library-galleries";
import {
  galleryMediaChangeLabel,
  galleryMediaKey,
  galleryMediaVersionDate,
  galleryMediaVersionIsCurrent,
  galleryMediaVersionSource,
  type GalleryMediaVersion,
} from "./gallery-media-history";
import {
  listGalleryMediaVersions,
  restoreGalleryMediaVersion,
} from "./services/bff-gallery-media";
import "./operation-visual-history.css";

type OperationGalleryMediaHistoryBffProps = {
  owner: GalleryOwner;
  item: GalleryImageItem;
  onRestored: (message: string) => void | Promise<void>;
};

export default function OperationGalleryMediaHistoryBff({
  owner,
  item,
  onRestored,
}: OperationGalleryMediaHistoryBffProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<GalleryMediaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const mediaKey = useMemo(() => galleryMediaKey(owner, item.id), [item.id, owner]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setVersions(await listGalleryMediaVersions(mediaKey, 20));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível carregar o histórico.",
      );
    } finally {
      setLoading(false);
    }
  }, [mediaKey]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const restore = async (version: GalleryMediaVersion) => {
    if (galleryMediaVersionIsCurrent(version, item)) return;
    setBusyVersionId(version.id);
    setErrorMessage("");
    try {
      if (
        version.media_id !== item.id
        || version.owner_kind !== owner.kind
        || version.owner_id !== owner.ownerId
      ) {
        throw new Error("A versão selecionada não pertence a esta mídia.");
      }
      await restoreGalleryMediaVersion(version.id);
      await onRestored(
        `${owner.label}: mídia restaurada para a versão de ${galleryMediaVersionDate(version.changed_at)}.`,
      );
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível restaurar esta mídia.",
      );
    } finally {
      setBusyVersionId("");
    }
  };

  return (
    <section className="operation-gallery-media-history">
      <button
        type="button"
        className="operation-gallery-media-history-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <History /> Histórico
      </button>
      {open ? (
        <div className="operation-gallery-media-history-panel">
          {loading ? <p>Carregando histórico…</p> : null}
          {errorMessage ? (
            <p className="operation-visual-history-error">{errorMessage}</p>
          ) : null}
          {!loading && !errorMessage && versions.length === 0 ? (
            <p>Nenhuma alteração registrada.</p>
          ) : null}
          {versions.map((version) => {
            const current = galleryMediaVersionIsCurrent(version, item);
            const source = galleryMediaVersionSource(version);
            const isInstagram = version.media_type === "instagram";
            return (
              <article key={version.id}>
                {isInstagram ? (
                  <div className="operation-gallery-history-reel"><Video /> Reel</div>
                ) : source ? (
                  <img src={source} alt="" />
                ) : (
                  <div className="operation-gallery-history-reel"><Video /> Sem prévia</div>
                )}
                <div>
                  <strong>{galleryMediaChangeLabel(version.change_type)}</strong>
                  <small><Clock3 /> {galleryMediaVersionDate(version.changed_at)}</small>
                  <small><UserRound /> {version.changed_by_name || "Sistema Adoce"}</small>
                </div>
                {isInstagram && source ? (
                  <a href={source} target="_blank" rel="noreferrer">
                    <ExternalLink /> Abrir
                  </a>
                ) : null}
                {current ? (
                  <span className="operation-visual-history-current">Atual</span>
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
