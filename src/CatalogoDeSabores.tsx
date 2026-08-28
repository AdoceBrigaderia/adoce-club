// Nossos sabores — a vitrine permanente.
//
// Os 26 sabores aparecem sempre. O que muda com o dia e o estado, nao a
// existencia: sabor que so aparece quando tem some do mundo do cliente.
//
// Tres correcoes do Rubens em 10/08, depois de ver a primeira versao:
//
//   "foto esta muito pequenas, nao da pra ver nada"
//     → a foto passou a ocupar a largura toda do cartao. Ela e o que vende.
//
//   "embaixo do valor e interessante por que e por fatia"
//     → "a fatia" embaixo do preco, para ninguem achar que e a torta inteira.
//
//   "aquelas informacoes do 'leva:' pode remover... preferia que criasse mais
//    uma tabela no banco e colocasse um resumo bem legal"
//     → saiu a lista de ingredientes, entrou `flavor_summaries`.
//
// A descricao tecnica cadastrada se repete quase igual em 20 dos 26 sabores —
// serve para ficha tecnica, nao para dar vontade.

import { useState } from "react";
import { ArrowLeft, CakeSlice, Maximize2, MessageCircle } from "lucide-react";
import ProductImageViewer, { type ProductImage } from "./ProductImageViewer";
import {
  contar,
  dinheiro,
  frasedoEstado,
  linkDeWhatsApp,
  ordenar,
  pedidoDeTortaInteira,
  perguntaSobreOSabor,
  podeReservarAgora,
  type SaborNaVitrine,
} from "./catalogo-de-sabores";
import "./catalogo-de-sabores.css";

export default function CatalogoDeSabores({
  sabores,
  onReservar,
  whatsapp = "5585982156026",
}: {
  sabores: SaborNaVitrine[];
  onReservar?: (saborId: string) => void;
  whatsapp?: string;
}) {
  const lista = ordenar(sabores);
  const contagem = contar(sabores);

  // "as fotos pequenas cortadas nao expandem!" — agora expandem, no visor que
  // o projeto ja tinha e esta tela ignorava.
  const [ampliada, setAmpliada] = useState<ProductImage | null>(null);

  return (
    <main className="sabores">
      {/* Toda tela precisa de saida. A primeira versao nao tinha nenhuma —
          o cliente entrava e ficava preso. */}
      <nav className="sab-barra" aria-label="Navegação">
        <a className="sab-voltar" href="#inicio">
          <ArrowLeft aria-hidden="true" /> Início
        </a>
        <a className="sab-atalho" href="#adoce-hoje">O que tem hoje</a>
      </nav>

      <header className="sab-capa">
        <p className="sab-legenda">Nossos sabores</p>
        <h1>
          {contagem.total} sabores,<em> feitos pelas mãos da Beth.</em>
        </h1>
        <p className="sab-resumo">
          {contagem.hoje > 0
            ? `${contagem.hoje} ${contagem.hoje === 1 ? "está disponível" : "estão disponíveis"} hoje.`
            : "Hoje já vendemos tudo — amanhã tem mais."}
          {contagem.previstos > 0 ? ` Outros ${contagem.previstos} já têm dia marcado.` : ""}
        </p>
      </header>

      <ul className="sab-lista">
        {lista.map((sabor) => {
          const podeLevar = podeReservarAgora(sabor);
          const acabando = sabor.estado === "hoje" && sabor.disponiveis > 0 && sabor.disponiveis <= 3;
          return (
            <li key={sabor.id} className={`sab-item sab-${sabor.estado}${podeLevar ? " tem" : ""}`}>
              <div className="sab-foto">
                {sabor.fotoFatia ? (
                  <img src={sabor.fotoFatia} alt={sabor.nome} loading="lazy" />
                ) : (
                  <div className="sab-sem-foto" aria-hidden="true"><CakeSlice /></div>
                )}
                <span className={`sab-estado${acabando ? " acabando" : ""}`}>
                  {frasedoEstado(sabor)}
                </span>
                <h2 className="sab-nome">{sabor.nome}</h2>
                {sabor.fotoFatia ? (
                  <button
                    type="button"
                    className="sab-ampliar"
                    aria-label={`Ver a foto de ${sabor.nome} maior`}
                    onClick={() => setAmpliada({ src: sabor.fotoFatia!, alt: sabor.nome })}
                  >
                    <Maximize2 aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="sab-corpo">
                {/* O resumo de vitrine. A descrição técnica fica no cadastro. */}
                {sabor.resumo ? <p className="sab-frase">{sabor.resumo}</p> : null}

                <div className="sab-linha">
                  <p className="sab-preco">
                    <strong>{dinheiro(sabor.preco)}</strong>
                    <small>a fatia</small>
                  </p>

                  {podeLevar && onReservar ? (
                    <button type="button" className="sab-reservar" onClick={() => onReservar(sabor.id)}>
                      Quero essa
                    </button>
                  ) : (
                    <a
                      className="sab-perguntar"
                      href={linkDeWhatsApp(perguntaSobreOSabor(sabor), whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle aria-hidden="true" /> Me avisa
                    </a>
                  )}
                </div>

                {sabor.tortaInteira ? (
                  <a
                    className="sab-inteira"
                    href={linkDeWhatsApp(pedidoDeTortaInteira(sabor), whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Também em torta inteira
                    {sabor.precoTorta ? ` · ${dinheiro(sabor.precoTorta)}` : ""}
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Saida no fim tambem: quem rolou 26 sabores nao volta ao topo so para
          achar um botao. */}
      <nav className="sab-rodape" aria-label="Para onde ir agora">
        <p className="sab-assinatura">
          Doce feito com afeto, para celebrar cada momento.
        </p>
        <a className="sab-principal" href="#adoce-hoje">Ver o que tem hoje</a>
        <a className="sab-secundario" href="#encomendas">Encomendar uma torta</a>
        <a className="sab-secundario" href="#inicio">Voltar ao início</a>
      </nav>
      <ProductImageViewer image={ampliada} onClose={() => setAmpliada(null)} />
    </main>
  );
}
