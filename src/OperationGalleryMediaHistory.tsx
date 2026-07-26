import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, ExternalLink, History, RotateCcw, UserRound, Video } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { requireSupabase } from "./lib/supabase";
import type { GalleryImageItem, GalleryOwner } from "./image-library-galleries";
import {
  galleryMediaChangeLabel,
  galleryMediaKey,
  galleryMediaRestorePlan,
  galleryMediaVersionDate,
  galleryMediaVersionIsCurrent,
  galleryMediaVersionSource,
  type GalleryMediaVersion,
} from "./gallery-media-history";
import "./operation-visual-history.css";

type OperationGalleryMediaHistoryProps = {
  owner: GalleryOwner;
  item: GalleryImageItem;
  session: Session;
  onRestored: (message: string) => void | Promise<void>;
};

const VERSION_FIELDS = [
  "id",
  "media_key",
  "media_kind",
  "media_id",
  "owner_kind",
  "owner_id",
  "label",
  "media_type",
  "image_url",
  "original_image_url",
  "external_url",
  "alt_text",
  "caption",
  "role",
  "sort_order",
  "active",
  "change_type",
  "changed_by",
  "changed_by_name",
  "changed_at",
].join(",");

export default function OperationGalleryMediaHistory({
  owner,
  item,
  session,
  onRestored,
}: OperationGalleryMediaHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<GalleryMediaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const mediaKey = useMemo(() => galleryMediaKey(owner, item.id), [item.id, owner]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await requireSupabase()
      .from("gallery_media_versions")
      .select(VERSION_FIELDS)
      .eq("media_key", mediaKey)
      .order("changed_at", { ascending: false })
      .limit(20);
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setVersions((data || []) as GalleryMediaVersion[]);
  }, [mediaKey]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const restore = async (version: GalleryMediaVersion) => {
    if (galleryMediaVersionIsCurrent(version, item)) return;
    setBusyVersionId(version.id);
    setErrorMessage("");
    try {
      const plan = galleryMediaRestorePlan(owner, item, version, session.user.id);
      const { error } = await requireSupabase()
        .from(plan.table)
        .update(plan.values)
        .eq(plan.matchColumn, plan.matchValue);
      if (error) throw error;
      await onRestored(`${owner.label}: mídia restaurada para a versão de ${galleryMediaVersionDate(version.changed_at)}.`);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível restaurar esta mídia.");
    } finally {
      setBusyVersionId("");
    }
  };

  return <section className="operation-visual-history operation-gallery-media-history">
    <button
      type="button"
      className="operation-visual-history-toggle"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
    >
      <History />
      <span><strong>Histórico da mídia</strong><small>Alterações, remoções e versões anteriores</small></span>
      <span>{open ? "Fechar" : "Abrir"}</span>
    </button>

    {open ? <div className="operation-visual-history-panel">
      {loading ? <p className="operation-visual-loading">Carregando histórico…</p> : null}
      {errorMessage ? <p className="operation-commercial-notice" role="alert">{errorMessage}</p> : null}
      {!loading && !errorMessage && versions.length === 0
        ? <p className="operation-visual-history-empty">Esta mídia ainda não possui alterações registradas.</p>
        : null}
      {!loading && versions.length > 0 ? <div className="operation-visual-history-list">
        {versions.map((version) => {
          const isCurrent = galleryMediaVersionIsCurrent(version, item);
          const working = busyVersionId === version.id;
          const source = galleryMediaVersionSource(version);
          return <article key={version.id} className="operation-visual-history-version">
            {version.media_type === "image" && source
              ? <img src={source} alt={`Versão anterior de ${owner.label}`} />
              : <div className="operation-visual-history-reel"><Video /><span>Reel</span></div>}
            <div>
              <strong>{galleryMediaChangeLabel(version.change_type)}</strong>
              <span><Clock3 /> {galleryMediaVersionDate(version.changed_at)}</span>
              <span><UserRound /> {version.changed_by_name || "Usuário não identificado"}</span>
              {version.media_type === "instagram" && source
                ? <a href={source} target="_blank" rel="noreferrer"><ExternalLink /> Abrir Reel</a>
                : null}
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
