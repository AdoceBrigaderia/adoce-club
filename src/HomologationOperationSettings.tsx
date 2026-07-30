import { useMemo, useState } from "react";
import {
  CakeSlice,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Images,
  Layers3,
  Save,
  Settings2,
  Store,
} from "lucide-react";
import "./homologation-operation-settings.css";

type SettingsArea = "global" | "photos" | "costs" | "cakes";

type CostItem = {
  id: string;
  name: string;
  source: string;
  cost: number;
  price: number;
  minimumMargin: number;
};

const settingsAreas: Array<{
  id: SettingsArea;
  label: string;
  description: string;
  icon: typeof Settings2;
}> = [
  {
    id: "global",
    label: "Configurações globais",
    description: "Loja, reservas, atendimento e pagamentos",
    icon: Settings2,
  },
  {
    id: "photos",
    label: "Fotos e identidade",
    description: "Logo, capas, produtos, sabores e galerias",
    icon: Images,
  },
  {
    id: "costs",
    label: "Custos e margens",
    description: "Custo, venda, lucro, margem e alertas",
    icon: CircleDollarSign,
  },
  {
    id: "cakes",
    label: "Montagem das tortas",
    description: "Camadas, recheios, coberturas e adicionais",
    icon: Layers3,
  },
];

const initialCosts: CostItem[] = [
  {
    id: "ninho",
    name: "Brigadeiro cremoso sabor Ninho",
    source: "Fabricação própria · custo provisório",
    cost: 7.3,
    price: 12,
    minimumMargin: 30,
  },
  {
    id: "morango",
    name: "Morango no recheio",
    source: "Produto comprado · perda considerada",
    cost: 4.2,
    price: 8,
    minimumMargin: 30,
  },
  {
    id: "kitkat",
    name: "KitKat na cobertura",
    source: "Produto comprado",
    cost: 5.5,
    price: 10,
    minimumMargin: 35,
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const margin = (cost: number, price: number) =>
  price > 0 ? ((price - cost) / price) * 100 : 0;

export default function HomologationOperationSettings() {
  const [activeArea, setActiveArea] = useState<SettingsArea>("global");
  const [automaticReservation, setAutomaticReservation] = useState(true);
  const [reservationMinutes, setReservationMinutes] = useState(30);
  const [selectedPayments, setSelectedPayments] = useState(["Pix", "Débito", "Crédito"]);
  const [costItems, setCostItems] = useState(initialCosts);
  const [notice, setNotice] = useState("");

  const lowMarginCount = useMemo(
    () =>
      costItems.filter(
        (item) => margin(item.cost, item.price) < item.minimumMargin,
      ).length,
    [costItems],
  );

  const togglePayment = (method: string) => {
    setSelectedPayments((current) =>
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method],
    );
  };

  const updatePrice = (id: string, price: number) =>
    setCostItems((current) =>
      current.map((item) => (item.id === id ? { ...item, price } : item)),
    );

  const visualSave = (message: string) => {
    setNotice(`${message} Demonstração visual: nenhuma alteração foi gravada.`);
  };

  return (
    <section className="homologation-operation-settings">
      <header className="homologation-operation-settings-heading">
        <div>
          <small>Administração central</small>
          <h2>Configurações da Adoce</h2>
          <p>
            As opções globais, imagens, custos e fabricação ficam reunidas aqui,
            com acesso direto e sem procurar em menus diferentes.
          </p>
        </div>
        <Settings2 />
      </header>

      {notice ? (
        <p className="homologation-operation-settings-notice" role="status">
          <CheckCircle2 /> {notice}
        </p>
      ) : null}

      <nav
        className="homologation-operation-settings-tabs"
        aria-label="Tipos de configuração"
      >
        {settingsAreas.map(({ id, label, description, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={activeArea === id ? "active" : ""}
            aria-pressed={activeArea === id}
            onClick={() => {
              setActiveArea(id);
              setNotice("");
            }}
          >
            <Icon />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </nav>

      {activeArea === "global" ? (
        <div className="homologation-settings-panel">
          <header>
            <Store />
            <div>
              <small>Regras gerais</small>
              <h3>Loja, reservas e pagamentos</h3>
            </div>
          </header>

          <div className="homologation-settings-grid">
            <article>
              <label>
                Loja principal
                <select defaultValue="passare">
                  <option value="passare">Passaré · Fortaleza</option>
                </select>
              </label>
              <label>
                Nome exibido no atendimento
                <input defaultValue="Adoce Brigaderia" />
              </label>
            </article>

            <article>
              <label className="homologation-settings-check">
                <input
                  type="checkbox"
                  checked={automaticReservation}
                  onChange={(event) =>
                    setAutomaticReservation(event.target.checked)
                  }
                />
                <span>
                  <strong>Reserva automática de estoque</strong>
                  <small>Aplica a regra nos próximos pedidos on-line.</small>
                </span>
              </label>
              <label>
                Prazo para pagamento
                <span className="homologation-settings-input-with-icon">
                  <Clock3 />
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={reservationMinutes}
                    onChange={(event) =>
                      setReservationMinutes(Number(event.target.value))
                    }
                  />
                  <small>minutos</small>
                </span>
              </label>
            </article>
          </div>

          <section className="homologation-settings-payments">
            <header>
              <CreditCard />
              <div>
                <small>Recebimentos</small>
                <h4>Meios de pagamento disponíveis</h4>
              </div>
            </header>
            <div>
              {["Pix", "Débito", "Crédito", "Dinheiro"].map((method) => (
                <button
                  type="button"
                  key={method}
                  className={selectedPayments.includes(method) ? "active" : ""}
                  aria-pressed={selectedPayments.includes(method)}
                  onClick={() => togglePayment(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            className="homologation-settings-save"
            onClick={() => visualSave("Configurações globais revisadas.")}
          >
            <Save /> Salvar configurações globais
          </button>
        </div>
      ) : null}

      {activeArea === "photos" ? (
        <div className="homologation-settings-panel">
          <header>
            <Camera />
            <div>
              <small>Central de imagens</small>
              <h3>Fotos e identidade visual</h3>
            </div>
          </header>

          <div className="homologation-settings-photo-grid">
            <article>
              <img src="/site/logo.webp" alt="Logo oficial da Adoce Brigaderia" />
              <div>
                <small>Identidade</small>
                <strong>Logo principal</strong>
                <span>Uso: cabeçalhos, perfil e cartão digital</span>
              </div>
              <button type="button" onClick={() => visualSave("Troca da logo simulada.")}>Trocar imagem</button>
            </article>
            <article>
              <img src="/adoce-hoje/torta-chocolatudo.webp" alt="Torta Chocolatudo" />
              <div>
                <small>Produtos</small>
                <strong>Fotos das tortas</strong>
                <span>Uso: catálogo, encomendas e Adoce do Seu Jeito</span>
              </div>
              <button type="button" onClick={() => visualSave("Troca da foto de produto simulada.")}>Gerenciar fotos</button>
            </article>
            <article>
              <img src="/site/placeholder-sabor-sem-foto.svg" alt="Placeholder oficial para sabor sem foto" />
              <div>
                <small>Sabores e galerias</small>
                <strong>Fatias, sabores e campanhas</strong>
                <span>Upload, colagem, recorte, histórico e restauração</span>
              </div>
              <button type="button" onClick={() => visualSave("Abertura da galeria simulada.")}>Abrir biblioteca</button>
            </article>
          </div>
        </div>
      ) : null}

      {activeArea === "costs" ? (
        <div className="homologation-settings-panel">
          <header>
            <CircleDollarSign />
            <div>
              <small>Custos e rentabilidade</small>
              <h3>Custo, venda, lucro e margem</h3>
            </div>
            <span className={lowMarginCount ? "warning" : "ok"}>
              {lowMarginCount} alerta{lowMarginCount === 1 ? "" : "s"}
            </span>
          </header>

          <div className="homologation-settings-cost-list">
            {costItems.map((item) => {
              const currentMargin = margin(item.cost, item.price);
              const lowMargin = currentMargin < item.minimumMargin;
              return (
                <article key={item.id} className={lowMargin ? "warning" : ""}>
                  <div className="homologation-settings-cost-title">
                    <CakeSlice />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.source}</small>
                    </span>
                  </div>
                  <dl>
                    <div><dt>Custo</dt><dd>{money(item.cost)}</dd></div>
                    <div>
                      <dt>Venda</dt>
                      <dd>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          aria-label={`Preço de venda de ${item.name}`}
                          onChange={(event) =>
                            updatePrice(item.id, Number(event.target.value))
                          }
                        />
                      </dd>
                    </div>
                    <div><dt>Lucro</dt><dd>{money(item.price - item.cost)}</dd></div>
                    <div><dt>Margem</dt><dd>{currentMargin.toFixed(2)}%</dd></div>
                  </dl>
                  <small className="homologation-settings-margin-note">
                    Margem mínima: {item.minimumMargin}% · {lowMargin ? "revisar preço" : "margem adequada"}
                  </small>
                </article>
              );
            })}
          </div>

          <button
            type="button"
            className="homologation-settings-save"
            onClick={() => visualSave("Preços e margens revisados.")}
          >
            <Save /> Salvar preços de venda
          </button>
        </div>
      ) : null}

      {activeArea === "cakes" ? (
        <div className="homologation-settings-panel">
          <header>
            <Layers3 />
            <div>
              <small>Fabricação e personalização</small>
              <h3>Montagem das tortas</h3>
            </div>
          </header>

          <div className="homologation-settings-cake-summary">
            <article><span>Camadas de bolo</span><strong>3</strong><small>Massas iguais ou diferentes</small></article>
            <article><span>Camadas de recheio</span><strong>2</strong><small>Recheios iguais ou diferentes</small></article>
            <article><span>Opções publicadas</span><strong>18</strong><small>Massas, recheios, frutas e adicionais</small></article>
            <article><span>Margem mínima</span><strong>35%</strong><small>Protegida pelo cálculo do servidor</small></article>
          </div>

          <div className="homologation-settings-cake-actions">
            <button type="button" onClick={() => visualSave("Cadastro de massas aberto.")}><CakeSlice /><span><strong>Massas</strong><small>Chocolate, branca, Red Velvet e outras</small></span></button>
            <button type="button" onClick={() => visualSave("Cadastro de recheios aberto.")}><Layers3 /><span><strong>Recheios</strong><small>Sabores, custo por camada e disponibilidade</small></span></button>
            <button type="button" onClick={() => visualSave("Cadastro de cobertura aberto.")}><Camera /><span><strong>Coberturas e decoração</strong><small>Frutas, chocolates, biscoitos e adicionais</small></span></button>
            <button type="button" onClick={() => visualSave("Simulador interno aberto.")}><CircleDollarSign /><span><strong>Simulador interno</strong><small>Composição, custo, venda, lucro e margem</small></span></button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
