import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ExternalLink, ImagePlus, RefreshCw, Search, Trash2, Video } from "lucide-react";
import ClipboardImageInput from "./ClipboardImageInput";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import OperationGalleryMediaHistory from "./OperationGalleryMediaHistory";
import { uploadEditedProductImage, type EditedProductImage } from "./admin-media";
import {
  buildGalleryOwners,
  filterGalleryOwners,
  galleryOwnerOutputHeight,
  type CommercialGalleryMediaRow,
  type CommercialGalleryProductRow,
  type FlavorGalleryImageRow,
  type FlavorGalleryOwnerRow,
  type GalleryImageItem,
  type GalleryOwner,
  type GalleryOwnerKind,
} from "./image-library-galleries";
import { requireSupabase } from "./lib/supabase";

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

export default function OperationGalleryImageLibrary({
  session,
  onChanged,
}: {
  session: Session;
  onChanged?: () => void;
}) {
  const [owners, setOwners] = useState<GalleryOwner[]>([]);
  const [pending, setPending] = useState<PendingGalleryImage | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | GalleryOwnerKind>("all");
  const [status, setStatus] = useState<"all" | "empty" | "with-images" | "with-reels">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = requireSupabase();
    const [flavorsResult, flavorImagesResult, productsResult, mediaResult] = await Promise.all([
      supabase.from("flavors").select("id,name,active").order("name"),
      supabase
        .from("flavor_images")
        .select("id,flavor_id,image_path,original_image_path,alt_text,caption,image_role,sort_order,active")
        .order("sort_order"),
      supabase.from("commercial_products").select("id,name,segment,active").order("name"),
      supabase
        .from("commercial_media_items")
        .select("id,segment,product_id,media_type,image_url,original_image_url,external_url,alt_text,caption,sort_order,active")
        .order("sort_order"),
    ]);

    const error = flavorsResult.error
      || flavorImagesResult.error
      || productsResult.error
      || mediaResult.error;

    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }

    setOwners(buildGalleryOwners({
      flavors: (flavorsResult.data || []) as FlavorGalleryOwnerRow[],
      flavorImages: (flavorImagesResult.data || []) as FlavorGalleryImageRow[],
      products: (productsResult.data || []) as CommercialGalleryProductRow[],
      commercialMedia: (mediaResult.data || []) as CommercialGalleryMediaRow[],
    }));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      const supabase = requireSupabase();
      const uploaded = await uploadEditedProductImage(
        supabase,
        owner.storageFolder,
        file.name,
        edited,
      );

      if (owner.kind === "flavor-gallery") {
        const payload = {
          flavor_id: owner.ownerId,
          image_path: uploaded.imageUrl,
          original_image_path: uploaded.originalImageUrl,
          alt_text: item?.alt || `${owner.label} — foto da galeria`,
          caption: item?.caption || "",
          image_role: item?.role || "gallery",
          sort_order: item?.sortOrder ?? owner.items.length,
          active: true,
        };

        const queryResult = item
          ? supabase.from("flavor_images").update(payload).eq("id", item.id)
          : supabase.from("flavor_images").insert(payload);
        const { error } = await queryResult;
        if (error) throw error;
      } else {
        const payload = {
          segment: owner.kind === "commercial-segment-gallery" ? owner.ownerId : null,
          product_id: owner.kind === "commercial-product-gallery" ? owner.ownerId : null,
          media_type: "image",
          image_url: uploaded.imageUrl,
          original_image_url: uploaded.originalImageUrl,
          external_url: null,
          alt_text: item?.alt || `${owner.label} — foto da galeria`,
          caption: item?.caption || "",
          sort_order: item?.sortOrder
            ?? (owner.items.length ? Math.max(...owner.items.map((entry) => entry.sortOrder)) + 10 : 10),
          active: true,
          updated_by: session.user.id,
        };

        const queryResult = item
          ? supabase.from("commercial_media_items").update(payload).eq("id", item.id)
          : supabase.from("commercial_media_items").insert({
              ...payload,
              created_by: session.user.id,
            });
        const { error } = await queryResult;
        if (error) throw error;
      }

      setPending(null);
      setNotice(item
        ? `${owner.label}: foto substituída na galeria.`
        : `${owner.label}: nova foto adicionada à galeria.`);
      await load();
      onChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar esta galeria.";
      setNotice(message);
      throw new Error(message);
    } finally {
      setBusyKey("");
    }
  };

  const remove = async (owner: GalleryOwner, item: GalleryImageItem) => {
    if (!window.confirm(`Remover esta mídia da galeria de ${owner.label}?`)) return;
    setBusyKey(item.id);
    const table = owner.kind === "flavor-gallery" ? "flavor_images" : "commercial_media_items";
    const payload = owner.kind === "flavor-gallery"
      ? { active: false }
      : { active: false, updated_by: session.user.id };
    const { error } = await requireSupabase().from(table).update(payload).eq("id", item.id);
    setBusyKey("");
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice(`${owner.label}: mídia removida da apresentação pública.`);
    await load();
    onChanged?.();
  };

  return <section className="operation-gallery-library">
    <header className="operation-dynamic-images-header">
      <div>
        <h3>Galerias e carrosséis</h3>
        <p>Todas as fotos adicionais de sabores, produtos e categorias ficam reunidas aqui. Pesquise, filtre, substitua, cole ou acrescente uma foto sem sair desta tela.</p>
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
          onChange={(event: { target: HTMLInputElement }) => setQuery(event.target.value)}
          placeholder="Buscar sabor, produto, categoria ou legenda"
          aria-label="Buscar imagens"
        />
      </label>
      <select value={kind} onChange={(event: { target: HTMLSelectElement }) => setKind(event.target.value as "all" | GalleryOwnerKind)} aria-label="Filtrar tipo de galeria">
        <option value="all">Todos os tipos</option>
        {Object.entries(galleryKindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <select value={status} onChange={(event: { target: HTMLSelectElement }) => setStatus(event.target.value as typeof status)} aria-label="Filtrar situação da galeria">
        <option value="all">Todas as situações</option>
        <option value="empty">Sem nenhuma mídia</option>
        <option value="with-images">Com fotos</option>
        <option value="with-reels">Com Reels</option>
      </select>
      <span>{filteredOwners.length} de {owners.length} galerias</span>
    </div>

    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
    {loading ? <p className="operation-visual-loading">Carregando galerias e carrosséis…</p> : null}
    {!loading && filteredOwners.length === 0
      ? <p className="operation-visual-loading">Nenhuma galeria corresponde aos filtros escolhidos.</p>
      : null}

    {groups.map(([section, sectionOwners]) => <section className="operation-visual-group" key={section}>
      <h3>{section}</h3>
      <div className="operation-gallery-owner-grid">
        {sectionOwners.map((owner) => {
          const images = owner.items.filter((item) => item.mediaType === "image").length;
          const reels = owner.items.filter((item) => item.mediaType === "instagram").length;
          const atLimit = owner.items.length >= 8;
          return <article className="operation-gallery-owner" key={owner.id}>
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
                return <article key={item.id} className="operation-gallery-media">
                  {item.mediaType === "image" && item.imageUrl
                    ? <img src={item.imageUrl} alt={item.alt} />
                    : <div className="operation-gallery-reel"><Video /><span>Reel do Instagram</span></div>}
                  <small>{index === 0 ? "Capa do carrossel" : item.role === "cover" ? "Foto principal" : `Mídia ${index + 1}`}</small>
                  {item.caption ? <p>{item.caption}</p> : null}
                  <div>
                    {item.mediaType === "image" ? <>
                      <label className="operation-gallery-icon-button" title="Trocar e reenquadrar esta foto">
                        <ImagePlus /><span>Trocar</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={working}
                          onChange={(event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => {
                            const selected = event.target.files?.[0];
                            event.currentTarget.value = "";
                            if (selected) choose(owner, selected, item);
                          }}
                        />
                      </label>
                      <ClipboardImageInput
                        disabled={working}
                        onError={setNotice}
                        onImage={(file: File) => choose(owner, file, item)}
                      />
                    </> : item.externalUrl ? <a href={item.externalUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a> : null}
                    <button type="button" onClick={() => void remove(owner, item)} disabled={working} className="operation-gallery-remove">
                      <Trash2 /> Remover
                    </button>
                  </div>
                  <OperationGalleryMediaHistory
                    owner={owner}
                    item={item}
                    session={session}
                    onRestored={async (message) => {
                      setNotice(message);
                      await load();
                      onChanged?.();
                    }}
                  />
                </article>;
              })}
              {owner.items.length === 0 ? <p className="operation-gallery-empty">Nenhuma mídia cadastrada. A primeira foto adicionada será a capa.</p> : null}
            </div>

            <footer>
              <div>
                <small>Recomendado</small>
                <strong>{owner.outputWidth} × {galleryOwnerOutputHeight(owner)} px · {owner.aspectWidth}:{owner.aspectHeight}</strong>
                <span>{owner.acceptedFormats}</span>
              </div>
              <div className="operation-visual-actions">
                <label className="operation-visual-file">
                  <ImagePlus /> {atLimit ? "Limite de 8 mídias" : "Adicionar foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={atLimit || busyKey === owner.id}
                    onChange={(event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => {
                      const selected = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (selected) choose(owner, selected);
                    }}
                  />
                </label>
                <ClipboardImageInput
                  disabled={atLimit || busyKey === owner.id}
                  onError={setNotice}
                  onImage={(file: File) => choose(owner, file)}
                />
              </div>
            </footer>
          </article>;
        })}
      </div>
    </section>)}

    {pending ? <ImageEditor
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
    /> : null}
  </section>;
}
