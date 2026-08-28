import type { CommercialSegment } from "./commercial";
import "./public-catalog-nav.css";

export type PublicCatalogArea = "slices" | CommercialSegment;

const catalogItems: Array<{ area: PublicCatalogArea; href: string; label: string }> = [
  { area: "slices", href: "/#adoce-hoje", label: "Fatias" },
  { area: "cakes", href: "/#encomendas", label: "Tortas" },
  { area: "sweets", href: "/#docinhos", label: "Docinhos" },
  { area: "events", href: "/#eventos", label: "Eventos" },
  { area: "school", href: "/#adoce-na-escola", label: "Adoce na Escola" },
  { area: "rentals", href: "/#aluguel-decoracao", label: "Aluguel de decoração" },
];

export default function PublicCatalogNav({ active }: { active: PublicCatalogArea }) {
  return (
    <div className="public-catalog-navigation">
      <section className="public-catalog-intro" aria-labelledby="public-catalog-intro-title">
        <span>Comece por aqui</span>
        <h2 id="public-catalog-intro-title">Há um jeito Adoce para cada ocasião.</h2>
      </section>
      <nav className="public-catalog-nav" aria-label="Categorias do Catálogo Adoce">
        {catalogItems.map((item) => (
          <a
            key={item.area}
            className={active === item.area ? "active" : ""}
            href={item.href}
            aria-current={active === item.area ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
