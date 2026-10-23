import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { requireSupabase } from "./lib/supabase";

type MenuRow = {
  id: string;
  quantity_planned: number | null;
  quantity_released: number | null;
  status: "published" | "sold_out" | "hidden";
};

type ProductionReleaseResult = {
  released_items: number;
  released_total: number;
  already_released: boolean;
};

// Unico lugar do sistema que confirma a producao planejada do dia e soma ao
// estoque disponivel (RPC staff_release_weekly_production). Extraido de
// WeeklyMenuAdmin.tsx (removido - nunca estava ligado ao app) para ficar
// dentro da aba "Produção de hoje", que e onde o atalho do painel inicial
// ("X fatias aguardam liberação") ja leva o operador.
export default function ProductionReleasePanel({ today, onReleased }: { today: string; onReleased: () => Promise<void> | void }) {
  const [items, setItems] = useState<MenuRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await requireSupabase()
      .from("weekly_service_menu")
      .select("id,quantity_planned,quantity_released,status")
      .eq("service_date", today);
    if (error) return setNotice(error.message);
    setItems((data || []) as MenuRow[]);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingReleaseItems = items.filter(
    (item) => item.status === "published" && item.quantity_planned !== null && item.quantity_planned > (item.quantity_released || 0),
  );
  const pendingReleaseTotal = pendingReleaseItems.reduce(
    (sum, item) => sum + Math.max((item.quantity_planned || 0) - (item.quantity_released || 0), 0),
    0,
  );

  const releaseProduction = async () => {
    if (!pendingReleaseItems.length) return;
    const confirmed = window.confirm(
      `Confirmar que ${pendingReleaseTotal} fatia(s) de ${pendingReleaseItems.length} sabor(es) foram produzidas?\n\nElas serão somadas às sobras que já existem no estoque. Esta ação não apaga nem substitui o saldo atual.`,
    );
    if (!confirmed) return;
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("staff_release_weekly_production", {
      release_date: today,
      release_item_ids: pendingReleaseItems.map((item) => item.id),
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = data as ProductionReleaseResult;
    setNotice(
      result.already_released
        ? "Esta produção já havia sido liberada. Nenhuma unidade foi duplicada."
        : `${result.released_total} fatia(s) de ${result.released_items} sabor(es) foram somadas ao estoque disponível.`,
    );
    await load();
    await onReleased();
  };

  if (!items.length) return null;

  return (
    <div className={pendingReleaseItems.length ? "weekly-production-release is-pending" : "weekly-production-release is-complete"}>
      <div>
        {pendingReleaseItems.length ? <AlertTriangle /> : <PackageCheck />}
        <span>
          <strong>{pendingReleaseItems.length ? "Produção planejada aguardando sua confirmação" : "Produção do dia já conferida"}</strong>
          <small>
            {pendingReleaseItems.length
              ? `${pendingReleaseTotal} fatia(s) ainda não entraram no estoque. Confira a produção antes de liberar.`
              : "Nada será acrescentado novamente até que o planejamento aumente."}
          </small>
        </span>
      </div>
      <button className="admin-primary" type="button" disabled={busy || !pendingReleaseItems.length} onClick={() => void releaseProduction()}>
        <PackageCheck /> Confirmar produção e liberar estoque
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  );
}
