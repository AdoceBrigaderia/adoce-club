import { ArrowDown, ArrowUp, ImagePlus, RefreshCw, Video, Star, Trash2 } from "lucide-react";
import ClipboardImageInput from "./ClipboardImageInput";
import type { CommercialMediaItem } from "./commercial-media";
import { useState } from "react";

export default function CommercialMediaAdmin({
  title,
  items,
  busy,
  onImage,
  onReplace,
  onError,
  onAddReel,
  onMove,
  onCover,
  onRemove,
}: {
  title: string;
  items: CommercialMediaItem[];
  busy: boolean;
  onImage: (file: File) => void;
  onError: (message: string) => void;
  onAddReel: (url: string, caption: string) => Promise<boolean>;
  onReplace: (item: CommercialMediaItem, file: File) => void;
  onMove: (item: CommercialMediaItem, direction: -1 | 1) => void;
  onCover: (item: CommercialMediaItem) => void;
  onRemove: (item: CommercialMediaItem) => void;
}) {
  const reels = items.filter((item) => item.media_type === "instagram").length;
  const [reelUrl, setReelUrl] = useState("");
  const [reelCaption, setReelCaption] = useState("");
  return <section className="commercial-media-admin">
    <header><div><strong>{title}</strong><small>{items.length}/8 mídias · {reels}/2 Reels</small></div><span>A primeira mídia é a capa.</span></header>
    {items.length ? <div className="commercial-media-admin-grid">{items.map((item, index) => <article key={item.id}>
      {item.image_url ? <img src={item.image_url} alt={item.alt_text} /> : <div className="commercial-media-admin-reel"><Video /></div>}
      <span>{item.media_type === "instagram" ? "Reel do Instagram" : index === 0 ? "Foto de capa" : `Foto ${index + 1}`}</span>
      <div>
        {item.media_type === "image" ? <label title="Trocar e reenquadrar esta foto"><RefreshCw /><span className="sr-only">Trocar foto</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onReplace(item, file); event.currentTarget.value = ""; }} /></label> : null}
        <button type="button" disabled={busy || index === 0} onClick={() => onCover(item)} title="Usar como capa"><Star /></button>
        <button type="button" disabled={busy || index === 0} onClick={() => onMove(item, -1)} title="Mover para a esquerda"><ArrowUp /></button>
        <button type="button" disabled={busy || index === items.length - 1} onClick={() => onMove(item, 1)} title="Mover para a direita"><ArrowDown /></button>
        <button type="button" disabled={busy} onClick={() => onRemove(item)} title="Remover da galeria"><Trash2 /></button>
      </div>
    </article>)}</div> : <p className="commercial-media-admin-empty">Ainda não há mídia nesta galeria.</p>}
    <div className="commercial-media-admin-add">
      <label><ImagePlus /> Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || items.length >= 8} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImage(file); event.currentTarget.value = ""; }} /></label>
      <ClipboardImageInput disabled={busy || items.length >= 8} onError={onError} onImage={onImage} />
      <div className="commercial-media-admin-reel-form">
        <Video /><input value={reelUrl} onChange={(event) => setReelUrl(event.target.value)} type="url" placeholder="Cole o link do Reel do Instagram" disabled={busy || items.length >= 8 || reels >= 2} />
        <input value={reelCaption} onChange={(event) => setReelCaption(event.target.value)} placeholder="Legenda curta (opcional)" disabled={busy || items.length >= 8 || reels >= 2} />
        <button type="button" disabled={busy || items.length >= 8 || reels >= 2 || !reelUrl.trim()} onClick={() => void onAddReel(reelUrl, reelCaption).then((added) => { if (added) { setReelUrl(""); setReelCaption(""); } })}>Adicionar Reel</button>
      </div>
    </div>
  </section>;
}
