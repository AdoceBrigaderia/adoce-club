import { ArrowLeft, Download, MessageCircle } from "lucide-react";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import "./public-site.css";
import "./catalog-2026.css";

type Flavor = {
  num: string;
  name: string;
  composicao?: string;
  desc?: string;
  note?: string;
  soon?: boolean;
};

const flavors: Flavor[] = [
  { num: "01", name: "Abacaxi com Coco", composicao: "Massa amanteigada, brigadeiro branco cremoso com doce artesanal de abacaxi e brigadeiro cremoso de beijinho. Finalização com brigadeiro branco e pedaços de abacaxi.", desc: "Combinação tropical e delicada, com frescor do abacaxi e cremosidade do coco." },
  { num: "02", name: "Bis Branco", composicao: "Massa amanteigada com brigadeiro branco cremoso e pedaços de Bis de chocolate branco nos recheios.", desc: "Cremosa e crocante — feita para quem ama chocolate branco." },
  { num: "03", name: "Black Velvet", composicao: "Massa Black com duas camadas de brigadeiro cremoso Black e cobertura de chocolate Black.", desc: "Intensa e profundamente chocolatuda, menos adocicada." },
  { num: "04", name: "Caramelo Salgado com Ninho", composicao: "Massa amanteigada com brigadeiro cremoso de caramelo salgado e brigadeiro cremoso de Ninho.", desc: "Caramelo intenso em contraste com a suavidade do Ninho." },
  { num: "05", name: "Charge", composicao: "Massa de chocolate, brigadeiro cremoso de caramelo salgado e crocante de amendoim com chocolate.", desc: "Chocolate, caramelo e amendoim — cremosidade e crocância juntas." },
  { num: "06", name: "Chocolatudo", composicao: "Massa de chocolate com duas camadas de brigadeiro cremoso de chocolate (cacau 50%). Finalização com brigadeiro de chocolate.", desc: "Chocolate do começo ao fim, massa macia e recheio generoso." },
  { num: "07", name: "Chocolatudo Supreme", composicao: "Massa de chocolate com duas camadas de brigadeiro cremoso de chocolate e pedaços de chocolate em barra nos recheios.", desc: "O Chocolatudo levado a outro nível, com mais intensidade e textura." },
  { num: "08", name: "Chocolatudo Trufado com Morangos", composicao: "Massa de chocolate com duas camadas de brigadeiro cremoso de chocolate e pedaços de morangos frescos nos recheios.", desc: "O frescor dos morangos equilibra a intensidade do chocolate.", note: "Adicional de morangos frescos aplicável." },
  { num: "09", name: "Crocante com Churros", soon: true },
  { num: "10", name: "Doce de Leite com Nutella", composicao: "Massa amanteigada com brigadeiro cremoso de doce de leite e brigadeiro cremoso de Nutella.", desc: "O caramelizado do doce de leite encontra a cremosidade da avelã com cacau." },
  { num: "11", name: "Doce de Leite Crocante", composicao: "Massa amanteigada com brigadeiro cremoso de doce de leite e elemento crocante de doce de leite.", desc: "Cremosidade do doce de leite com contraste crocante." },
  { num: "12", name: "Dois Amores", composicao: "Camadas de massa amanteigada e massa de chocolate, com brigadeiro branco cremoso e brigadeiro cremoso de chocolate (cacau 50%).", desc: "Dois clássicos em uma só torta." },
  { num: "13", name: "Ferrero Adoce", composicao: "Massa de chocolate, brigadeiro branco cremoso e brigadeiro cremoso de chocolate com amendoim nos recheios. Finalização com brigadeiro de chocolate e amendoim.", desc: "Rica em chocolate, cremosidade e crocância." },
  { num: "14", name: "Galak", soon: true },
  { num: "15", name: "Galak Trufado com Morangos", composicao: "Massa amanteigada com duas camadas de brigadeiro branco cremoso, pedaços de chocolate Galak e morangos frescos. Finalização com pedaços de Galak.", desc: "Chocolate branco e morangos frescos em combinação delicada.", note: "Adicional de morangos frescos aplicável." },
  { num: "16", name: "Kinder Bueno", composicao: "Massa de chocolate, brigadeiro cremoso de Nutella branca e brigadeiro cremoso de Nutella tradicional. Finalização com brigadeiro de chocolate e wafer crocante.", desc: "Chocolate, avelã, creme branco e wafer — cremosidade e crocância." },
  { num: "17", name: "KitKat Black", composicao: "Massa Black com duas camadas de brigadeiro cremoso Black e pedaços de KitKat nos recheios. Finalização Black com mais pedaços de KitKat.", desc: "Chocolate intenso com o contraste crocante do KitKat." },
  { num: "18", name: "Limão Siciliano com Frutas Vermelhas", composicao: "Massa amanteigada, mousse cremoso de limão siciliano e brigadeiro branco cremoso com geleia artesanal de amora, mirtilo e morango. Finalização com chantilly, morango e raspas de limão.", desc: "O cítrico do limão encontra a acidez das frutas vermelhas.", note: "Consultar adicional de morangos frescos na finalização." },
  { num: "19", name: "Maracujá com Chocolate", composicao: "Massa leve, brigadeiro cremoso de maracujá e brigadeiro cremoso de chocolate. Finalização com ganache e brigadeiro de chocolate.", desc: "O toque cítrico do maracujá equilibra a intensidade do chocolate." },
  { num: "20", name: "Morango com Suspiros", composicao: "Massa amanteigada com brigadeiro cremoso de Ninho e geleia artesanal de morango nas duas camadas de recheio. Finalização com suspiros.", desc: "Ninho e morango clássicos, com crocância dos suspiros." },
  { num: "21", name: "Mousse de Limão", composicao: "Massa leve com duas camadas de brigadeiro cremoso de mousse de limão. Finalização com Bis sabor limão.", desc: "Cremosa, refrescante, com toque crocante do Bis de limão." },
  { num: "22", name: "Ninho com Nutella", composicao: "Massa amanteigada com brigadeiro cremoso de Ninho e brigadeiro cremoso de Nutella.", desc: "A suavidade do Ninho encontra o sabor marcante da Nutella." },
  { num: "23", name: "Olho de Sogra", composicao: "Massa branca, brigadeiro cremoso de doce de leite com ameixa e brigadeiro cremoso de beijinho. Finalização com chantininho e docinho de olho de sogra.", desc: "Um clássico brasileiro com ameixa, doce de leite e coco." },
  { num: "24", name: "Oreo", composicao: "Massa de chocolate com duas camadas de brigadeiro branco cremoso e pedaços de Oreo misturados ao recheio.", desc: "Brigadeiro branco e biscoito Oreo — cremoso e crocante." },
  { num: "25", name: "Ouro Branco", composicao: "Massa de chocolate, brigadeiro branco cremoso, brigadeiro cremoso de chocolate e pedaços de bombom Ouro Branco nos recheios. Finalização de chocolate.", desc: "Chocolate branco, chocolate ao leite e pedaços de bombom." },
  { num: "26", name: "Ovomaltine", composicao: "Massa de chocolate com duas camadas de brigadeiro cremoso de chocolate e Ovomaltine. Finalização com brigadeiro de chocolate e Ovomaltine.", desc: "Muito chocolate e a crocância característica do Ovomaltine." },
  { num: "27", name: "Palha Italiana", composicao: "Massa de chocolate, brigadeiro branco cremoso e brigadeiro cremoso de chocolate com pedaços de biscoito de leite.", desc: "Inspirada na tradicional palha italiana." },
  { num: "28", name: "Prestígio", composicao: "Massa de chocolate com brigadeiro cremoso de chocolate e brigadeiro cremoso de beijinho.", desc: "Chocolate e coco em combinação clássica e cremosa." },
  { num: "29", name: "Red Velvet com Geleia de Morango e Ninho", composicao: "Massa Red Velvet com brigadeiro cremoso de Ninho e geleia artesanal de morango.", desc: "A delicadeza do Red Velvet com Ninho e geleia artesanal." },
  { num: "30", name: "Red Velvet com Ninho e Nutella", composicao: "Massa Red Velvet com brigadeiro cremoso de Ninho e Nutella.", desc: "Massa delicada, Ninho cremoso e Nutella." },
  { num: "31", name: "Serenata de Amor", composicao: "Massa de chocolate com brigadeiro cremoso de chocolate cravejado de pedaços de bombom Serenata de Amor.", desc: "Brigadeiro de chocolate e bombom — cremoso e crocante." },
  { num: "32", name: "Surpresa de Uva", composicao: "Massa amanteigada com brigadeiro branco cremoso e uvas Thompson frescas nos recheios.", desc: "Brigadeiro branco envolvendo uvas frescas e suculentas." },
  { num: "33", name: "Trufado de Ninho com Morangos — Massa Amanteigada", composicao: "Massa amanteigada com brigadeiro cremoso de Ninho e pedaços de morangos frescos nos recheios.", desc: "Massa amanteigada e Ninho com o frescor dos morangos.", note: "Adicional de morangos frescos aplicável." },
  { num: "34", name: "Trufado de Ninho com Morangos — Massa de Chocolate", composicao: "Massa de chocolate com brigadeiro cremoso de Ninho e pedaços de morangos frescos nos recheios.", desc: "Chocolate, Ninho e morangos frescos — intenso e equilibrado.", note: "Adicional de morangos frescos aplicável." },
];

