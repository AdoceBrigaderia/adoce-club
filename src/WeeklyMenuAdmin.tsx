import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  PackageCheck,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import type { WeeklyMenuItem } from "./WeeklyScheduleDialog";

type AdminFlavor = {
  id: string;
  name: string;
  image_path: string | null;
  active: boolean;
};

type InventorySnapshot = {
  flavor_id: string;
  quantity_available: number | null;
  quantity_reserved: number;
};

type ProductionReleaseResult = {
  released_items: number;
  released_total: number;
  already_released: boolean;
};

function todayInFortaleza() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateAfter(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function friendlyDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function WeeklyMenuAdmin({
  session,
  flavors,
}: {
  session: Session;
  flavors: AdminFlavor[];
}) {
  const today = todayInFortaleza();
  const [items, setItems] = useState<WeeklyMenuItem[]>([]);
  const [inventory, setInventory] = useState<InventorySnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    service_date: today,
    channel_slug: "in_person" as "in_person" | "online_orders",
    flavor_id: "",
    quantity_planned: "",
    status: "published" as WeeklyMenuItem["status"],
    note: "",
  });

  const load = useCallback(async () => {
    const [menuResult, inventoryResult] = await Promise.all([
      requireSupabase()
        .from("weekly_service_menu")
        .select(
          "id,service_date,channel_slug,flavor_id,quantity_planned,quantity_reserved,quantity_released,released_at,released_by,status,note",
        )
        .gte("service_date", today)
        .lte("service_date", dateAfter(today, 13))
        .order("service_date")
        .order("channel_slug"),
      requireSupabase()
        .from("flavor_availability")
        .select("flavor_id,quantity_available,quantity_reserved")
        .eq("service_date", today),
    ]);
    const error = menuResult.error || inventoryResult.error;
    if (error) return setNotice(error.message);
    setItems((menuResult.data || []) as WeeklyMenuItem[]);
    setInventory((inventoryResult.data || []) as InventorySnapshot[]);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFlavors = useMemo(
    () => flavors.filter((flavor) => flavor.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [flavors],
  );
  const visibleItems = items.filter(
    (item) =>
      item.service_date === draft.service_date &&
      item.channel_slug === draft.channel_slug,
  );

  const save = async () => {
    if (!draft.flavor_id) return setNotice("Escolha o sabor que fará parte deste cardápio.");
    const quantity = Number(draft.quantity_planned);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) {
      return setNotice("Informe uma quantidade inteira entre 0 e 9.999 fatias.");
    }
    const current = items.find(
      (item) =>
        item.service_date === draft.service_date &&
        item.channel_slug === draft.channel_slug &&
        item.flavor_id === draft.flavor_id,
    );
    const reserved = current?.quantity_reserved || 0;
    const released = current?.quantity_released || 0;
    if (quantity < reserved) {
      return setNotice(`Já existem ${reserved} fatias reservadas. A quantidade não pode ficar abaixo disso.`);
    }
    if (quantity < released) {
      return setNotice(
        `Você já liberou ${released} fatias desta produção. Para reduzir o estoque físico, faça um ajuste na disponibilidade em vez de diminuir o planejamento.`,
      );
    }
    setBusy(true);
    const { error } = await requireSupabase()
      .from("weekly_service_menu")
      .upsert(
        {
          service_date: draft.service_date,
          channel_slug: draft.channel_slug,
          flavor_id: draft.flavor_id,
          quantity_planned: quantity,
          quantity_reserved: reserved,
          status: quantity === 0 ? "sold_out" : draft.status,
          note: draft.note.trim() || null,
          created_by: session.user.id,
          updated_by: session.user.id,
        },
        { onConflict: "service_date,channel_slug,flavor_id" },
      );
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice("Cardápio da semana atualizado. O cliente já poderá consultar essa data.");
    setDraft((currentDraft) => ({ ...currentDraft, flavor_id: "", quantity_planned: "", note: "" }));
    await load();
  };

  const remove = async (item: WeeklyMenuItem) => {
    const flavor = flavors.find((entry) => entry.id === item.flavor_id);
    if (!window.confirm(`Retirar ${flavor?.name || "este sabor"} do cardápio de ${friendlyDate(item.service_date)}?`)) return;
    const { error } = await requireSupabase().from("weekly_service_menu").delete().eq("id", item.id);
    if (error) return setNotice(error.message);
    setNotice("Sabor retirado deste dia.");
    await load();
  };

  const pendingReleaseItems = visibleItems.filter(
    (item) =>
      item.service_date === today &&
      item.channel_slug === "online_orders" &&
      item.status === "published" &&
      item.quantity_planned !== null &&
      item.quantity_planned > (item.quantity_released || 0),
  );
  const pendingReleaseTotal = pendingReleaseItems.reduce(
    (sum, item) =>
      sum +
      Math.max(
        (item.quantity_planned || 0) - (item.quantity_released || 0),
        0,
      ),
    0,
  );

  const releaseProduction = async () => {
    if (!pendingReleaseItems.length) {
      setNotice(
        "Toda a produção planejada para retirada neste dia já foi liberada.",
      );
      return;
    }
    const confirmed = window.confirm(
      `Confirmar que ${pendingReleaseTotal} fatia(s) de ${pendingReleaseItems.length} sabor(es) foram produzidas?\n\nElas serão somadas às sobras que já existem no estoque. Esta ação não apaga nem substitui o saldo atual.`,
    );
    if (!confirmed) return;
    setBusy(true);
    const { data, error } = await requireSupabase().rpc(
      "staff_release_weekly_production",
      {
        release_date: today,
        release_item_ids: pendingReleaseItems.map((item) => item.id),
      },
    );
    setBusy(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const result = data as ProductionReleaseResult;
    setNotice(
      result.already_released
        ? "Esta produção já havia sido liberada. Nenhuma unidade foi duplicada."
        : `${result.released_total} fatia(s) de ${result.released_items} sabor(es) foram somadas ao estoque disponível.`,
    );
    await load();
  };

  return (
    <section className="admin-panel weekly-menu-admin">
      <div className="panel-heading">
        <div>
          <small>Planejamento da semana</small>
          <h2>Cardápio por dia e atendimento</h2>
          <p>
            Monte o Festival com antecedência. O que for publicado aqui aparece na agenda que o cliente consulta.
          </p>
        </div>
        <CalendarDays />
      </div>

      <div className="weekly-menu-form">
        <label>
          Dia
          <input
            type="date"
            min={today}
            max={dateAfter(today, 13)}
            value={draft.service_date}
            onChange={(event) => setDraft({ ...draft, service_date: event.target.value })}
          />
        </label>
        <label>
          Como será vendido
          <select
            value={draft.channel_slug}
            onChange={(event) => setDraft({ ...draft, channel_slug: event.target.value as typeof draft.channel_slug })}
          >
            <option value="in_person">Barraquinha de rua</option>
            <option value="online_orders">Pedidos on-line para retirada</option>
          </select>
        </label>
        <label>
          Sabor
          <select
            value={draft.flavor_id}
            onChange={(event) => setDraft({ ...draft, flavor_id: event.target.value })}
          >
            <option value="">Escolha um sabor</option>
            {activeFlavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}
          </select>
        </label>
        <label>
          Quantidade planejada
          <input
            type="number"
            min="0"
            max="9999"
            step="1"
            placeholder="Ex.: 8"
            value={draft.quantity_planned}
            onChange={(event) => setDraft({ ...draft, quantity_planned: event.target.value })}
          />
        </label>
        <label>
          Exibição
          <select
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as WeeklyMenuItem["status"] })}
          >
            <option value="published">Mostrar ao cliente</option>
            <option value="sold_out">Mostrar como esgotado</option>
            <option value="hidden">Guardar sem publicar</option>
          </select>
        </label>
        <button className="admin-primary" type="button" disabled={busy} onClick={() => void save()}>
          <Plus /> Adicionar ao dia
        </button>
      </div>

      <div className="weekly-menu-scope">
        <Store />
        <span>
          <strong>{friendlyDate(draft.service_date)}</strong>
          <small>{draft.channel_slug === "in_person" ? "Barraquinha de rua" : "Pedidos on-line para retirada"}</small>
        </span>
      </div>

      {draft.service_date === today &&
      draft.channel_slug === "online_orders" ? (
        <div
          className={`weekly-production-release ${
            pendingReleaseItems.length ? "is-pending" : "is-complete"
          }`}
        >
          <div>
            {pendingReleaseItems.length ? (
              <AlertTriangle />
            ) : (
              <PackageCheck />
            )}
            <span>
              <strong>
                {pendingReleaseItems.length
                  ? "Produção planejada aguardando sua confirmação"
                  : "Produção do dia já conferida"}
              </strong>
              <small>
                {pendingReleaseItems.length
                  ? `${pendingReleaseTotal} fatia(s) ainda não entraram no estoque. Confira a produção antes de liberar.`
                  : "Nada será acrescentado novamente até que o planejamento aumente."}
              </small>
            </span>
          </div>
          <button
            className="admin-primary"
            type="button"
            disabled={busy || !pendingReleaseItems.length}
            onClick={() => void releaseProduction()}
          >
            <PackageCheck />
            Confirmar produção e liberar estoque
          </button>
        </div>
      ) : null}

      <div className="weekly-menu-list">
        {visibleItems.map((item) => {
          const flavor = flavors.find((entry) => entry.id === item.flavor_id);
          const free = item.quantity_planned === null ? null : Math.max(item.quantity_planned - item.quantity_reserved, 0);
          const released = item.quantity_released || 0;
          const pending = Math.max(
            (item.quantity_planned || 0) - released,
            0,
          );
          const stock = inventory.find(
            (entry) => entry.flavor_id === item.flavor_id,
          );
          const physicalFree =
            stock?.quantity_available === null ||
            stock?.quantity_available === undefined
              ? null
              : Math.max(
                  stock.quantity_available - stock.quantity_reserved,
                  0,
                );
          return (
            <article key={item.id}>
              <img src={flavor?.image_path || "/adoce-hoje/sabores-hoje.webp"} alt="" />
              <span>
                <strong>{flavor?.name || "Sabor"}</strong>
                <small>
                  {free === null ? "Quantidade sob consulta" : `${free} livre(s) · ${item.quantity_reserved} reservada(s)`}
                </small>
                {item.service_date === today &&
                item.channel_slug === "online_orders" ? (
                  <small className="weekly-menu-release-status">
                    {pending > 0
                      ? `${pending} planejada(s) aguardando liberação`
                      : `${released} produzida(s) e liberada(s)`}
                    {physicalFree !== null
                      ? ` · estoque físico atual: ${physicalFree}`
                      : ""}
                  </small>
                ) : null}
              </span>
              <em>{item.status === "published" ? "Visível" : item.status === "sold_out" ? "Esgotado" : "Oculto"}</em>
              <button className="icon-button danger" type="button" onClick={() => void remove(item)} aria-label={`Retirar ${flavor?.name || "sabor"} deste dia`}>
                <Trash2 />
              </button>
            </article>
          );
        })}
        {!visibleItems.length ? (
          <p className="hour-empty-state">Nenhum sabor cadastrado para esta data e modalidade.</p>
        ) : null}
      </div>
      {notice ? <div className="weekly-menu-notice"><Check /> {notice}</div> : null}
    </section>
  );
}
