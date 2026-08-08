// Documento de orcamento da Adoce.
//
// Antes, imprimir uma solicitacao mandava a propria gaveta da operacao para a
// impressora: campos de formulario, botoes e caixas de anotacao interna. O que
// a cliente pediu nem aparecia. Este componente monta um orcamento limpo, que
// pode ser enviado ao cliente como confirmacao.

import "./request-quote-document.css";

export type QuoteItem = {
  quantity: number | null;
  description: string;
};

export type QuoteData = {
  requestNumber: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  quantity: number;
  desiredStart: string;
  serviceLocation: string;
  preferences: string;
  customerNotes: string;
  quotedTotal: number | null;
  depositAmount: number | null;
  statusLabel: string;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const longDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));

const issuedOn = () =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Fortaleza",
  }).format(new Date());

/**
 * Quebra "100 docinhos ( 25 ninho, 25 brigadeiro, 25 beijinho e 25 nesquik)"
 * em linhas legiveis. O cliente escreve livre; o orcamento precisa ser tabela.
 */
export function parsePreferences(preferences: string): QuoteItem[] {
  const text = (preferences || "").trim();
  if (!text) return [];

  const inside = text.match(/\(([^)]*)\)/)?.[1];
  const source = inside || text;

  const parts = source
    .split(/,| e (?=\d)|;|\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const items = parts
    .map((part) => {
      const match = part.match(/^(\d+)\s*(?:un\.?|unidades?|x)?\s*(.*)$/i);
      if (match && match[2].trim()) {
        return { quantity: Number(match[1]), description: match[2].trim() };
      }
      return { quantity: null, description: part };
    })
    .filter((item) => item.description.length > 0);

  if (items.length <= 1 && !inside) {
    return [{ quantity: null, description: text }];
  }
  return items;
}

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function RequestQuoteDocument({ data }: { data: QuoteData }) {
  const items = parsePreferences(data.preferences);
  const balance =
    data.quotedTotal !== null && data.depositAmount !== null
      ? Math.max(data.quotedTotal - data.depositAmount, 0)
      : null;

  return (
    <article className="quote-document" aria-label={`Or?amento ${data.requestNumber}`}>
      <header className="quote-header">
        <img src="/site/logo.webp" alt="Adoce Brigaderia" />
        <div>
          <strong>Adoce Brigaderia</strong>
          <span>Confeitaria artesanal ? Fortaleza ? CE</span>
        </div>
        <div className="quote-number">
          <small>Or?amento</small>
          <strong>{data.requestNumber}</strong>
          <span>Emitido em {issuedOn()}</span>
        </div>
      </header>

      <section className="quote-parties">
        <div>
          <small>Cliente</small>
          <strong>{data.customerName}</strong>
          <span>{data.customerPhone}</span>
        </div>
        <div>
          <small>Data e hor?rio do evento</small>
          <strong>{capitalize(longDate(data.desiredStart))}</strong>
          <span>{data.serviceLocation || "Local a combinar"}</span>
        </div>
      </section>

      <section className="quote-items">
        <h2>{data.productName || "Encomenda"}</h2>
        <table>
          <thead>
            <tr>
              <th className="qty">Qtd.</th>
              <th>Descri??o</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item, index) => (
                <tr key={index}>
                  <td className="qty">{item.quantity ?? "?"}</td>
                  <td>{capitalize(item.description)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="qty">{data.quantity}</td>
                <td>{data.productName || "Conforme combinado"}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="qty">{data.quantity}</td>
              <td>Total de unidades</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {data.customerNotes ? (
        <section className="quote-notes">
          <small>Observa??es da cliente</small>
          <p>{data.customerNotes}</p>
        </section>
      ) : null}

      <section className="quote-totals">
        <div>
          <small>Valor do or?amento</small>
          <strong>{data.quotedTotal !== null ? money(data.quotedTotal) : "A combinar"}</strong>
        </div>
        <div>
          <small>Sinal</small>
          <strong>{data.depositAmount !== null ? money(data.depositAmount) : "?"}</strong>
        </div>
        <div className="quote-balance">
          <small>Restante na entrega</small>
          <strong>{balance !== null ? money(balance) : "?"}</strong>
        </div>
      </section>

      <footer className="quote-footer">
        <p>
          Situa??o atual: <strong>{data.statusLabel}</strong>. Este or?amento ? v?lido
          mediante confirma??o da Adoce e reserva da data na agenda de produ??o.
        </p>
        <p className="quote-thanks">Feito com carinho para ado?ar o seu momento.</p>
      </footer>
    </article>
  );
}
