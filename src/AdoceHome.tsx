// Home da Adoce — versao aprovada pelo Rubens em 07/08/2026.
//
// A home anterior abria com hero institucional e a fatia so aparecia depois de
// rolar. Os numeros diziam o contrario: 305 visitas na vitrine, 5 pedidos, e 80
// cliques no WhatsApp. As pessoas usavam o site como cardapio e compravam fora.
//
// Aqui a fatia vem antes da marca. A regra de retirada vem na primeira linha.
// Festas, escola e decoracao saem da navegacao e viram uma linha discreta.

import { useEffect, useState } from "react";
import { ChevronRight, Heart, Search, ShoppingBag, Store, User } from "lucide-react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import { useConnectedClubSummary } from "./ConnectedClubSummary";
import {
  pickupWindowForDay,
  pickupWindowHint,
  type PickupHour,
  type PickupWindow,
} from "./pickup-window";
import "./adoce-home.css";

type Sabor = {
  id: string;
  nome: string;
  preco: number;
  imagem: string;
  restam: number | null;
  premium: boolean;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function hojeFortaleza() {
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const dia = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza", weekday: "short",
  }).format(new Date());
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { data, weekday: mapa[dia] ?? 0 };
}

function dataPorExtenso() {
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza", weekday: "long", day: "numeric", month: "long",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AdoceHome() {
  const { summary } = useConnectedClubSummary();
  const progresso = summary?.progress || 0;
  const faltam = Math.max(0, 14 - progresso);

  const [sabores, setSabores] = useState<Sabor[]>([]);
  const [janela, setJanela] = useState<PickupWindow | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setCarregando(false); return; }
    const { data: hoje, weekday } = hojeFortaleza();
    const supabase = requireSupabase();
    void Promise.all([
      supabase.from("flavors")
        .select("id,name,category,base_price,image_path")
        .eq("active", true).order("name"),
      supabase.from("flavor_availability")
        .select("flavor_id,status,quantity_available,quantity_reserved")
        .eq("service_date", hoje),
      supabase.from("business_hours")
        .select("channel_slug,weekday,opens_at,closes_at,active")
        .eq("active", true),
    ]).then(([fl, av, bh]) => {
      const disp = new Map(
        ((av.data || []) as { flavor_id: string; status: string; quantity_available: number | null; quantity_reserved: number | null }[])
          .map((a) => [a.flavor_id, a]),
      );
      const lista: Sabor[] = ((fl.data || []) as { id: string; name: string; category: string; base_price: number | null; image_path: string | null }[])
        .map((f) => {
          const a = disp.get(f.id);
          const livre = a && a.quantity_available !== null
            ? Math.max(0, (a.quantity_available || 0) - (a.quantity_reserved || 0))
            : null;
          return {
            id: f.id,
            nome: f.name,
            preco: Number(f.base_price || 0),
            imagem: f.image_path || "",
            restam: livre,
            premium: f.category === "premium",
            disponivel: Boolean(a && a.status !== "sold_out" && a.status !== "unavailable" && (livre === null || livre > 0)),
          } as Sabor & { disponivel: boolean };
        })
        .filter((s) => (s as Sabor & { disponivel: boolean }).disponivel);
      setSabores(lista);
      setJanela(pickupWindowForDay((bh.data || []) as PickupHour[], weekday));
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, []);

  const aberto = janela !== null;
  const visiveis = sabores.slice(0, 3);

  return (
    <main className="adoce-home">
      <header className="ah-topo">
        <div className="ah-marca">
          <img src="/site/logo.webp" alt="" aria-hidden="true" />
          <span>Adoce</span>
        </div>
        <div className="ah-acoes">
          <a href="#cardapio-fatias" aria-label="Buscar sabores"><Search /></a>
          <a href="#entrar" aria-label="Minha conta"><User /></a>
        </div>
      </header>

      <section className={`ah-status ${aberto ? "aberta" : "fechada"}`} role="status">
        <p className="ah-status-titulo">
          <span className="ah-ponto" aria-hidden="true" />
          {aberto ? "Reservas abertas agora" : "Reservas fechadas no momento"}
        </p>
        <p className="ah-status-texto">
          {aberto
            ? `Retirada ${pickupWindowHint(janela).replace("Hoje das ", "das ").replace(".", "")}, no Cantinho da Adoce`
            : "Volte amanhã para reservar sua fatia"}
        </p>
      </section>

      <section className="ah-secao" aria-labelledby="ah-hoje">
        <p className="ah-eyebrow">{dataPorExtenso()}</p>
        <h1 id="ah-hoje" className="ah-titulo">Fatias de hoje</h1>

        {carregando ? (
          <p className="ah-vazio">Vendo o que saiu do forno…</p>
        ) : visiveis.length === 0 ? (
          <div className="ah-esgotado">
            <p><strong>As fatias de hoje já acabaram</strong></p>
            <p>Amanhã tem mais, feito na hora.</p>
            <a className="ah-secundario" href="#cardapio-fatias">Ver o cardápio da semana</a>
          </div>
        ) : (
          <>
            <ul className="ah-lista">
              {visiveis.map((s) => (
                <li key={s.id} className="ah-fatia">
                  <div className="ah-foto">
                    {s.imagem ? <img src={s.imagem} alt={s.nome} loading="lazy" /> : <span aria-hidden="true" />}
                  </div>
                  <div className="ah-fatia-info">
                    <p className="ah-fatia-nome">{s.nome}</p>
                    <p className={s.restam !== null && s.restam <= 3 ? "ah-fatia-ultimas" : "ah-fatia-qtd"}>
                      {s.restam === null
                        ? money(s.preco)
                        : s.restam <= 3
                          ? `Últimas ${s.restam} · ${money(s.preco)}`
                          : `${s.restam} fatias · ${money(s.preco)}`}
                    </p>
                  </div>
                  <a className="ah-reservar" href={`#adoce-hoje?sabor=${s.id}`}>Reservar</a>
                </li>
              ))}
            </ul>
            {sabores.length > visiveis.length && (
              <a className="ah-ver-todos" href="#cardapio-fatias">
                Ver os {sabores.length} sabores de hoje
              </a>
            )}
          </>
        )}
      </section>

      <section className="ah-beth" aria-label="Sobre a Adoce">
        <div className="ah-beth-icone" aria-hidden="true"><Store /></div>
        <div>
          <p className="ah-beth-titulo">Feito pelas mãos da Beth</p>
          <p className="ah-beth-texto">Cada fatia sai do forno todo dia, aqui em Fortaleza.</p>
        </div>
      </section>

      <section className="ah-clube" aria-label="Clube Adoce">
        <div className="ah-clube-info">
          <p className="ah-clube-titulo">Clube Adoce</p>
          <p className="ah-clube-texto">
            {progresso > 0 ? `Faltam ${faltam} para sua fatia-presente` : "Cada fatia vale um carimbo"}
          </p>
          <div className="ah-barra"><span style={{ width: `${(progresso / 14) * 100}%` }} /></div>
        </div>
        <a className="ah-clube-num" href="#clube">
          <strong>{progresso}</strong><small>/14</small>
        </a>
      </section>

      <section className="ah-secao" aria-labelledby="ah-encomendas">
        <h2 id="ah-encomendas" className="ah-titulo-menor">Encomendar</h2>
        <div className="ah-cards">
          <a className="ah-card" href="#encomendas">
            <ShoppingBag />
            <p>Tortas</p>
            <small>Sob encomenda</small>
          </a>
          <a className="ah-card" href="#docinhos">
            <Heart />
            <p>Docinhos</p>
            <small>A partir de 50</small>
          </a>
        </div>
        <a className="ah-outros" href="#eventos">
          Festas, Adoce na Escola e decoração <ChevronRight />
        </a>
      </section>
    </main>
  );
}
