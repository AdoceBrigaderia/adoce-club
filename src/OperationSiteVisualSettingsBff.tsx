import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Images, RotateCcw } from "lucide-react";
import ClipboardImageInput from "./ClipboardImageInput";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import OperationSiteVisualAssetHistoryBff from "./OperationSiteVisualAssetHistoryBff";
import type { EditedProductImage } from "./admin-media";
import {
  getSiteVisualWorkspace,
  resetSiteVisualAsset,
  uploadSiteVisualAsset,
  type StoredSiteVisualAsset,
} from "./services/bff-site-visual";
import {
  SITE_VISUAL_ASSETS,
  siteVisualAssetFormatLabel,
  siteVisualAssetSizeLabel,
  type SiteVisualAssetDefinition,
} from "./site-visual-assets";
import "./operation-visual-settings.css";

export default function OperationSiteVisualSettingsBff() {
  const [stored, setStored] = useState<StoredSiteVisualAsset[]>([]);
  const [pending, setPending] = useState<{
    definition: SiteVisualAssetDefinition;
    file: File;
  } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const workspace = await getSiteVisualWorkspace();
      setStored(workspace.assets || []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as imagens institucionais.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    const { definition, file } = pending;
    setBusyKey(definition.key);
    setNotice("");
    try {
      await uploadSiteVisualAsset(
        {
          assetKey: definition.key,
          label: definition.label,
          section: definition.section,
          defaultUrl: definition.key,
          altText: definition.alt,
          sourceName: file.name,
        },
        edited,
      );
      setPending(null);
      setNotice(`${definition.label} foi atualizada em todo o Portal.`);
      await load();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível publicar esta imagem.",
      );
    } finally {
      setBusyKey("");
    }
  };

  const reset = async (definition: SiteVisualAssetDefinition) => {
    if (!storedByKey.has(definition.key)) return;
    setBusyKey(definition.key);
    setNotice("");
    try {
      await resetSiteVisualAsset(definition.key);
      setNotice(`${definition.label} voltou para a imagem original do projeto.`);
      await load();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível restaurar a imagem original.",
      );
    } finally {
      setBusyKey("");
    }
  };

  return (
    <section className="operation-visual-settings">
      <header>
        <div>
          <small>Central de imagens pelo BFF</small>
          <h2>Logo, capas e imagens institucionais</h2>
          <p>
            Atualize os visuais fixos do Portal sem expor sessão, token ou escrita direta
            no banco. A imagem original e a versão otimizada ficam preservadas.
          </p>
        </div>
        <Images />
      </header>

      {notice ? (
        <p className="operation-commercial-notice" role="status">{notice}</p>
      ) : null}
      {loading ? <p className="operation-visual-loading">Carregando imagens…</p> : null}

      {groups.map(([section, assets]) => (
        <section className="operation-visual-group" key={section}>
          <h3>{section}</h3>
          <div className="operation-visual-grid">
            {assets.map((definition) => {
              const saved = storedByKey.get(definition.key);
              const currentUrl = saved?.image_url || definition.key;
              const working = busyKey === definition.key;
              return (
                <article key={definition.key}>
                  <div className="operation-visual-preview">
                    <img src={currentUrl} alt={definition.alt} />
                    <span>{saved ? "Personalizada" : "Original do projeto"}</span>
                  </div>
                  <div className="operation-visual-copy">
                    <strong>{definition.label}</strong>
                    <p>{definition.description}</p>
                    <small>Uso: {definition.usage || definition.description}</small>
                    <small>
                      Recomendado: {siteVisualAssetSizeLabel(definition)} · proporção{" "}
                      {definition.aspectWidth}:{definition.aspectHeight}
                    </small>
                    <small>Formatos: {siteVisualAssetFormatLabel(definition)}</small>
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
                    {saved ? (
                      <button
                        type="button"
                        className="operation-visual-reset"
                        disabled={working}
                        onClick={() => void reset(definition)}
                      >
                        <RotateCcw /> Restaurar original
                      </button>
                    ) : null}
                  </div>
                  <OperationSiteVisualAssetHistoryBff
                    assetKey={definition.key}
                    label={definition.label}
                    currentUrl={currentUrl}
                    onRestored={async (message) => {
                      setNotice(message);
                      await load();
                      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
                    }}
                  />
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {pending ? (
        <ImageEditor
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
        />
      ) : null}
    </section>
  );
}
