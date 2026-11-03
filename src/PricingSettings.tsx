import { useCallback, useEffect, useState } from "react";
import { CakeSlice, Save } from "lucide-react";
import { confirmAction } from "./lib/confirm-dialog";
import { requireSupabase } from "./lib/supabase";
import "./operation-commerce-tools.css";

const CAKE_SIZES = [
  { slug: "torta-p", label: "Torta P" },
  { slug: "torta-m", label: "Torta M" },
  { slug: "torta-g", label: "Torta G" },
] as const;
type CakeSlug = (typeof CAKE_SIZES)[number]["slug"];

const parsePrice = (value: string) => Number(value.replace(",", "."));

export default function PricingSettings() {
  const [flavorPrice, setFlavorPrice] = useState("");
  const [flavorPriceUniform, setFlavorPriceUniform] = useState(true);
  const [flavorCount, setFlavorCount] = useState(0);
  const [cakePrices, setCakePrices] = useState<Record<CakeSlug, string>>({
    "torta-p": "",
    "torta-m": "",
    "torta-g": "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = requireSupabase();
    const [{ data: flavors }, { data: products }] = await Promise.all([
      supabase.from("flavors").select("base_price").eq("active", true),
      supabase.from("commercial_products").select("slug,base_price").in("slug", ["torta-p", "torta-m", "torta-g"]),
    ]);
    const prices = (flavors || []).map((item) => Number(item.base_price));
    setFlavorCount(prices.length);
    const uniform = prices.length === 0 || prices.every((price) => price === prices[0]);
    setFlavorPriceUniform(uniform);
    setFlavorPrice(prices.length ? prices[0].toFixed(2).replace(".", ",") : "");
    const nextCakePrices: Record<CakeSlug, string> = { "torta-p": "", "torta-m": "", "torta-g": "" };
    (products || []).forEach((product) => {
      if (product.slug in nextCakePrices) {
        nextCakePrices[product.slug as CakeSlug] = Number(product.base_price).toFixed(2).replace(".", ",");
      }
    });
    setCakePrices(nextCakePrices);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFlavorPrice = async () => {
    const value = parsePrice(flavorPrice);
    if (!value || value <= 0) return setNotice("Informe um preço válido para a fatia.");
    if (
      !(await confirmAction(
        `Aplicar ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a todos os ${flavorCount} sabores ativos? Isso substitui o preço individual de cada sabor.`,
        { confirmLabel: "Aplicar a todos" },
      ))
    )
      return;
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("manager_bulk_set_flavor_price", {
      requested_price: value,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`Preço aplicado a ${data} sabor(es).`);
    await load();
  };

  const saveCakePrices = async () => {
    const values = CAKE_SIZES.map((size) => ({ slug: size.slug, value: parsePrice(cakePrices[size.slug]) }));
    if (values.some((item) => !item.value || item.value <= 0)) {
      return setNotice("Informe um preço válido para cada tamanho de torta.");
    }
    setBusy(true);
    const supabase = requireSupabase();
    for (const item of values) {
      const { error } = await supabase.from("commercial_products").update({ base_price: item.value }).eq("slug", item.slug);
      if (error) {
        setBusy(false);
        return setNotice(error.message);
      }
    }
    setBusy(false);
    setNotice("Preços das tortas atualizados.");
    await load();
  };

  return (
    <section className="commerce-settings-page">
      <header className="commerce-tool-heading">
        <div>
          <small>Preços</small>
          <h2>Fatia e tortas inteiras</h2>
          <p>Um valor só, aplicado em todo o site -- cardápio, carrinho, pedidos online e encomendas.</p>
        </div>
        <CakeSlice />
      </header>
      {notice ? (
        <p className="operation-commercial-notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="commerce-settings-grid">
        <section className="commerce-tool-card">
          <header>
            <CakeSlice />
            <div>
              <small>Fatias</small>
              <h3>Preço padrão da fatia</h3>
            </div>
          </header>
          <label>
            Preço (R$)
            <input
              inputMode="decimal"
              value={flavorPrice}
              onChange={(event) => setFlavorPrice(event.target.value)}
              placeholder="16,00"
            />
          </label>
          {!flavorPriceUniform ? (
            <p className="commerce-setting-hint">
              Os sabores ativos hoje têm preços diferentes entre si. Aplicar aqui substitui todos pelo mesmo valor.
            </p>
          ) : null}
          <small>
            Aplica esse valor a todos os {flavorCount} sabores ativos de uma vez -- cardápio, carrinho e pedidos
            online.
          </small>
          <button className="admin-primary" type="button" onClick={() => void applyFlavorPrice()} disabled={busy}>
            <Save /> Aplicar a todos os sabores
          </button>
        </section>
        <section className="commerce-tool-card">
          <header>
            <CakeSlice />
            <div>
              <small>Encomendas</small>
              <h3>Tortas inteiras (P, M, G)</h3>
            </div>
          </header>
          {CAKE_SIZES.map((size) => (
            <label key={size.slug}>
              {size.label} (R$)
              <input
                inputMode="decimal"
                value={cakePrices[size.slug]}
                onChange={(event) => setCakePrices({ ...cakePrices, [size.slug]: event.target.value })}
              />
            </label>
          ))}
          <small>Vale para a página de encomendas (/catalogo) e para a torta inteira do mesmo sabor no Adoce Hoje.</small>
          <button className="admin-primary" type="button" onClick={() => void saveCakePrices()} disabled={busy}>
            <Save /> Salvar preços das tortas
          </button>
        </section>
      </div>
    </section>
  );
}
