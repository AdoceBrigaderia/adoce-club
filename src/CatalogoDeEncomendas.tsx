// Encomendas — uma tela para tudo que se pede com antecedencia.
//
// Substitui cinco rotas e tres componentes diferentes que faziam a mesma
// coisa. Os cinco segmentos ficam lado a lado, no mesmo peso, e trocar entre
// eles nao volta para a home — era a reclamacao de que "a pagina de tortas
// deve ter acesso direto aos docinhos".
//
// Festas, Escola e Decoracao entram aqui como iguais. Decisao do Rubens em
// 10/08: so saem quando a Beth disser que encerrou.
//
// Produto sem foto continua aparecendo, com um lugar digno em vez de quadrado
// quebrado — hoje 12 dos 15 produtos nao tem imagem, e esconde-los faria o
// cliente deixar de saber que existem.

import { useMemo, useState } from "react";
import { CakeSlice, ChevronRight, ImageOff, MessageCircle } from "lucide-react";
import {
  menorPrecoDoSegmento,
  mensagemDeInteresse,
  prazoPorExtenso,
  precoPorExtenso,
  produtosDoSegmento,
  segmentosComProduto,
  dinheiro,
  type Produto,
  type Segmento,
} from "./catalogo-de-encomendas";
import "./catalogo-de-encomendas.css";

export default function CatalogoDeEncomendas({
  produtos,
  segmentoInicial = "cakes",
  whatsapp = "5585982156026",
  onPedir,
}: {
  produtos: Produto[];
  segmentoInicial?: Segmento;
  whatsapp?: string;
  onPedir?: (produto: Produto) => void;
}) {
  const [ativo, setAtivo] = useState<Segmento>(segmentoInicial);

  const abas = useMemo(() => segmentosComProduto(produtos), [produtos]);
  const lista = useMemo(() => produtosDoSegmento(produtos, ativo), [produtos, ativo]);

  return (
    <main className="encomendas">
      <header className="enc-topo">
        <p className="enc-legenda">Encomendas</p>
        <h1>Feito para a sua data</h1>
        <p className="enc-intro">
          Tudo aqui é combinado com antecedência, para sair do jeito que você
          imaginou.
        </p>
      </header>

      {/* As abas ficam grudadas no topo: trocar de segmento é a acao mais
          frequente desta tela. */}
      <nav className="enc-abas" aria-label="Tipos de encomenda">
        {abas.map((s) => {
          const menor = menorPrecoDoSegmento(produtos, s.chave);
          return (
            <button
              key={s.chave}
              type="button"
              className={s.chave === ativo ? "ativa" : ""}
              onClick={() => setAtivo(s.chave)}
              aria-current={s.chave === ativo}
            >
              <strong>{s.titulo}</strong>
              <small>{menor !== null ? `a partir de ${dinheiro(menor)}` : s.chamada}</small>
            </button>
          );
        })}
      </nav>

      <ul className="enc-lista">
        {lista.map((produto) => (
          <li key={produto.id} className="enc-produto">
            <div className="enc-foto">
              {produto.fotoUrl ? (
                <img src={produto.fotoUrl} alt={produto.nome} loading="lazy" />
              ) : (
                <div className="enc-sem-foto" aria-hidden="true">
                  <CakeSlice />
                  <ImageOff className="enc-marca-foto" />
                </div>
              )}
            </div>

            <div className="enc-texto">
              <h2>{produto.nome}</h2>
              {produto.resumo ? <p className="enc-resumo">{produto.resumo}</p> : null}
              <p className="enc-preco">{precoPorExtenso(produto)}</p>
              <p className="enc-prazo">{prazoPorExtenso(produto)}</p>
            </div>

            <div className="enc-acoes">
              {onPedir ? (
                <button type="button" className="enc-pedir" onClick={() => onPedir(produto)}>
                  Pedir <ChevronRight aria-hidden="true" />
                </button>
              ) : null}
              <a
                className="enc-zap"
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagemDeInteresse(produto))}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" /> Tirar dúvida
              </a>
            </div>
          </li>
        ))}
      </ul>

      {!lista.length ? (
        <p className="enc-vazio">Ainda não temos opções cadastradas aqui.</p>
      ) : null}
    </main>
  );
}
