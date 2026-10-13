import { useEffect, useMemo, useState } from "react";
import { CakeSlice, MessageCircle, Search, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { isPriceOnRequest } from "./consultation-pricing";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import PublicCatalogNav from "./PublicCatalogNav";
import "./cake-catalog-page.css";

type CakeSize = {
  id: string;
  name: string;
  base_price: number;
  short_description: string;
  sort_order: number;
};

type CakeFlavor = {
  id: string;
  name: string;
  short_description: string;
  description: string;
  ingredients: string | null;
  image_path: string | null;
  whole_cake_image_path: string | null;
};

const money = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(value);

export default function CakeCatalogPage() {
  const whatsapp = useOrderWhatsAppNumber();
  const [sizes, setSizes] = useState<CakeSize[]>([]);
  const [flavors, setFlavors] = useState<CakeFlavor[]>([]);
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map());
  const [galleryPhotos, setGalleryPhotos] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CakeFlavor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Tortas · Adoce Brigaderia";
    let active = true;
    void (async () => {
      const db = requireSupabase();
      const [sizeResult, flavorResult, summaryResult, imageResult] = await Promise.all([
        db.from("commercial_products")
          .select("id,name,base_price,short_description,sort_order")
          .eq("segment", "cakes").eq("active", true).eq("published", true)
          .order("sort_order"),
        db.from("flavors")
          .select("id,name,short_description,description,ingredients,image_path,whole_cake_image_path")
          .eq("active", true).order("name"),
        db.from("flavor_summaries").select("flavor_id,resumo"),
        db.from("flavor_images")
          .select("flavor_id,image_path").eq("active", true).order("sort_order"),
      ]);
      if (!active) return;
      if (sizeResult.error || flavorResult.error) {
        setError("Não conseguimos carregar as tortas agora. Fale com a Adoce pelo WhatsApp.");
      } else {
        setSizes((sizeResult.data || []) as CakeSize[]);
        setFlavors((flavorResult.data || []) as CakeFlavor[]);
        if (!summaryResult.error) setSummaries(new Map((summaryResult.data || []).map((row) => [row.flavor_id, row.resumo])));
        if (!imageResult.error) {
          const photos = new Map<string, string>();
          for (const photo of imageResult.data || []) if (!photos.has(photo.flavor_id)) photos.set(photo.flavor_id, photo.image_path);
          setGalleryPhotos(photos);
        }
      }
      setLoading(false);
    })().catch(() => {
      if (active) { setError("Não conseguimos carregar as tortas agora. Fale com a Adoce pelo WhatsApp."); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const photoFor = (flavor: CakeFlavor) => flavor.whole_cake_image_path || flavor.image_path || galleryPhotos.get(flavor.id) || null;
  const shown = useMemo(() => flavors.filter((flavor) =>
    `${flavor.name} ${flavor.short_description}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  ), [flavors, search]);
  const contact = (message: string) => orderWhatsAppUrl(whatsapp, message);

  return (
    <main className="cake-catalog">
      <PublicCatalogNav active="cakes" />
      <header className="cake-catalog-intro">
        <p className="cake-eyebrow">Catálogo Adoce</p>
        <h1>Tortas</h1>
        <p>Tortas inteiras somente por encomenda. Escolha o tamanho e conheça os sabores feitos pelas mãos da Beth. A Adoce confirma o sabor, o valor e a data antes de preparar.</p>
        <a className="cake-whatsapp" href={contact("Olá, Adoce! Vim pelo site e gostaria de conversar sobre uma torta.")} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden="true" /> Converse com a Adoce no WhatsApp
        </a>
      </header>

      <section className="cake-sizes" aria-labelledby="cake-sizes-title">
        <p className="cake-eyebrow">Escolha o tamanho</p>
        <h2 id="cake-sizes-title">Tamanhos e valores</h2>
        {loading ? <p>Carregando tamanhos…</p> : sizes.length ? (
          <div className="cake-size-grid">
            {sizes.map((size) => (
              <article key={size.id}>
                <span>{size.name}</span>
                <strong>{money(Number(size.base_price))}</strong>
                <p>{size.short_description}</p>
                <a href={contact(`Olá, Adoce! Quero saber sobre a ${size.name}.`)} target="_blank" rel="noreferrer">Consultar este tamanho</a>
              </article>
            ))}
          </div>
        ) : <p>Consulte os tamanhos com a Adoce.</p>}
        <p className="cake-flavors-note">Os valores acima valem para os sabores regulares. Para a Torta de Pudim, fatia e tamanhos P, M e G têm valor a consultar.</p>
        <a className="cake-request-link" href="/encomendas/solicitar">Prefere registrar pelo site? Solicite uma pré-reserva</a>
      </section>

      <section className="cake-flavors" aria-labelledby="cake-flavors-title">
        <div className="cake-flavors-heading">
          <div><p className="cake-eyebrow">Feitos para celebrar</p><h2 id="cake-flavors-title">Sabores</h2></div>
          <label className="cake-search"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sabor..." aria-label="Buscar sabor" /></label>
        </div>
        <p className="cake-flavors-note">As fotos de torta inteira aparecem quando cadastradas. Todos os sabores são apresentados para consulta; tortas inteiras são feitas somente por encomenda, após confirmação da Adoce.</p>
        {error ? <p className="cake-error" role="alert">{error}</p> : null}
        {loading ? <p>Carregando sabores…</p> : shown.length ? (
          <div className="cake-flavor-grid">
            {shown.map((flavor) => {
              const photo = photoFor(flavor);
              return <article key={flavor.id}>
                <button className="cake-flavor-image" type="button" onClick={() => setSelected(flavor)} aria-label={`Conhecer o sabor ${flavor.name}`}>
                  {photo ? <img src={photo} alt={flavor.whole_cake_image_path ? `Torta inteira de ${flavor.name}` : `Foto do sabor ${flavor.name}`} loading="lazy" /> : <span><CakeSlice aria-hidden="true" /> Foto em breve</span>}
                </button>
                <div className="cake-flavor-copy">
                  <h3>{flavor.name}</h3>
                  <p>{summaries.get(flavor.id) || flavor.short_description || "Conheça este sabor artesanal."}</p>
                  <button type="button" onClick={() => setSelected(flavor)}>Conhecer o sabor</button>
                </div>
              </article>;
            })}
          </div>
        ) : !error ? <p>Nenhum sabor encontrado. Tente outro nome.</p> : null}
      </section>

      {selected ? <div className="cake-detail-backdrop" role="presentation" onClick={() => setSelected(null)}>
        <section className="cake-detail" role="dialog" aria-modal="true" aria-label={`Sabor ${selected.name}`} onClick={(event) => event.stopPropagation()}>
          <button className="cake-detail-close" type="button" aria-label="Fechar detalhes do sabor" onClick={() => setSelected(null)}><X aria-hidden="true" /></button>
          {photoFor(selected) ? <img src={photoFor(selected)!} alt={selected.whole_cake_image_path ? `Torta inteira de ${selected.name}` : `Foto do sabor ${selected.name}`} /> : null}
          <div>
            <p className="cake-eyebrow">Conheça o sabor</p>
            <h2>{selected.name}</h2>
            <p>{summaries.get(selected.id) || selected.short_description}</p>
            {selected.description ? <p>{selected.description}</p> : null}
            {selected.ingredients ? <p><strong>Ingredientes:</strong> {selected.ingredients}</p> : null}
            <p>{isPriceOnRequest(selected.name) ? "Valor a consultar para a fatia e para as tortas P, M e G. Confirme o valor e a data com a Adoce." : "Esta torta é feita somente por encomenda. Consulte os tamanhos e confirme o sabor e a data com a Adoce."}</p>
            <a className="cake-whatsapp" href={contact(`Olá, Adoce! Quero conversar sobre uma torta sabor ${selected.name}.`)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> Conversar no WhatsApp</a>
          </div>
        </section>
      </div> : null}
    </main>
  );
}
