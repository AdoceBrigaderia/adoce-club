import OperationCosts from "./OperationCosts";

export default function OperationPurchasingInventory() {
  return (
    <section aria-labelledby="purchasing-inventory-title">
      <div className="operation-title">
        <div>
          <span>Compras e produção</span>
          <h1 id="purchasing-inventory-title">Compras e Estoque</h1>
          <p>Notas, insumos, preparações, fichas e planejamento de compras.</p>
        </div>
      </div>
      <p className="adoce-cost-notice" role="note">
        O estoque de insumos ainda não é controlado pelo sistema. Nesta fase, os cadastros e fichas servem ao cálculo de custos e ao planejamento das compras.
      </p>
      <OperationCosts />
    </section>
  );
}
