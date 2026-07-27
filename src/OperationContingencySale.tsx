import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { resolvePublicImageSource } from "./public-image-fallbacks";
import { bffRpc } from "./services/bff-rpc";
import "./operation-contingency.css";

type Flavor = {
  id: string;
  name: string;
  base_price: number;
  image_path: string | null;
  remaining: number;
};
type Method = { code: string; label: string; active: boolean };
type Store = { id: string; name: string; active: boolean };
type Workspace = { role?: string; stores?: Store[] };
type Catalog = { flavors?: Flavor[]; payment_methods?: Method[] };

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(
    new Date(),
  );
const quickReasons = [
  "Venda não lançada na hora",
  "Caixa não foi aberto",
  "Correção após atendimento",
];

export default function OperationContingencySale() {
  const [workspace, setWorkspace] = useState<Workspace>({});
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [storeId, setStoreId] = useState("");
  const [method, setMethod] = useState("pix");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reason, setReason] = useState(quickReasons[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, nextWorkspace] = await Promise.all([
        bffRpc<Catalog>("staff_get_quick_sale_catalog", {
          service_date: dateKey(),
        }),
        bffRpc<Workspace>("staff_get_business_workspace"),
      ]);
      const activeStores = (nextWorkspace.stores || []).filter(
        (item) => item.active,
      );
      const activeMethods = (catalog.payment_methods || []).filter(
        (item) => item.active,
      );
      setWorkspace(nextWorkspace || {});
      setFlavors(
        (catalog.flavors || []).map((item) => ({
          ...item,
          base_price: Number(item.base_price || 0),
          remaining: Number(item.remaining || 0),
        })),
      );
      setMethods(activeMethods);
      setStoreId((current) =>
        activeStores.some((item) => item.id === current)
          ? current
          : activeStores[0]?.id || "",
      );
      setMethod((current) =>
        activeMethods.some((item) => item.code === current)
          ? current
          : activeMethods[0]?.code || "",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a venda em contingência.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const manager = workspace.role === "owner" || workspace.role === "manager";
  const stores = (workspace.stores || []).filter((item) => item.active);
  const filteredFlavors = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return flavors;
    return flavors.filter((item) =>
      item.name.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [flavors, query]);
  const items = useMemo(
    () =>
      flavors
        .filter((item) => (quantities[item.id] || 0) > 0)
        .map((item) => ({
          flavor_id: item.id,
          quantity: quantities[item.id],
        })),
    [flavors, quantities],
  );
  const total = useMemo(
    () =>
      flavors.reduce(
        (sum, item) =>
          sum + item.base_price * Number(quantities[item.id] || 0),
        0,
      ),
    [flavors, quantities],
  );
  const quantity = useMemo(
    () => Object.values(quantities).reduce((sum, value) => sum + value, 0),
    [quantities],
  );

  const setQuantity = (flavor: Flavor, next: number) =>
    setQuantities((current) => ({
      ...current,
      [flavor.id]: Math.max(0, Math.min(flavor.remaining, next)),
    }));

  const submit = async () => {
    if (!manager)
      return setNotice("Somente proprietário ou gestor pode usar contingência.");
    if (!storeId) return setNotice("Selecione a loja da venda.");
    if (!items.length) return setNotice("Toque nos produtos vendidos.");
    if (!method) return setNotice("Selecione a forma de pagamento.");
    if (reason.trim().length < 3) return setNotice("Informe o motivo.");

    setBusy(true);
    setNotice("");
    try {
      const result = await bffRpc<{
        order_number?: string;
        reconciliation_id?: string;
      }>("manager_create_manual_sale_for_reconciliation", {
        target_store_id: storeId,
        requested_customer_name: customerName,
        requested_customer_phone: customerPhone,
        requested_items: items,
        requested_payment_method: method,
        operation_key: `contingency-sale:${crypto.randomUUID()}`,
        requested_notes: notes,
        reconciliation_reason: reason.trim(),
      });
      setNotice(
        `Venda ${result.order_number || ""} registrada. Ela já baixou o estoque e ficou na fila para vincular ao próximo caixa aberto.`,
      );
      setQuantities({});
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setQuery("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a venda em contingência.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !manager) return null;

  return (
    <details className="contingency-sale">
      <summary>
        <span>
          <Clock3 />
          <strong>Venda esquecida / sem caixa</strong>
          <small>Registre agora e reconcilie depois, sem perder estoque ou histórico.</small>
        </span>
        <AlertTriangle />
      </summary>

      <div className="contingency-sale-body">
        {notice ? (
          <p className="contingency-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="contingency-context">
          <label>
            Loja
            <select
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              disabled={loading || busy}
            >
              <option value="">Selecione</option>
              {stores.map((store) => (
                <option value={store.id} key={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="contingency-search">
            Buscar produto
            <span>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome do sabor"
              />
            </span>
          </label>
        </div>

        <div className="contingency-products" aria-busy={loading}>
          {loading ? <p>Carregando produtos…</p> : null}
          {!loading && !filteredFlavors.length ? (
            <p>Nenhum produto disponível.</p>
          ) : null}
          {filteredFlavors.map((flavor) => {
            const selected = quantities[flavor.id] || 0;
            return (
              <article
                className={selected ? "selected" : ""}
                key={flavor.id}
              >
                <button
                  type="button"
                  className="contingency-product-main"
                  onClick={() => setQuantity(flavor, selected + 1)}
                  disabled={selected >= flavor.remaining}
                >
                  <img
                    src={resolvePublicImageSource(
                      flavor.image_path,
                      flavor.name,
                    )}
                    alt={flavor.name}
                  />
                  <span>
                    <strong>{flavor.name}</strong>
                    <small>
                      {money(flavor.base_price)} · {flavor.remaining} disponível(is)
                    </small>
                  </span>
                  {selected ? <b>{selected}</b> : <Plus />}
                </button>
                <div className="contingency-quantity">
                  <button
                    type="button"
                    onClick={() => setQuantity(flavor, selected - 1)}
                    disabled={!selected}
                    aria-label={`Remover ${flavor.name}`}
                  >
                    <Minus />
                  </button>
                  <strong>{selected}</strong>
                  <button
                    type="button"
                    onClick={() => setQuantity(flavor, selected + 1)}
                    disabled={selected >= flavor.remaining}
                    aria-label={`Adicionar ${flavor.name}`}
                  >
                    <Plus />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <section className="contingency-payment">
          <small>Forma de pagamento recebida</small>
          <div>
            {methods.map((item) => (
              <button
                type="button"
                key={item.code}
                className={method === item.code ? "active" : ""}
                onClick={() => setMethod(item.code)}
              >
                {method === item.code ? <Check /> : null}
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="contingency-reasons">
          <small>Por que ficou para depois?</small>
          <div>
            {quickReasons.map((item) => (
              <button
                type="button"
                key={item}
                className={reason === item ? "active" : ""}
                onClick={() => setReason(item)}
              >
                {reason === item ? <Check /> : null}
                {item}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Outro motivo"
          />
        </section>

        <details className="contingency-optional">
          <summary>Cliente e observações opcionais</summary>
          <div>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Nome do cliente"
            />
            <input
              inputMode="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="WhatsApp"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observação"
            />
          </div>
        </details>

        <button
          type="button"
          className="contingency-submit"
          onClick={() => void submit()}
          disabled={busy || !quantity || !storeId || !method}
        >
          {busy
            ? "Registrando…"
            : `Registrar para reconciliar · ${money(total)}`}
        </button>
      </div>
    </details>
  );
}
