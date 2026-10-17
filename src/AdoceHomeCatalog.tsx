// Home publica — catalogo completo de fatias primeiro, Encomendar logo abaixo.
// Mesma logica do AdoceHome.tsx (07/08/2026): a fatia vem antes da marca.
// Aqui vai alem, mostrando todos os sabores do dia, nao so os 3 primeiros.

import AdoceHoje from "./AdoceHoje";
import "./adoce-home.css";

export default function AdoceHomeCatalog() {
  return (
    <>
      <AdoceHoje compact />
      <section className="ah-secao" aria-labelledby="ah-encomendas">
        <h2 id="ah-encomendas" className="ah-titulo-menor">Encomendar</h2>
        <div className="ah-cards">
          <a className="ah-card" href="/encomendas">
            <img src="/site/card-tortas.webp" alt="" aria-hidden="true" loading="lazy" />
            <p>Tortas</p>
            <small>Sob encomenda</small>
          </a>
          <a className="ah-card" href="/docinhos">
            <img src="/site/card-docinhos.webp" alt="" aria-hidden="true" loading="lazy" />
            <p>Docinhos</p>
            <small>A partir de 50</small>
          </a>
        </div>
      </section>
    </>
  );
}
