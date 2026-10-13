import { useMemo, useState } from "react";
import { displayShoppingQuantity, type PlanInvoice, type PlanItem } from "./lib/purchase-planner";
import { weeklyPurchaseGroups } from "./lib/purchase-report";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PurchaseWeeklyReport({ invoices, items }: { invoices: PlanInvoice[]; items: PlanItem[] }) {
  const groups = useMemo(() => weeklyPurchaseGroups(invoices, items), [invoices, items]);
  const [search, setSearch] = useState("");
  const query = search.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return <section className="adoce-cost-list">
    <h4>Comprado por semana</h4>
    <p>Quanto de cada insumo e embalagem foi realmente comprado, somado pelas notas de compra registradas em cada semana. O valor não muda se uma ficha técnica for editada depois.</p>
    <label>Buscar produto<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite para encontrar" /></label>
    {!groups.length && <p className="adoce-items-empty">Nenhuma nota de compra registrada ainda.</p>}
    {groups.map(group => {
      const rows = group.rows.filter(row => row.item.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(query));
      if (!rows.length) return null;
      return <details key={group.week} open={group === groups[0]}>
        <summary>{group.label} · {money(group.total)}</summary>
        <div className="adoce-items-table-scroll"><table className="adoce-items-table">
          <thead><tr><th scope="col">Produto</th><th scope="col">Comprado na semana</th><th scope="col">Gasto</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.itemId}>
            <td data-label="Produto">{row.item.name}</td>
            <td data-label="Comprado na semana">{displayShoppingQuantity(row.quantity, row.item.consumption_unit)}</td>
            <td data-label="Gasto">{money(row.total)}</td>
          </tr>)}</tbody>
        </table></div>
      </details>;
    })}
    {groups.length > 0 && !groups.some(group => group.rows.some(row => row.item.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(query))) &&
      <p className="adoce-items-empty">Nenhum produto encontrado para "{search}".</p>}
  </section>;
}
