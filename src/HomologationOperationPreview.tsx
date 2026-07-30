import { useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CakeSlice,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import HomologationOperationSettings from "./HomologationOperationSettings";
import "./operation-dashboard.css";
import "./homologation-access-preview.css";

type OperationSection =
  | "sale"
  | "loyalty"
  | "cash"
  | "customers"
  | "orders"
  | "production"
  | "reports"
  | "structure"
  | "settings";

const products = [
  { id: "chocolatudo", name: "Chocolatudo", price: 16 },
  { id: "red-velvet", name: "Red Velvet", price: 16 },
  { id: "ninho-morango", name: "Ninho com morango", price: 16 },
  { id: "ferrero", name: "Ferrero", price: 20 },
];

const menu: Array<{
  id: OperationSection;
  label: string;
  description: string;
  icon: typeof ShoppingCart;
}> = [
  {
    id: "sale",
    label: "Venda rápida",
    description: "Produtos, quantidades e pagamento",
    icon: ShoppingCart,
  },
  {
    id: "loyalty",
    label: "Fidelidade",
    description: "+1, +2, +3 ou quantidade livre",
    icon: CakeSlice,
  },
  {
    id: "cash",
    label: "Caixa",
    description: "Suprimento, sangria, despesa e ajuste",
    icon: WalletCards,
  },
  {
    id: "customers",
    label: "Clientes",
    description: "Busca, QR, check-in e CRM 360°",
    icon: UserRound,
  },
  {
    id: "orders",
    label: "Pedidos",
    description: "Reservas e encomendas",
    icon: CalendarDays,
  },
  {
    id: "production",
    label: "Produção",
    description: "Disponibilidade e fabricação",
    icon: PackageCheck,
  },
  {
    id: "reports",
    label: "Relatórios",
    description: "Loja, caixa, operador e canal",
    icon: TrendingUp,
  },
  {
    id: "structure",
    label: "Lojas e equipe",
    description: "Caixas, funções e permissões",
    icon: Settings2,
  },
  {
    id: "settings",
    label: "Configurações",
    description: "Globais, fotos, custos e tortas",
    icon: Settings2,
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export default function HomologationOperationPreview() {
  const [active, setActive] = useState<OperationSection>("sale");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState("Pix");
  const [loyalty, setLoyalty] = useState(8);
  const [customerQuery, setCustomerQuery] = useState("");

  const total = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum + (quantities[product.id] || 0) * product.price,
        0,
      ),
    [quantities],
  );

  const setQuantity = (id: string, next: number) =>
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, next),
    }));

  return (
    <main className="homologation-operation-preview">
      <header className="homologation-operation-header">
        <a href="/#inicio">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <span>
            <strong>Adoce Operação</strong>
            <small>Central demonstrativa</small>
          </span>
        </a>
        <span className="homologation-preview-pill">Modo visual</span>
      </header>

      <section className="homologation-preview-notice" role="status">
        <ShieldCheck />
        <div>
          <strong>Operação liberada para validação visual</strong>
          <p>
            Todos os números são fictícios. Os botões permitem testar o fluxo,
            mas nenhuma venda, configuração, foto, carimbo ou movimento será
            gravado.
          </p>
        </div>
      </section>

      <section className="operation-dashboard-heading homologation-operation-heading">
        <div>
          <span>Visão do dia</span>
          <h1>Central da operação</h1>
          <p>
            Venda, fidelidade, caixa, clientes, produção e configurações com
            botões grandes e poucos toques.
          </p>
        </div>
        <div className="homologation-operation-status">
          <Store />
          <span>
            <small>Loja ativa</small>
            <strong>Passaré</strong>
          </span>
        </div>
      </section>

      <nav className="homologation-operation-menu" aria-label="Áreas da operação">
        {menu.map(({ id, label, description, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => setActive(id)}
          >
            <Icon />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight />
          </button>
        ))}
      </nav>

      <section className="homologation-operation-workspace" aria-live="polite">
        {active === "sale" ? (
          <>
            <header>
              <div>
                <small>Atendimento em poucos toques</small>
                <h2>Venda rápida</h2>
              </div>
              <ShoppingCart />
            </header>
            <div className="homologation-sale-products">
              {products.map((product) => {
                const quantity = quantities[product.id] || 0;
                return (
                  <article key={product.id} className={quantity ? "selected" : ""}>
                    <div>
                      <CakeSlice />
                      <span>
                        <strong>{product.name}</strong>
                        <small>{money(product.price)}</small>
                      </span>
                    </div>
                    <div className="homologation-quantity-control">
                      <button
                        type="button"
                        aria-label={`Remover ${product.name}`}
                        onClick={() => setQuantity(product.id, quantity - 1)}
                      >
                        <Minus />
                      </button>
                      <strong>{quantity}</strong>
                      <button
                        type="button"
                        aria-label={`Adicionar ${product.name}`}
                        onClick={() => setQuantity(product.id, quantity + 1)}
                      >
                        <Plus />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="homologation-sale-summary">
              <div>
                <span>Total demonstrativo</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="homologation-payment-options">
                {["Pix", "Débito", "Crédito", "Dinheiro"].map((item) => (
                  <button
                    type="button"
                    className={payment === item ? "active" : ""}
                    onClick={() => setPayment(item)}
                    key={item}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="homologation-primary-action"
                disabled={!total}
              >
                <CheckIcon /> Concluir venda demonstrativa
              </button>
            </div>
          </>
        ) : null}

        {active === "loyalty" ? (
          <>
            <header>
              <div>
                <small>Sem lançar venda</small>
                <h2>Fidelidade manual</h2>
              </div>
              <CakeSlice />
            </header>
            <label className="homologation-search">
              <Search />
              <input placeholder="Nome, WhatsApp ou código do cliente" />
            </label>
            <article className="homologation-customer-card">
              <UserRound />
              <div>
                <small>Cliente localizado</small>
                <strong>Cliente de demonstração</strong>
                <span>{loyalty} de 14 carimbos</span>
              </div>
            </article>
            <div className="homologation-loyalty-actions">
              {[1, 2, 3].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  onClick={() =>
                    setLoyalty((current) => Math.min(14, current + amount))
                  }
                >
                  +{amount}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLoyalty((current) => Math.max(0, current - 1))}
              >
                −1
              </button>
            </div>
            <label>
              Motivo rápido
              <select defaultValue="atendimento">
                <option value="atendimento">Atendimento sem venda lançada</option>
                <option value="correcao">Correção auditada</option>
                <option value="cortesia">Cortesia autorizada</option>
              </select>
            </label>
          </>
        ) : null}

        {active === "cash" ? (
          <>
            <header>
              <div>
                <small>Caixa principal · aberto</small>
                <h2>Movimentações rápidas</h2>
              </div>
              <CircleDollarSign />
            </header>
            <div className="homologation-cash-balance">
              <small>Saldo demonstrativo</small>
              <strong>R$ 486,00</strong>
              <span>Aberto às 18:02 por Rubens</span>
            </div>
            <div className="homologation-operation-buttons">
              <button type="button">
                <Plus />
                <span>
                  <strong>Suprimento</strong>
                  <small>Adicionar valor ao caixa</small>
                </span>
              </button>
              <button type="button">
                <Minus />
                <span>
                  <strong>Sangria</strong>
                  <small>Retirar valor do caixa</small>
                </span>
              </button>
              <button type="button">
                <Banknote />
                <span>
                  <strong>Despesa</strong>
                  <small>Registrar gasto da operação</small>
                </span>
              </button>
              <button type="button">
                <ClipboardList />
                <span>
                  <strong>Ajuste</strong>
                  <small>Correção com motivo e auditoria</small>
                </span>
              </button>
            </div>
          </>
        ) : null}

        {active === "customers" ? (
          <>
            <header>
              <div>
                <small>Cliente 360°</small>
                <h2>Localizar cliente</h2>
              </div>
              <QrCode />
            </header>
            <label className="homologation-search">
              <Search />
              <input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Nome, WhatsApp, código ou QR"
              />
            </label>
            <div className="homologation-operation-buttons">
              <button type="button">
                <QrCode />
                <span>
                  <strong>Ler QR</strong>
                  <small>Identificar o cartão digital</small>
                </span>
              </button>
              <button type="button">
                <SmartphoneIcon />
                <span>
                  <strong>Clientes presentes</strong>
                  <small>Check-ins recentes do caixa</small>
                </span>
              </button>
              <button type="button">
                <UserRound />
                <span>
                  <strong>CRM 360°</strong>
                  <small>Histórico, pedidos, carimbos e notas</small>
                </span>
              </button>
            </div>
            {customerQuery ? (
              <p className="homologation-inline-result">
                Resultado demonstrativo: Cliente Adoce · 9/14 carimbos · última
                compra sábado.
              </p>
            ) : null}
          </>
        ) : null}

        {active === "orders" ? (
          <>
            <header>
              <div>
                <small>Agenda comercial</small>
                <h2>Pedidos e encomendas</h2>
              </div>
              <CalendarDays />
            </header>
            <div className="homologation-list">
              <article>
                <span>Hoje · 20:30</span>
                <strong>Reserva de 4 fatias</strong>
                <small>Pagamento pendente · retirada no Passaré</small>
              </article>
              <article>
                <span>Amanhã · 15:00</span>
                <strong>Torta personalizada</strong>
                <small>Montagem definida · sinal confirmado</small>
              </article>
              <article>
                <span>Sábado · 18:00</span>
                <strong>Mini festa</strong>
                <small>Produção em andamento</small>
              </article>
            </div>
          </>
        ) : null}

        {active === "production" ? (
          <>
            <header>
              <div>
                <small>Fabricação e disponibilidade</small>
                <h2>Produção do dia</h2>
              </div>
              <PackageCheck />
            </header>
            <div className="homologation-list">
              <article>
                <span>Chocolatudo</span>
                <strong>26 fatias planejadas</strong>
                <small>18 liberadas · 8 em produção</small>
              </article>
              <article>
                <span>Red Velvet</span>
                <strong>13 fatias planejadas</strong>
                <small>13 liberadas</small>
              </article>
              <article>
                <span>Encomendas</span>
                <strong>2 tortas em fabricação</strong>
                <small>Montagens e custos detalhados</small>
              </article>
            </div>
          </>
        ) : null}

        {active === "reports" ? (
          <>
            <header>
              <div>
                <small>Dados para decidir</small>
                <h2>Relatórios</h2>
              </div>
              <TrendingUp />
            </header>
            <div className="homologation-metrics">
              <article>
                <small>Vendas de hoje</small>
                <strong>R$ 1.248,00</strong>
                <span>+12% sobre sábado passado</span>
              </article>
              <article>
                <small>Ticket médio</small>
                <strong>R$ 38,90</strong>
                <span>32 atendimentos</span>
              </article>
              <article>
                <small>Carimbos lançados</small>
                <strong>47</strong>
                <span>6 ajustes manuais auditados</span>
              </article>
              <article>
                <small>Despesas</small>
                <strong>R$ 86,00</strong>
                <span>2 lançamentos</span>
              </article>
            </div>
          </>
        ) : null}

        {active === "structure" ? (
          <>
            <header>
              <div>
                <small>Administração</small>
                <h2>Lojas, caixas e equipe</h2>
              </div>
              <Settings2 />
            </header>
            <div className="homologation-operation-buttons">
              <button type="button">
                <Store />
                <span>
                  <strong>Loja Passaré</strong>
                  <small>Ativa · fuso de Fortaleza</small>
                </span>
              </button>
              <button type="button">
                <CircleDollarSign />
                <span>
                  <strong>Caixa principal</strong>
                  <small>Aberto · operação presencial</small>
                </span>
              </button>
              <button type="button">
                <Users />
                <span>
                  <strong>Equipe</strong>
                  <small>Owner, manager, cashier, production e viewer</small>
                </span>
              </button>
              <button type="button">
                <ShieldCheck />
                <span>
                  <strong>Permissões</strong>
                  <small>Menor privilégio por loja e ação</small>
                </span>
              </button>
            </div>
          </>
        ) : null}

        {active === "settings" ? <HomologationOperationSettings /> : null}
      </section>
    </main>
  );
}

function CheckIcon() {
  return <ShieldCheck aria-hidden="true" />;
}

function SmartphoneIcon() {
  return <QrCode aria-hidden="true" />;
}
