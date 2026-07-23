import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ImagePlus, Images, RotateCcw } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import ClipboardImageInput from "./ClipboardImageInput";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import { uploadEditedProductImage, type EditedProductImage } from "./admin-media";
import { requireSupabase } from "./lib/supabase";
import { SITE_VISUAL_ASSETS, type SiteVisualAssetDefinition } from "./site-visual-assets";
import "./operation-visual-settings.css";

type StoredVisualAsset = {
  asset_key: string;
  image_url: string;
  original_image_url: string | null;
  updated_at: string;
};

type PendingVisual = {
  definition: SiteVisualAssetDefinition;
  file: File;
};

export default function OperationVisualSettings({
  session,
  onOpenFlavorImages,
  onOpenProductImages,
}: {
  session: Session;
  onOpenFlavorImages?: () => void;
  onOpenProductImages?: () => void;
}) {
  const [stored, setStored] = useState<StoredVisualAsset[]>([]);
  const [pending, setPending] = useState<PendingVisual | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await requireSupabase()
      .from("site_visual_assets")
      .select("asset_key,image_url,original_image_url,updated_at")
      .order("asset_key");
    if (error) {
      setNotice(error.message);
      return;
    }
    setStored((data || []) as StoredVisualAsset[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const storedByKey = useMemo(
    () => new Map(stored.map((item) => [item.asset_key, item])),
    [stored],
  );

  const groups = useMemo(() => {
    const result = new Map<string, SiteVisualAssetDefinition[]>();
    SITE_VISUAL_ASSETS.forEach((asset) => {
      const items = result.get(asset.section) || [];
      items.push(asset);
      result.set(asset.section, items);
    });
    return [...result.entries()];
  }, []);

  const choose = (definition: SiteVisualAssetDefinition, file: File) => {
    setNotice("");
    setPending({ definition, file });
  };

  const apply = async (edited: EditedProductImage) => {
    if (!pending) return;
    const definition = pending.definition;
    setBusyKey(definition.key);
    setNotice("");
    try {
      const folderKey = definition.key.replace(/^\/+/, "").replace(/\.[^.]+$/, "");
      const uploaded = await uploadEditedProductImage(
        requireSupabase(),
        `site-visuals/${folderKey}`,
        pending.file.name,
        edited,
      );
      const { error } = await requireSupabase().from("site_visual_assets").upsert({
        asset_key: definition.key,
        label: definition.label,
        section: definition.section,
        default_url: definition.key,
        image_url: uploaded.imageUrl,
        original_image_url: uploaded.originalImageUrl,
        alt_text: definition.alt,
        active: true,
        updated_by: session.user.id,
      }, { onConflict: "asset_key" });
      if (error) throw error;
      setPending(null);
      setNotice(`${definition.label} foi substituída em todo o site.`);
      await load();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível publicar esta imagem.");
    } finally {
      setBusyKey("");
    }
  };

  const reset = async (definition: SiteVisualAssetDefinition) => {
    if (!storedByKey.has(definition.key)) return;
    setBusyKey(definition.key);
    const { error } = await requireSupabase()
      .from("site_visual_assets")
      .delete()
      .eq("asset_key", definition.key);
    setBusyKey("");
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice(`${definition.label} voltou para a imagem original do projeto.`);
    await load();
    window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
  };

  return <section className="operation-visual-settings">
    <header>
      <div>
        <small>Central de imagens</small>
        <h2>Todas as fotos do site, no lugar certo</h2>
        <p>Imagens institucionais são substituídas aqui. Sabores, produtos, categorias e carrosséis continuam com seus dados e editores próprios, acessíveis pelos atalhos abaixo.</p>
      </div>
      <Images />
    </header>

    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}

    <div className="operation-visual-shortcuts">
      <button type="button" onClick={onOpenFlavorImages}>
        <Images /><span><strong>Fotos das fatias e tortas inteiras</strong><small>Abrir disponibilidade, sabores e galerias</small></span><ArrowRight />
      </button>
      <button type="button" onClick={onOpenProductImages}>
        <Images /><span><strong>Produtos, serviços e carrosséis</strong><small>Abrir catálogo comercial e capas</small></span><ArrowRight />
      </button>
    </div>

    {groups.map(([section, assets]) => <section className="operation-visual-group" key={section}>
      <h3>{section}</h3>
      <div className="operation-visual-grid">
        {assets.map((definition) => {
          const saved = storedByKey.get(definition.key);
          const currentUrl = saved?.image_url || definition.key;
          const working = busyKey === definition.key;
          return <article key={definition.key}>
            <div className="operation-visual-preview">
              <img src={currentUrl} alt={definition.alt} />
              <span>{saved ? "Personalizada" : "Original do projeto"}</span>
            </div>
            <div className="operation-visual-copy">
              <strong>{definition.label}</strong>
              <p>{definition.description}</p>
              <small>Corte recomendado: {definition.aspectWidth}:{definition.aspectHeight}</small>
            </div>
            <div className="operation-visual-actions">
              <label className="operation-visual-file">
                <ImagePlus /> {working ? "Publicando…" : "Escolher foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={working}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) choose(definition, file);
                  }}
                />
              </label>
              <ClipboardImageInput
                disabled={working}
                onError={setNotice}
                onImage={(file) => choose(definition, file)}
              />
              {saved ? <button type="button" className="operation-visual-reset" disabled={working} onClick={() => void reset(definition)}>
                <RotateCcw /> Restaurar original
              </button> : null}
            </div>
          </article>;
        })}
      </div>
    </section>)}

    {pending ? <ImageEditor
      file={pending.file}
      title={pending.definition.label}
      preset={{
        label: pending.definition.label,
        description: `Corte ${pending.definition.aspectWidth}:${pending.definition.aspectHeight} recomendado para este espaço`,
        aspectWidth: pending.definition.aspectWidth,
        aspectHeight: pending.definition.aspectHeight,
        outputWidth: pending.definition.outputWidth,
      } satisfies ImageEditorPreset}
      onCancel={() => setPending(null)}
      onApply={apply}
    /> : null}
  </section>;
}
