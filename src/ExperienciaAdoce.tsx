// Festas, Adoce na Escola e Decoracao.
//
// O Rubens encontrou a tela antiga com "visual muito diferente do restante do
// site" e "carrossel com falhas graves". O carrossel some: no celular ele
// esconde conteudo atras de um gesto que ninguem faz, e quebra facil.
//
// No lugar, a pagina conta a experiencia de cima para baixo — promessa, como
// funciona, as opcoes com preco, e uma conversa no fim. Estas tres linhas nao
// sao produto de prateleira: sao servico com data marcada, e quem compra
// precisa entender o que vai acontecer no dia.
//
// Nada fecha sozinho aqui. Todas passam por conversa, porque a data precisa
// ser combinada e o orcamento depende do tamanho.

import { MessageCircle } from "lucide-react";
import {
  conteudoDe,
  mensagemDaExperiencia,
  type Experiencia,
} from "./experiencias-adoce";
import {
  prazoPorExtenso,
  precoPorExtenso,
  produtosDoSegmento,
  type Produto,
} from "./catalogo-de-encomendas";
import "./experiencia-adoce.css";

export default function ExperienciaAdoce({
  qual,
  produtos,
  fotos = [],
  whatsapp = "5585982156026",
}: {
  qual: Experiencia;
  produtos: Produto[];
  /** Fotos da experiencia acontecendo — valem mais que foto de produto aqui. */
  fotos?: string[];
  whatsapp?: string;
}) {
  const conteudo = conteudoDe(qual);
  if (!conteudo) return null;

  const opcoes = produtosDoSegmento(produtos, qual);
  const zap = (produto?: string) =>
    `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagemDaExperiencia(qual, produto))}`;

  return (
    <main className="experiencia">
      <header className="exp-capa">
        {fotos[0] ? <img className="exp-capa-foto" src={fotos[0]} alt="" aria-hidden="true" /> : null}
        <div className="exp-capa-texto">
          <p className="exp-legenda">{conteudo.titulo}</p>
          <h1>{conteudo.promessa}</h1>
        </div>
      </header>

      <section className="exp-intro">
        <p>{conteudo.intro}</p>
      </section>

      <section className="exp-passos" aria-label="Como funciona">
        <h2>Como funciona</h2>
        <ol>
          {conteudo.comoFunciona.map((passo, i) => (
            <li key={passo.titulo}>
              <span className="exp-numero" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{passo.titulo}</h3>
                <p>{passo.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="exp-prazo">
          Combinamos com <strong>{conteudo.prazoDiasUteis} dias úteis</strong> de antecedência.
        </p>
      </section>

      {opcoes.length ? (
        <section className="exp-opcoes" aria-label="Opções">
          <h2>Opções</h2>
          <ul>
            {opcoes.map((produto) => (
              <li key={produto.id}>
                <div className="exp-opcao-texto">
                  <h3>{produto.nome}</h3>
                  {produto.resumo ? <p>{produto.resumo}</p> : null}
                  <p className="exp-preco">{precoPorExtenso(produto)}</p>
                  <p className="exp-prazo-item">{prazoPorExtenso(produto)}</p>
                </div>
                <a className="exp-falar" href={zap(produto.nome)} target="_blank" rel="noreferrer">
                  <MessageCircle aria-hidden="true" /> Quero essa
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fotos.length > 1 ? (
        <section className="exp-fotos" aria-label="Como fica no dia">
          <h2>Como fica no dia</h2>
          {/* Empilhadas, nao em carrossel: no celular o carrossel esconde
              conteudo atras de um gesto que quase ninguem faz. */}
          <div className="exp-galeria">
            {fotos.slice(1).map((foto) => (
              <img key={foto} src={foto} alt="" aria-hidden="true" loading="lazy" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="exp-conversa">
        <h2>Vamos combinar?</h2>
        <p>Para fazer o orçamento, a gente precisa saber:</p>
        <ul>
          {conteudo.precisamosSaber.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <a className="exp-principal" href={zap()} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden="true" /> Falar com a Adoce
        </a>
        <p className="exp-nota">A mensagem já vai com essas perguntas prontas.</p>
      </section>
    </main>
  );
}
