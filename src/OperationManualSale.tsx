import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { resolvePublicImageSource } from "./public-image-fallbacks";
import { bffRpc } from "./services/bff-rpc";
import "./operation-commerce-tools.css";

type Flavor = {
  id: string;
  name: string;
  base_price: number;
  image_path: string | null;
  remaining: number;
};
type Method = { code: string; label: string; active: boolean };
type OpenCashSession = {
  id: string;
  store_id: string;
  register_id: string;
  status: string;
  opened_at: string;
};
type CashRegister = { id: string; store_id: string; name: string; active: boolean };
type StoreRow = { id: string; name: string; active: boolean };
type CashWorkspace = {
  sessions?: OpenCashSession[];
  registers?: CashRegister[];
  stores?: StoreRow[];
};
type QuickSaleCatalog = {
  service_date?: string;
  flavors?: Flavor[];
  payment_methods?: Method[];
};

const dateKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(
    new Date(),
  );
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationManualSale({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [cashSessions, setCashSessions] = useState<OpenCashSession[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [cashSessionId, setCashSessionId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [catalog, workspace] = await Promise.all([
        bffRpc<QuickSaleCatalog>("staff_get_quick_sale_catalog", {
          service_date: dateKey(),
        }),
        bffRpc<CashWorkspace>("staff_get_business_workspace"),
      ]);
      const nextFlavors = (catalog.flavors || []).map((flavor) => ({
        ...flavor,
        base_price: Number(flavor.base_price),
        remaining: Number(flavor.remaining),
      }));
      const activeMethods = (catalog.payment_methods || []).filter(
        (item) => item.active,
      );
      const opened = (workspace.sessions || []).filter(
        (item) => item.status === "open",
      );

      setFlavors(nextFlavors);
      setMethods(activeMethods);
      setRegisters(workspace.registers || []);
      setStores(workspace.stores || []);
      setCashSessions(opened);
      setMethod((current) =>
        activeMethods.some((item) => item.code === current)
          ? current
          : activeMethods[0]?.code || "",
      );
      setCashSessionId((current) =>
        opened.some((item) => item.id === current)
          ? current
          : opened[0]?.id || "",
      );
      if (!opened.length) {
        setNotice("Abra um caixa para registrar a venda presencial.");
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a venda rápida.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const filteredFlavors = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return flavors;
    return flavors.filter((flavor) =>
      flavor.name.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [flavors, query]);

  const items = useMemo(
    () =>
      flavors
        .filter((flavor) => (quantities[flavor.id] || 0) > 0)
        .map((flavor) => ({
          flavor_id: flavor.id,
          quantity: quantities[flavor.id],
        })),
    [flavors, quantities],
  );
  const selectedCount = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );
  const total = useMemo(
    () =>
      flavors.reduce(
        (sum, flavor) =>
          sum + flavor.base_price * (quantities[flavor.id] || 0),
        0,
      ),
    [flavors, quantities],
  );

  const setQuantity = (flavor: Flavor, value: number) =>
    setQuantities((current) => ({
      ...current,
      [flavor.id]: Math.max(0, Math.min(flavor.remaining, value)),
    }));

  const cashSessionLabel = (cash: OpenCashSession) => {
    const register = registers.find((item) => item.id === cash.register_id);
    const store = stores.find((item) => item.id === cash.store_id);
    return `${store?.name || "Loja"} · ${register?.name || "Caixa"}`;
  };

  const submit = async () => {
    if (!cashSessionId)
      return setNotice("Abra e selecione um caixa antes de registrar a venda.");
    if (!items.length) return setNotice("Toque nos produtos para montar a venda.");
    if (!method) return setNotice("Escolha a forma de pagamento.");

    setBusy(true);
    setNotice("");
    try {
      const data = await bffRpc<{ order_number?: string }>(
        "staff_create_manual_sale_in_cash",
        {
          target_session_id: cashSessionId,
          requested_customer_name: name,
          requested_customer_phone: phone,
          requested_items: items,
          requested_payment_method: method,
          requested_notes: notes,
        },
      );
      setNotice(
        `Venda ${data?.order_number || ""} registrada, estoque baixado e caixa atualizado.`,
      );
      setQuantities({});
      setName("");
      setPhone("");
      setNotes("");
      setQuery("");
      onCreated();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível registrar a venda.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="commerce-primary-action manual-sale-open"
        type="button"
        onClick={() => setOpen(true)}
      >
        <ShoppingBag /> Venda rápida
      </button>
      {open ? (
        <div className="instant-order-operation-layer">
          <button
            className="instant-order-operation-backdrop"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <aside
            className="manual-sale-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Venda rápida"
          >
            <button
              className="drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X />
            </button>
            <small>Atendimento em poucos toques</small>
            <h2>Venda rápida</h2>
            <p>Toque no produto para adicionar uma unidade. O botão final registra venda, pagamento, estoque e caixa de uma vez.</p>

            {notice ? (
              <p className="operation-commercial-notice" role="status">
                {notice}
              </p>
            ) : null}

            <div className="manual-sale-context">
              <label>
                Caixa da venda
                <select
                  value={cashSessionId}
                  onChange={(event) => {
                    setCashSessionId(event.target.value);
                    setNotice("");
                  }}
                >
                  <option value="">Selecione um caixa aberto</option>
                  {cashSessions.map((cash) => (
                    <option value={cash.id} key={cash.id}>
                      {cashSessionLabel(cash)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="manual-sale-search">
                Buscar produto
                <span>
                  <Search />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Digite parte do sabor"
                  />
                </span>
              </label>
            </div>

            {!cashSessions.length ? (
              <div className="manual-sale-cash-warning">
                <LockKeyhole />
                <span>
                  <strong>Nenhum caixa aberto</strong>
                  <small>Abra o caixa na Central da Operação.</small>
                </span>
              </div>
            ) : null}

            <div className="manual-sale-product-grid" aria-busy={loading}>
              {loading ? <p>Carregando produtos…</p> : null}
              {!loading && !filteredFlavors.length ? (
                <p>Nenhum produto disponível para esta busca.</p>
              ) : null}
              {filteredFlavors.map((flavor) => {
                const quantity = quantities[flavor.id] || 0;
                return (
                  <article
                    className={`manual-sale-product-card${quantity ? " selected" : ""}`}
                    key={flavor.id}
                  >
                    <button
                      type="button"
                      className="manual-sale-product-main"
                      onClick={() => setQuantity(flavor, quantity + 1)}
                      disabled={quantity >= flavor.remaining}
                    >
                      <img
                        src={resolvePublicImageSource(flavor.image_path, flavor.name)}
                        alt={flavor.name}
                        onError={(event) => {
                          event.currentTarget.src = resolvePublicImageSource(null, flavor.name);
                        }}
                      />
                      <span>
                        <strong>{flavor.name}</strong>
                        <small>{money(flavor.base_price)} · {flavor.remaining} disponível(is)</small>
                      </span>
                      {quantity ? <b>{quantity}</b> : <Plus />}
                    </button>
                    <div className="manual-sale-product-controls">
                      <button
                        type="button"
                        onClick={() => setQuantity(flavor, quantity - 1)}
                        disabled={!quantity}
                        aria-label={`Remover uma unidade de ${flavor.name}`}
                      >
                        <Minus />
                      </button>
                      <strong>{quantity}</strong>
                      <button
                        type="button"
                        onClick={() => setQuantity(flavor, quantity + 1)}
                        disabled={quantity >= flavor.remaining}
                        aria-label={`Adicionar uma unidade de ${flavor.name}`}
                      >
                        <Plus />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="manual-sale-payment">
              <small>Forma de pagamento</small>
              <div>
                {methods.map((item) => (
                  <button
                    type="button"
                    key={item.code}
                    className={method === item.code ? "active" : ""}
                    aria-pressed={method === item.code}
                    onClick={() => setMethod(item.code)}
                  >
                    {method === item.code ? <Check /> : null}
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <details className="manual-sale-optional">
              <summary>Cliente e observações opcionais</summary>
              <div>
                <label>
                  Nome do cliente
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex.: Cliente do atendimento"
                  />
                </label>
                <label>
                  Celular
                  <input
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="DDD + número"
                  />
                </label>
                <label>
                  Observações
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Somente quando necessário"
                  />
                </label>
              </div>
            </details>

            <div className="manual-sale-sticky-total">
              <span>
                <small>{selectedCount} item(ns)</small>
                <strong>{money(total)}</strong>
              </span>
              <button
                className="commerce-primary-action"
                type="button"
                onClick={() => void submit()}
                disabled={busy || !cashSessionId || !selectedCount || !method}
              >
                {busy ? "Registrando…" : `Registrar venda · ${money(total)}`}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
