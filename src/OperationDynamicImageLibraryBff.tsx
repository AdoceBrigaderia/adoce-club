import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, RefreshCw, Search } from "lucide-react";
import ClipboardImageInput from "./ClipboardImageInput";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import OperationDynamicImageAssetHistoryBff from "./OperationDynamicImageAssetHistoryBff";
import type { EditedProductImage } from "./admin-media";
import {
  buildDynamicImageAssets,
  dynamicImageOutputHeight,
  type DynamicImageAsset,
} from "./image-library-dynamic";
import {
  getDynamicImageWorkspace,
  uploadDynamicImageAsset,
} from "./services/bff-dynamic-images";

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export default function OperationDynamicImageLibraryBff({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [assets, setAssets] = useState<DynamicImageAsset[]>([]);
  const [pending, setPending] = useState<{
    asset: DynamicImageAsset;
    file: File;
  } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState<"all" | "placeholder" | "official">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const workspace = await getDynamicImageWorkspace();
      setAssets(buildDynamicImageAssets({
        flavors: workspace.flavors || [],
        products: workspace.products || [],
        segments: workspace.segments || [],
      }));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as capas de produtos e sabores.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () => [...new Set(assets.map((asset) => asset.section))],
    [assets],
  );

  const filteredAssets = useMemo(() => {
    const text = normalized(query);
    return assets.filter((asset) => {
      const placeholder = asset.currentUrl.includes("/placeholder-");
      if (section !== "all" && asset.section !== section) return false;
      if (status === "placeholder" && !placeholder) return false;
      if (status === "official" && placeholder) return false;
      if (!text) return true;
      return normalized(
        `${asset.label} ${asset.section} ${asset.description} ${asset.usage}`,
      ).includes(text);
    });
  }, [assets, query, section, status]);

  const groups = useMemo(() => {
    const result = new Map<string, DynamicImageAsset[]>();
    filteredAssets.forEach((asset) => {
      const items = result.get(asset.section) || [];
      items.push(asset);
      result.set(asset.section, items);
    });
    return [...result.entries()];
  }, [filteredAssets]);

  const apply = async (edited: EditedProductImage) => {
    if (!pending) return;
    const { asset, file } = pending;
    setBusyKey(asset.id);
    setNotice("");

    try {
      await uploadDynamicImageAsset(
        {
          kind: asset.kind,
          ownerId: asset.ownerId,
          label: asset.label,
          altText: asset.alt,
          sourceName: file.name,
        },
        edited,
      );
      setPending(null);
      setNotice(`${asset.label} foi atualizada na biblioteca central.`);
      await load();
      onChanged?.();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível substituir esta imagem.",
      );
    } finally {
      setBusyKey("");
    }
  };

  return (
    <section className="operation-dynamic-images">
      <header className="operation-dynamic-images-header">
        <div>
          <small>Capas protegidas pelo BFF</small>
          <h3>Produtos, sabores, tortas e categorias</h3>
          <p>
            Localize e substitua as capas principais sem expor token, escrita direta no
            banco ou acesso ao armazenamento no navegador.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar lista"}
        </button>
      </header>

      <div className="operation-image-library-toolbar" role="search">
        <label className="operation-image-search">
          <Search />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar produto, sabor, torta ou categoria"
            aria-label="Buscar capas"
          />
        </label>
        <select
          value={section}
          onChange={(event) => setSection(event.target.value)}
          aria-label="Filtrar seção"
        >
          <option value="all">Todas as seções</option>
          {sections.map((item) => (
            <option value={item} key={item}>{item}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="Filtrar situação da foto"
        >
          <option value="all">Todas as fotos</option>
          <option value="placeholder">Aguardando foto oficial</option>
          <option value="official">Com foto cadastrada</option>
        </select>
        <span>{filteredAssets.length} de {assets.length} imagens</span>
      </div>

      {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
      {loading ? (
        <p className="operation-visual-loading">Carregando imagens de produtos e sabores…</p>
      ) : null}
      {!loading && filteredAssets.length === 0 ? (
        <p className="operation-visual-loading">
          Nenhuma imagem corresponde aos filtros escolhidos.
        </p>
      ) : null}

      {groups.map(([groupSection, items]) => (
        <section className="operation-visual-group" key={groupSection}>
          <h3>{groupSection}</h3>
          <div className="operation-visual-grid">
            {items.map((asset) => {
              const working = busyKey === asset.id;
              const placeholder = asset.currentUrl.includes("/placeholder-");
              return (
                <article key={asset.id}>
                  <div className="operation-visual-preview">
                    <img src={asset.currentUrl} alt={asset.alt} />
                    <span>{placeholder ? "Aguardando foto oficial" : "Foto cadastrada"}</span>
                  </div>
                  <div className="operation-visual-copy">
                    <strong>{asset.label}</strong>
                    <p>{asset.description}</p>
                    <small>Uso: {asset.usage}</small>
                    <small>
                      Recomendado: {asset.outputWidth} × {dynamicImageOutputHeight(asset)} px ·
                      proporção {asset.aspectWidth}:{asset.aspectHeight}
                    </small>
                    <small>Formatos: {asset.acceptedFormats}</small>
                  </div>
                  <div className="operation-visual-actions">
                    <label className="operation-visual-file">
                      <ImagePlus /> {working ? "Publicando…" : "Escolher foto"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={working}
                        onChange={(event) => {
                          const selected = event.target.files?.[0];
                          event.currentTarget.value = "";
                          if (selected) setPending({ asset, file: selected });
                        }}
                      />
                    </label>
                    <ClipboardImageInput
                      disabled={working}
                      onError={setNotice}
                      onImage={(file) => setPending({ asset, file })}
                    />
                  </div>
                  <OperationDynamicImageAssetHistoryBff
                    asset={asset}
                    onRestored={async (message) => {
                      setNotice(message);
                      await load();
                      onChanged?.();
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
        />
      ) : null}
    </section>
  );
}
