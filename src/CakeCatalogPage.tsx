import { useEffect, useMemo, useState } from "react";
import { CakeSlice, MessageCircle, Search, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { isPriceOnRequest } from "./consultation-pricing";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import "./cake-catalog-page.css";

type CakeFlavor = {
  id: string;
  name: string;
  short_description: string;
  description: string;
  ingredients: string | null;
  image_path: string | null;
  whole_cake_image_path: string | null;
};

export default function CakeCatalogPage() {
  const whatsapp = useOrderWhatsAppNumber();
  const [flavors, setFlavors] = useState<CakeFlavor[]>([]);
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map());
  const [galleryPhotos, setGalleryPhotos] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CakeFlavor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Tortas · Cantinho da Adoce";
    let active = true;
    void (async () => {
      const db = requireSupabase();
      const [flavorResult, summaryResult, imageResult] = await Promise.all([
        db.from("flavors")
          .select("id,name,short_description,description,ingredients,image_path,whole_cake_image_path")
          .eq("active", true).order("name"),
        db.from("flavor_summaries").select("flavor_id,resumo"),
        db.from("flavor_images")
          .select("flavor_id,image_path").eq("active", true).order("sort_order"),
      ]);
      if (!active) return;
      if (flavorResult.error) {
        setError("Não conseguimos carregar as tortas agora. Fale com a Adoce pelo WhatsApp.");
      } else {
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
      <section className="cake-flavors" aria-labelledby="cake-flavors-title">
        <div className="cake-flavors-heading">
          <div><p className="cake-eyebrow">Tortas artesanais</p><h1 id="cake-flavors-title">Sabores disponíveis para tortas</h1></div>
          <label className="cake-search"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sabor..." aria-label="Buscar sabor" /></label>
        </div>
        <p className="cake-flavors-note">Confira os sabores das nossas tortas artesanais. A encomenda é confirmada pela Adoce conforme o tamanho, a data e a disponibilidade de produção.</p>
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
