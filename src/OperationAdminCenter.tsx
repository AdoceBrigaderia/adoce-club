import { useState } from "react";
import {
  Building2,
  CakeSlice,
  CircleDollarSign,
  ClipboardList,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import OperationBusinessStructureBff from "./OperationBusinessStructureBff";
import OperationCakeBuilderSettings from "./OperationCakeBuilderSettings";
import OperationCostCatalog from "./OperationCostCatalog";
import OperationGlobalSettingsBff from "./OperationGlobalSettingsBff";
import OperationProductProfitability from "./OperationProductProfitability";
import OperationServiceRequestPricingSnapshot from "./OperationServiceRequestPricingSnapshot";
import "./operation-admin-center.css";

type AdminArea =
  | "global"
  | "costs"
  | "profitability"
  | "cakes"
  | "history"
  | "structure";

type AdminAreaDefinition = {
  id: AdminArea;
  label: string;
  description: string;
  icon: typeof Settings2;
};

const areas: AdminAreaDefinition[] = [
  {
    id: "global",
    label: "Configurações globais",
    description: "Reservas, pagamentos e taxas",
    icon: SlidersHorizontal,
  },
  {
    id: "costs",
    label: "Itens e custos",
    description: "Fabricação, compras, acervo e serviços",
    icon: CircleDollarSign,
  },
  {
    id: "profitability",
    label: "Rentabilidade",
    description: "Custo, venda, lucro e margem por produto",
    icon: TrendingUp,
  },
  {
    id: "cakes",
    label: "Montagem das tortas",
    description: "Camadas, sabores, frutas e adicionais",
    icon: CakeSlice,
  },
  {
    id: "history",
    label: "Valores das encomendas",
    description: "Snapshots históricos de custo e preço",
    icon: ClipboardList,
  },
  {
    id: "structure",
    label: "Lojas, caixas e equipe",
    description: "Estrutura, funções e permissões",
    icon: Building2,
  },
];

export default function OperationAdminCenter({ userId }: { userId: string }) {
  const [activeArea, setActiveArea] = useState<AdminArea>("global");

  return (
    <section className="operation-admin-center" aria-labelledby="operation-admin-title">
      <header className="operation-admin-heading">
        <div>
          <small>Administração central</small>
          <h2 id="operation-admin-title">Configurações da Adoce</h2>
          <p>
            Regras globais, custos, margens, tortas e estrutura ficam em uma única
            central, com acesso rápido para proprietário e gerente.
          </p>
        </div>
        <Settings2 />
      </header>

      <nav className="operation-admin-navigation" aria-label="Configurações da operação">
        {areas.map(({ id, label, description, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={activeArea === id ? "active" : ""}
            aria-pressed={activeArea === id}
            onClick={() => setActiveArea(id)}
          >
            <Icon />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="operation-admin-workspace" aria-live="polite">
        {activeArea === "global" ? <OperationGlobalSettingsBff /> : null}
        {activeArea === "costs" ? <OperationCostCatalog /> : null}
        {activeArea === "profitability" ? <OperationProductProfitability /> : null}
        {activeArea === "cakes" ? <OperationCakeBuilderSettings /> : null}
        {activeArea === "history" ? <OperationServiceRequestPricingSnapshot /> : null}
        {activeArea === "structure" ? (
          <OperationBusinessStructureBff userId={userId} />
        ) : null}
      </div>
    </section>
  );
}
