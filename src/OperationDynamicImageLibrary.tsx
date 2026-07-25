import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ImagePlus, RefreshCw } from "lucide-react";
import ClipboardImageInput from "./ClipboardImageInput";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import { uploadEditedProductImage, type EditedProductImage } from "./admin-media";
import {
  buildDynamicImageAssets,
  dynamicImageOutputHeight,
  type CommercialProductImageRow,
  type CommercialSegmentImageRow,
  type DynamicImageAsset,
  type FlavorImageRow,
} from "./image-library-dynamic";
import { requireSupabase } from "./lib/supabase";

export default function OperationDynamicImageLibrary({
  session,
  onChanged,
}: {
  session: Session;
  onChanged?: () => void;
}) {
  const [assets, setAssets] = useState<DynamicImageAsset[]>([]);
  const [pending, setPending] = useState<{ asset: DynamicImageAsset; file: File } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = requireSupabase();
    const [flavorsResult, productsResult, segmentsResult] = await Promise.all([
      supabase
        .from("flavors")
        .select("id,name,image_path,whole_cake_image_path,whole_cake_original_image_path,whole_cake_available,active")
        .order("name"),
      supabase
        .from("commercial_products")
        .select("id,name,segment,image_url,original_image_url,active")
        .order("name"),
      supabase
        .from("commercial_segment_media")
        .select("segment,image_url,original_image_url")
        .order("segment"),
    ]);

    const error = flavorsResult.error || productsResult.error || segmentsResult.error;
    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }

    setAssets(buildDynamicImageAssets({
      flavors: (flavorsResult.data || []) as FlavorImageRow[],
      products: (productsResult.data || []) as CommercialProductImageRow[],
      segments: (segmentsResult.data || []) as CommercialSegmentImageRow[],
    }));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const result = new Map<string, DynamicImageAsset[]>();
    assets.forEach((asset) => {
      const items = result.get(asset.section) || [];
      items.push(asset);
      result.set(asset.section, items);
    });
    return [...result.entries()];
  }, [assets]);

  const apply = async (edited: EditedProductImage) => {
    if (!pending) return;
    const { asset, file } = pending;
    setBusyKey(asset.id);
    setNotice("");

    try {
      const supabase = requireSupabase();
      const uploaded = await uploadEditedProductImage(
        supabase,
        asset.storageFolder,
        file.name,
        edited,
      );

      if (asset.kind === "flavor-cover") {
        const { error } = await supabase
          .from("flavors")
          .update({ image_path: uploaded.imageUrl })
          .eq("id", asset.ownerId);
        if (error) throw error;
      }

      if (asset.kind === "whole-cake") {
        const { error } = await supabase
          .from("flavors")
          .update({
            whole_cake_image_path: uploaded.imageUrl,
            whole_cake_original_image_path: uploaded.originalImageUrl,
          })
          .eq("id", asset.ownerId);
        if (error) throw error;
      }

      if (asset.kind === "commercial-product") {
        const { error } = await supabase
          .from("commercial_products")
          .update({
            image_url: uploaded.imageUrl,
            original_image_url: uploaded.originalImageUrl,
            updated_by: session.user.id,
          })
          .eq("id", asset.ownerId);
        if (error) throw error;
      }

      if (asset.kind === "commercial-segment") {
        const { error } = await supabase
          .from("commercial_segment_media")
          .upsert({
            segment: asset.ownerId,
            image_url: uploaded.imageUrl,
            original_image_url: uploaded.originalImageUrl,
            alt_text: asset.alt,
            updated_by: session.user.id,
          }, { onConflict: "segment" });
        if (error) throw error;
      }

      setPending(null);
      setNotice(`${asset.label} foi substituída na biblioteca central.`);
      await load();
      onChanged?.();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível substituir esta imagem.";
      setNotice(message);
      throw new Error(message);
    } finally {
      setBusyKey("");
    }
  };

  return <section className="operation-dynamic-images">
    <header className="operation-dynamic-images-header">
      <div>
        <h3>Produtos, sabores, tortas e categorias</h3>
        <p>As capas principais agora podem ser substituídas aqui, sem procurar em outras telas. Galerias com várias fotos continuam nos atalhos acima.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading}>
        <RefreshCw /> {loading ? "Atualizando…" : "Atualizar lista"}
      </button>
    </header>

    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
    {loading ? <p className="operation-visual-loading">Carregando imagens de produtos e sabores…</p> : null}
    {!loading && assets.length === 0
      ? <p className="operation-visual-loading">Nenhum produto ou sabor ativo foi encontrado.</p>
      : null}

    {groups.map(([section, items]) => <section className="operation-visual-group" key={section}>
      <h3>{section}</h3>
      <div className="operation-visual-grid">
        {items.map((asset) => {
          const working = busyKey === asset.id;
          const placeholder = asset.currentUrl.includes("/placeholder-");
          return <article key={asset.id}>
            <div className="operation-visual-preview">
              <img src={asset.currentUrl} alt={asset.alt} />
              <span>{placeholder ? "Aguardando foto oficial" : "Foto cadastrada"}</span>
            </div>
            <div className="operation-visual-copy">
              <strong>{asset.label}</strong>
              <p>{asset.description}</p>
              <small>Uso: {asset.usage}</small>
              <small>Recomendado: {asset.outputWidth} × {dynamicImageOutputHeight(asset)} px · proporção {asset.aspectWidth}:{asset.aspectHeight}</small>
              <small>Formatos: {asset.acceptedFormats}</small>
            </div>
            <div className="operation-visual-actions">
              <label className="operation-visual-file">
                <ImagePlus /> {working ? "Publicando…" : "Escolher foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={working}
                  onChange={(event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => {
                    const selected = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (selected) setPending({ asset, file: selected });
                  }}
                />
              </label>
              <ClipboardImageInput
                disabled={working}
                onError={setNotice}
                onImage={(file: File) => setPending({ asset, file })}
              />
            </div>
          </article>;
        })}
      </div>
    </section>)}

    {pending ? <ImageEditor
      file={pending.file}
      title={pending.asset.label}
      preset={{
        label: pending.asset.label,
        description: `Corte ${pending.asset.aspectWidth}:${pending.asset.aspectHeight} recomendado para este espaço`,
        aspectWidth: pending.asset.aspectWidth,
        aspectHeight: pending.asset.aspectHeight,
        outputWidth: pending.asset.outputWidth,
      } satisfies ImageEditorPreset}
      onCancel={() => setPending(null)}
      onApply={apply}
    /> : null}
  </section>;
}
