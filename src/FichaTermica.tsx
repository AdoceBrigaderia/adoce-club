// A ficha de 58 mm — o impresso que vai grampeado na sacola.
//
// Desenho aprovado pelo Rubens: logo centralizada e bem grande no inicio, o
// pedido em lista limpa, e uma mensagem bonita no final. Este papel e a ultima
// coisa que a Adoce diz ao cliente antes de ele abrir a caixa em casa.
//
// Detalhes que parecem teimosia e nao sao:
//
//  - 58 mm e a largura do papel, nao da area util. A impressora come as bordas,
//    entao o conteudo vive em 48 mm.
//  - Impressora termica nao imprime cinza: meio-tom vira sujeira ou some. Aqui
//    e tudo preto no branco, e a hierarquia vem de tamanho e espaco.
//  - As linhas tracejadas sao caractere, nao borda. Borda fina some no papel.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { QuoteData } from "./RequestQuoteDocument";
import { parsePreferences } from "./RequestQuoteDocument";
import { formatarDataHora, quando } from "./lib/datas";
import "./ficha-termica.css";

const dataCurta = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));

const hora = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  }).format(new Date(value)).replace(":", "h");

const telefoneBonito = (valor: string) => {
  const digitos = valor.replace(/\D/g, "").replace(/^55/, "");
  if (digitos.length < 10) return valor;
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `${ddd} ${meio}-${resto.slice(meio.length)}`;
};

export default function FichaTermica({
  data,
  linkDoClube = "https://www.adocebrigaderia.com.br/#clube",
  instagram = "@_adocebrigaderia_",
}: {
  data: QuoteData;
  linkDoClube?: string;
  instagram?: string;
}) {
  const [qr, setQr] = useState<string>("");
  const itens = parsePreferences(data.preferences);

  useEffect(() => {
    let vivo = true;
    // margin 0 e escala alta: em papel termico, QR pequeno com borda larga
    // simplesmente nao le.
    QRCode.toDataURL(linkDoClube, { margin: 0, scale: 6, errorCorrectionLevel: "M" })
      .then((url) => { if (vivo) setQr(url); })
      .catch(() => { if (vivo) setQr(""); });
    return () => { vivo = false; };
  }, [linkDoClube]);

  const total = itens.reduce((soma, item) => soma + (item.quantity || 0), 0)
    || data.quantity;

  return (
    <article className="ficha58" aria-label="Ficha de entrega">
      <header className="f-marca">
        <img className="f-logo" src="/site/logo.webp" alt="Adoce Brigaderia" />
        <p className="f-sub">CONFEITARIA ARTESANAL</p>
        <p className="f-sub">Fortaleza — CE</p>
      </header>

      <hr className="f-linha" />

      <p className="f-numero">{data.requestNumber}</p>
      <p className="f-emissao">Pedido em {formatarDataHora(data.createdAt)}</p>

      <hr className="f-linha" />

      <section className="f-bloco">
        <h2>CLIENTE</h2>
        <p className="f-destaque">{data.customerName}</p>
        <p>{telefoneBonito(data.customerPhone)}</p>
      </section>

      <hr className="f-linha" />

      <section className="f-bloco">
        <h2>PEDIDO</h2>
        <ul className="f-itens">
          {itens.length ? (
            itens.map((item, indice) => (
              <li key={`${item.description}-${indice}`}>
                <span className="f-qtd">{item.quantity ?? ""}</span>
                <span className="f-desc">{item.description}</span>
              </li>
            ))
          ) : (
            <li>
              <span className="f-qtd">{data.quantity}</span>
              <span className="f-desc">{data.productName}</span>
            </li>
          )}
        </ul>
      </section>

      <hr className="f-linha" />

      <p className="f-total">
        <span>TOTAL</span>
        <strong>{total} un.</strong>
      </p>

      {data.customerNotes ? (
        <>
          <hr className="f-linha" />
          <section className="f-bloco">
            <h2>OBSERVAÇÃO</h2>
            <p className="f-obs">{data.customerNotes}</p>
          </section>
        </>
      ) : null}

      <hr className="f-linha" />

      <section className="f-bloco">
        <h2>ENTREGA</h2>
        <p className="f-destaque">
          {dataCurta(data.desiredStart)} às {hora(data.desiredStart)}
        </p>
        {data.serviceLocation ? <p>{data.serviceLocation}</p> : null}
      </section>

      <hr className="f-linha f-linha-larga" />

      <footer className="f-carinho">
        <p className="f-recado">
          Cada docinho daqui<br />
          foi feito à mão,<br />
          pensando em você.
        </p>
        <p className="f-agradece">
          Obrigada por adoçar<br />
          seu momento com a gente.
        </p>
        <p className="f-insta">{instagram}</p>
        {qr ? (
          <>
            <img className="f-qr" src={qr} alt="" aria-hidden="true" />
            <p className="f-qr-legenda">Entre no Clube Adoce</p>
          </>
        ) : null}
        <p className="f-emissao">impresso {quando(new Date().toISOString())}</p>
      </footer>
    </article>
  );
}
