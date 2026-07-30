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
    setVersions((data || []) as unknown as GalleryMediaVersion[]);
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

  return <section className="operation-gallery-media-history">
    <button type="button" className="operation-gallery-media-history-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <History /> Histórico
    </button>
    {open ? <div className="operation-gallery-media-history-panel">
      {loading ? <p>Carregando histórico…</p> : null}
      {errorMessage ? <p className="operation-visual-history-error">{errorMessage}</p> : null}
      {!loading && !errorMessage && versions.length === 0 ? <p>Nenhuma alteração registrada.</p> : null}
      {versions.map((version) => {
        const current = galleryMediaVersionIsCurrent(version, item);
        const source = galleryMediaVersionSource(version);
        const isInstagram = version.media_type === "instagram";
        return <article key={version.id}>
          {isInstagram
            ? <div className="operation-gallery-history-reel"><Video /> Reel</div>
            : source
              ? <img src={source} alt="" />
              : <div className="operation-gallery-history-reel"><Video /> Sem prévia</div>}
          <div>
            <strong>{galleryMediaChangeLabel(version.change_type)}</strong>
            <small><Clock3 /> {galleryMediaVersionDate(version.changed_at)}</small>
            <small><UserRound /> {version.changed_by_name || "Sistema Adoce"}</small>
          </div>
          {isInstagram && source ? <a href={source || undefined} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a> : null}
          {current ? <span className="operation-visual-history-current">Atual</span> : <button type="button" disabled={Boolean(busyVersionId)} onClick={() => void restore(version)}><RotateCcw /> {busyVersionId === version.id ? "Restaurando…" : "Restaurar"}</button>}
        </article>;
      })}
    </div> : null}
  </section>;
}
