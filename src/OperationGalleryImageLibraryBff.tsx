import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, ImagePlus, RefreshCw, Search, Trash2, Video } from "lucide-react";
import ClipboardImageInput from "./ClipboardImageInput";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import OperationGalleryMediaHistoryBff from "./OperationGalleryMediaHistoryBff";
import type { EditedProductImage } from "./admin-media";
import {
  buildGalleryOwners,
  filterGalleryOwners,
  galleryOwnerOutputHeight,
  type GalleryImageItem,
  type GalleryOwner,
  type GalleryOwnerKind,
} from "./image-library-galleries";
import {
  disableGalleryMedia,
  getGalleryMediaWorkspace,
  uploadGalleryMedia,
} from "./services/bff-gallery-media";

type PendingGalleryImage = {
  owner: GalleryOwner;
  item?: GalleryImageItem;
  file: File;
};

const galleryKindLabels: Record<GalleryOwnerKind, string> = {
  "flavor-gallery": "Sabores e fatias",
  "commercial-product-gallery": "Produtos e serviços",
  "commercial-segment-gallery": "Categorias comerciais",
};

export default function OperationGalleryImageLibraryBff({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [owners, setOwners] = useState<GalleryOwner[]>([]);
  const [pending, setPending] = useState<PendingGalleryImage | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | GalleryOwnerKind>("all");
  const [status, setStatus] = useState<
    "all" | "empty" | "with-images" | "with-reels"
  >("all");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const workspace = await getGalleryMediaWorkspace();
      setOwners(
        buildGalleryOwners({
          flavors: workspace.flavors || [],
          flavorImages: workspace.flavor_images || [],
          products: workspace.products || [],
          commercialMedia: workspace.commercial_media || [],
        }),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as galerias e carrosséis.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOwners = useMemo(
    () => filterGalleryOwners(owners, { query, kind, status }),
    [kind, owners, query, status],
  );

  const groups = useMemo(() => {
    const result = new Map<string, GalleryOwner[]>();
    filteredOwners.forEach((owner) => {
      const items = result.get(owner.section) || [];
      items.push(owner);
      result.set(owner.section, items);
    });
    return [...result.entries()];
  }, [filteredOwners]);

  const choose = (owner: GalleryOwner, file: File, item?: GalleryImageItem) => {
    setNotice("");
    setPending({ owner, item, file });
  };

  const apply = async (edited: EditedProductImage) => {
    if (!pending) return;
    const { owner, item, file } = pending;
    setBusyKey(item?.id || owner.id);
    setNotice("");

    try {
      await uploadGalleryMedia(
        {
          ownerKind: owner.kind,
          ownerId: owner.ownerId,
          mediaId: item?.id,
          label: owner.label,
          altText: item?.alt || `${owner.label} — foto da galeria`,
          caption: item?.caption || "",
          role: item?.role || "gallery",
          sortOrder: item?.sortOrder,
          sourceName: file.name,
        },
        edited,
      );

      setPending(null);
      setNotice(
        item
          ? `${owner.label}: foto substituída na galeria.`
          : `${owner.label}: nova foto adicionada à galeria.`,
      );
      await load();
      onChanged?.();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar esta galeria.",
      );
    } finally {
      setBusyKey("");
    }
  };

  const remove = async (owner: GalleryOwner, item: GalleryImageItem) => {
    if (!window.confirm(`Remover esta mídia da galeria de ${owner.label}?`)) return;
    setBusyKey(item.id);
    setNotice("");
    try {
      await disableGalleryMedia(owner.kind, owner.ownerId, item.id);
      setNotice(`${owner.label}: mídia removida da apresentação pública.`);
      await load();
      onChanged?.();
      window.dispatchEvent(new Event("adoce-site-visual-assets-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível remover esta mídia.",
      );
    } finally {
      setBusyKey("");
    }
  };

  return (
    <section className="operation-gallery-library">
      <header className="operation-dynamic-images-header">
        <div>
          <small>Galerias protegidas pelo BFF</small>
          <h3>Galerias e carrosséis</h3>
          <p>
            Fotos adicionais de sabores, produtos e categorias ficam reunidas sem
            escrita direta no banco ou acesso ao armazenamento pelo navegador.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar galerias"}
        </button>
      </header>

      <div className="operation-image-library-toolbar" role="search">
        <label className="operation-image-search">
          <Search />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar sabor, produto, categoria ou legenda"
            aria-label="Buscar imagens"
          />
        </label>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "all" | GalleryOwnerKind)}
          aria-label="Filtrar tipo de galeria"
        >
          <option value="all">Todos os tipos</option>
          {Object.entries(galleryKindLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="Filtrar situação da galeria"
        >
          <option value="all">Todas as situações</option>
          <option value="empty">Sem nenhuma mídia</option>
          <option value="with-images">Com fotos</option>
          <option value="with-reels">Com Reels</option>
        </select>
        <span>{filteredOwners.length} de {owners.length} galerias</span>
      </div>

      {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
      {loading ? (
        <p className="operation-visual-loading">Carregando galerias e carrosséis…</p>
      ) : null}
      {!loading && filteredOwners.length === 0 ? (
        <p className="operation-visual-loading">
          Nenhuma galeria corresponde aos filtros escolhidos.
        </p>
      ) : null}

      {groups.map(([section, sectionOwners]) => (
        <section className="operation-visual-group" key={section}>
          <h3>{section}</h3>
          <div className="operation-gallery-owner-grid">
            {sectionOwners.map((owner) => {
              const images = owner.items.filter((item) => item.mediaType === "image").length;
              const reels = owner.items.filter((item) => item.mediaType === "instagram").length;
              const atLimit = owner.items.length >= 8;
              return (
                <article className="operation-gallery-owner" key={owner.id}>
                  <header>
                    <div>
                      <strong>{owner.label}</strong>
                      <p>{owner.description}</p>
                    </div>
                    <span>{owner.items.length}/8 mídias · {images} fotos · {reels} Reels</span>
                  </header>

                  <div className="operation-gallery-media-grid">
                    {owner.items.map((item, index) => {
                      const working = busyKey === item.id;
                      return (
                        <article key={item.id} className="operation-gallery-media">
                          {item.mediaType === "image" && item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.alt} />
                          ) : (
                            <div className="operation-gallery-reel">
                              <Video /><span>Reel do Instagram</span>
                            </div>
                          )}
                          <small>
                            {index === 0
                              ? "Capa do carrossel"
                              : item.role === "cover"
                                ? "Foto principal"
                                : `Mídia ${index + 1}`}
                          </small>
                          {item.caption ? <p>{item.caption}</p> : null}
                          <div>
                            {item.mediaType === "image" ? (
                              <>
                                <label
                                  className="operation-gallery-icon-button"
                                  title="Trocar e reenquadrar esta foto"
                                >
                                  <ImagePlus /><span>Trocar</span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    disabled={working}
                                    onChange={(event) => {
                                      const selected = event.target.files?.[0];
                                      event.currentTarget.value = "";
                                      if (selected) choose(owner, selected, item);
                                    }}
                                  />
                                </label>
                                <ClipboardImageInput
                                  disabled={working}
                                  onError={setNotice}
                                  onImage={(file) => choose(owner, file, item)}
                                />
                              </>
                            ) : item.externalUrl ? (
                              <a href={item.externalUrl} target="_blank" rel="noreferrer">
                                <ExternalLink /> Abrir
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void remove(owner, item)}
                              disabled={working}
                              className="operation-gallery-remove"
                            >
                              <Trash2 /> Remover
                            </button>
                          </div>
                          <OperationGalleryMediaHistoryBff
                            owner={owner}
                            item={item}
                            onRestored={async (message) => {
                              setNotice(message);
                              await load();
                              onChanged?.();
                              window.dispatchEvent(
                                new Event("adoce-site-visual-assets-changed"),
                              );
                            }}
                          />
                        </article>
                      );
                    })}
                    {owner.items.length === 0 ? (
                      <p className="operation-gallery-empty">
                        Nenhuma mídia cadastrada. A primeira foto adicionada será a capa.
                      </p>
                    ) : null}
                  </div>

                  <footer>
                    <div>
                      <small>Recomendado</small>
                      <strong>
                        {owner.outputWidth} × {galleryOwnerOutputHeight(owner)} px ·{" "}
                        {owner.aspectWidth}:{owner.aspectHeight}
                      </strong>
                      <span>{owner.acceptedFormats}</span>
                    </div>
                    <div className="operation-visual-actions">
                      <label className="operation-visual-file">
                        <ImagePlus /> {atLimit ? "Limite de 8 mídias" : "Adicionar foto"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={atLimit || busyKey === owner.id}
                          onChange={(event) => {
                            const selected = event.target.files?.[0];
                            event.currentTarget.value = "";
                            if (selected) choose(owner, selected);
                          }}
                        />
                      </label>
                      <ClipboardImageInput
                        disabled={atLimit || busyKey === owner.id}
                        onError={setNotice}
                        onImage={(file) => choose(owner, file)}
                      />
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {pending ? (
        <ImageEditor
          file={pending.file}
          title={`${pending.item ? "Substituir" : "Adicionar"} — ${pending.owner.label}`}
          preset={{
            label: pending.owner.label,
            description: `Corte ${pending.owner.aspectWidth}:${pending.owner.aspectHeight} recomendado para esta galeria`,
            aspectWidth: pending.owner.aspectWidth,
            aspectHeight: pending.owner.aspectHeight,
            outputWidth: pending.owner.outputWidth,
          } satisfies ImageEditorPreset}
          onCancel={() => setPending(null)}
          onApply={apply}
        />
      ) : null}
    </section>
  );
}