const sizes = [
  { label: "P", altura: "15 cm", diametro: "15 cm", valor: "R$ 120,00" },
  { label: "M", altura: "15 cm", diametro: "20 cm", valor: "R$ 160,00" },
  { label: "G", altura: "12 cm", diametro: "25 cm", valor: "R$ 200,00" },
];

const tradicionais = ["Brigadeiro", "Beijinho", "Casadinho", "Chocoball", "Ninho", "Amendoim", "Nesquik"];
const especiais = ["Churros", "Ninho com Nutella", "Surpresa de Uva", "Confeito M&M's", "Ferrero Rocher"];

const steps = [
  { title: "Escolha seus produtos", text: "Selecione os sabores das tortas ou dos docinhos e informe as quantidades desejadas." },
  { title: "Defina o tamanho", text: "Para tortas, escolha entre P, M ou G." },
  { title: "Informe a data", text: "Nossa equipe verificará a disponibilidade de produção e retirada." },
  { title: "Confirme seu pedido", text: "Para reservar a encomenda, é necessário o pagamento antecipado de 50% do valor total." },
];

export default function CatalogPage2026() {
  const whatsappNumber = useOrderWhatsAppNumber();
  const whatsapp = orderWhatsAppUrl(whatsappNumber, "Olá, Adoce! Vi o catálogo de tortas e docinhos 2026 e gostaria de fazer um orçamento.");

  return (
    <main className="public-site catalog-2026-page">
      <div className="catalog-2026-toolbar">
        <a className="public-back" href="/"><ArrowLeft /> Voltar à Adoce</a>
        <button type="button" className="public-primary" onClick={() => window.print()}>
          Baixar PDF <Download />
        </button>
      </div>

      <header className="catalog-2026-hero">
        <p className="public-kicker">Cantinho da Adoce</p>
        <h1>Catálogo de Tortas<br />e Docinhos</h1>
        <p className="catalog-2026-tagline">Edição 2026 — doce feito com afeto, para celebrar cada momento.</p>
      </header>

      <section className="catalog-2026-section" aria-labelledby="catalog-sobre-title">
        <h2 id="catalog-sobre-title"><span>1</span> Conheça nossas tortas</h2>
        <p>
          No Cantinho da Adoce, nossas tortas são preparadas artesanalmente, com massas macias e fofinhas, no estilo chiffon,
          e camadas generosas de recheios cremosos. Nosso diferencial é oferecer uma torta em que cada fatia proporciona uma
          experiência completa, combinando massa delicada, muito recheio e sabores cuidadosamente elaborados.
        </p>
        <div className="catalog-2026-callout">
          <strong>Nosso estilo: tortas Naked</strong>
          <p>
            Trabalhamos exclusivamente com tortas no estilo Naked Cake, valorizando as camadas aparentes de massa e recheio.
            Por utilizarmos massas leves e uma quantidade generosa de recheio, nossas tortas não possuem a estrutura necessária
            para sustentar bolos decorados tradicionais, coberturas estruturais pesadas ou esculturas.
          </p>
        </div>
      </section>

      <section className="catalog-2026-section" aria-labelledby="catalog-sabores-title">
        <h2 id="catalog-sabores-title"><span>2</span> Nosso catálogo de sabores</h2>
        <p>34 combinações de massa, recheio e finalização — todas preparadas no estilo Naked, com camadas generosas de recheio.</p>
        <div className="catalog-2026-grid">
          {flavors.map((f) => (
            <article className="catalog-2026-card" key={f.num}>
              <header><span>{f.num}</span><h3>{f.name}</h3></header>
              {f.soon ? (
                <p className="catalog-2026-soon">Sabor em definição — composição e disponibilidade em breve.</p>
              ) : (
                <>
                  <p><strong>Composição:</strong> {f.composicao}</p>
                  <p className="catalog-2026-desc">{f.desc}</p>
                  {f.note ? <span className="catalog-2026-note">{f.note}</span> : null}
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="catalog-2026-section" aria-labelledby="catalog-tamanhos-title">
        <h2 id="catalog-tamanhos-title"><span>3</span> Tamanhos e valores</h2>
        <p>Todas as nossas tortas seguem o estilo Naked, com camadas generosas de recheio.</p>
        <div className="catalog-2026-sizes">
          {sizes.map((s) => (
            <div className="catalog-2026-size" key={s.label}>
              <span>{s.label}</span>
              <small>Altura {s.altura}<br />Diâmetro {s.diametro}</small>
              <strong>{s.valor}</strong>
            </div>
          ))}
        </div>
        <div className="catalog-2026-note-box">
          <strong>Importante</strong>
          <p>
            Tortas com morangos frescos possuem valor adicional, informado no orçamento. O rendimento em fatias pode variar
            conforme a espessura dos cortes. Consulte nossa equipe para escolher o tamanho mais adequado à sua ocasião.
          </p>
        </div>
      </section>

      <section className="catalog-2026-section" aria-labelledby="catalog-revenda-title">
        <h2 id="catalog-revenda-title"><span>4</span> Tortas para revenda</h2>
        <p>
          Agora o Cantinho da Adoce também oferece condições especiais para estabelecimentos e profissionais que desejam
          revender nossas tortas. A modalidade está disponível exclusivamente para tortas tamanho G, com pedido mínimo de
          cinco unidades.
        </p>
        <div className="catalog-2026-revenda">
          <span>Valor por torta G para revenda</span>
          <strong>R$ 182,00</strong>
          <small>Preço normal R$ 200,00 — desconto de 9%</small>
          <div className="catalog-2026-revenda-divider" />
          <p>Pedido mínimo: 5 tortas — <strong>R$ 910,00</strong></p>
          <small>Valores antes de eventuais adicionais de morangos frescos.</small>
        </div>
        <p><strong>Condições comerciais:</strong> os sabores podem ser escolhidos entre as opções disponíveis no catálogo. Tortas com morangos frescos recebem o adicional correspondente. Caldas para revenda têm valores sob consulta.</p>
      </section>

      <section className="catalog-2026-section" aria-labelledby="catalog-docinhos-title">
        <h2 id="catalog-docinhos-title"><span>5</span> Nossos docinhos</h2>
        <p>
          Além das tortas, preparamos docinhos artesanais para aniversários, confraternizações, celebrações e eventos.
          O pedido mínimo é de 50 unidades, com no mínimo 25 unidades por sabor.
        </p>
        <div className="catalog-2026-sweets">
          <div className="catalog-2026-sweet-card">
            <header><strong>Tradicionais</strong><span>R$ 70,00 <small>/ 50 un.</small></span></header>
            <ul>{tradicionais.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="catalog-2026-sweet-card">
            <header><strong>Especiais</strong><span>R$ 90,00 <small>/ 50 un.</small></span></header>
            <ul>{especiais.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <p className="catalog-2026-desc">Para pedidos que misturem as categorias tradicional e especial, o valor deverá ser confirmado no orçamento.</p>
      </section>

      <section className="catalog-2026-section" aria-labelledby="catalog-encomenda-title">
        <h2 id="catalog-encomenda-title"><span>6</span> Como fazer sua encomenda</h2>
        <div className="catalog-2026-steps">
          {steps.map((st, i) => (
            <div className="catalog-2026-step" key={st.title}>
              <span>{i + 1}</span>
              <div><strong>{st.title}</strong><p>{st.text}</p></div>
            </div>
          ))}
        </div>
        <div className="catalog-2026-info-grid">
          <div><strong>Retirada e transporte</strong><p>Encomendas disponíveis para retirada no Cantinho da Adoce. Transporte por terceiros é de responsabilidade do cliente.</p></div>
          <div><strong>Formas de pagamento</strong><p>Aceitamos Pix, dinheiro, cartão de débito e cartão de crédito.</p></div>
          <div><strong>Alterações e cancelamentos</strong><p>Condições informadas na confirmação do pedido, conforme prazos aplicáveis.</p></div>
        </div>
        <a className="public-primary catalog-2026-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">
          Falar no WhatsApp <MessageCircle />
        </a>
      </section>
    </main>
  );
}
