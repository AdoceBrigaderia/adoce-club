import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CreditCard, Save, Settings2, Timer } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import OperationBusinessStructure from "./OperationBusinessStructure";
import OperationVisualSettings from "./OperationVisualSettings";
import "./operation-commerce-tools.css";

type PaymentMethod = {
  code: string; label: string; fee_percent: number; fee_fixed: number;
  active: boolean; customer_selectable: boolean; sort_order: number;
};
type CommerceSettings = {
  automatic_checkout_enabled: boolean;
  automatic_checkout_minimum: number;
  reservation_minutes: number;
  payment_methods: PaymentMethod[];
};

export default function OperationCommerceSettings({
  session,
  onOpenFlavorImages,
  onOpenProductImages,
}: {
  session: Session;
  onOpenFlavorImages?: () => void;
  onOpenProductImages?: () => void;
}) {
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("staff_get_commerce_settings");
    setBusy(false);
    if (error) return setNotice(error.message);
    setSettings(data as CommerceSettings);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("staff_update_commerce_settings", {
      next_automatic_checkout_enabled: settings.automatic_checkout_enabled,
      next_automatic_checkout_minimum: settings.automatic_checkout_minimum,
      next_reservation_minutes: settings.reservation_minutes,
      next_payment_methods: settings.payment_methods,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setSettings(data as CommerceSettings);
    setNotice("Configurações salvas. Os próximos pedidos já seguirão estas regras.");
  };

  if (!settings) return <section className="commerce-tool-card"><p>{busy ? "Carregando configurações…" : notice}</p></section>;
  return <section className="commerce-settings-page">
    <header className="commerce-tool-heading"><div><small>Regras da operação</small><h2>Configurações e estrutura</h2><p>Controle lojas, caixas, equipe, prazos, pagamentos e taxas em uma única área.</p></div><Settings2 /></header>
    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
    <OperationBusinessStructure session={session} />
    <div className="commerce-settings-grid">
      <section className="commerce-tool-card">
        <header><Timer /><div><small>Pedidos on-line</small><h3>Reserva e confirmação</h3></div></header>
        <label className="commerce-check"><input type="checkbox" checked={settings.automatic_checkout_enabled} onChange={(event) => setSettings({ ...settings, automatic_checkout_enabled: event.target.checked })} /><span><strong>Reserva automática</strong><small>Reserva o estoque quando o pedido alcançar o mínimo definido.</small></span></label>
        <label>Quantidade mínima<input type="number" min="1" max="30" value={settings.automatic_checkout_minimum} onChange={(event) => setSettings({ ...settings, automatic_checkout_minimum: Number(event.target.value) })} /></label>
        <label>Prazo para pagamento, em minutos<input type="number" min="5" max="240" value={settings.reservation_minutes} onChange={(event) => setSettings({ ...settings, reservation_minutes: Number(event.target.value) })} /><small>Entre 5 minutos e 4 horas. Vale para os próximos pedidos.</small></label>
      </section>
      <section className="commerce-tool-card">
        <header><CreditCard /><div><small>Recebimentos</small><h3>Meios de pagamento e taxas</h3></div></header>
        <div className="payment-method-settings">
          {settings.payment_methods.map((method, index) => <article key={method.code}>
            <label className="commerce-check"><input type="checkbox" checked={method.active} onChange={(event) => setSettings({ ...settings, payment_methods: settings.payment_methods.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item) })} /><span><strong>{method.label}</strong><small>{method.customer_selectable ? "Pode ser escolhido pelo cliente" : "Uso interno na operação"}</small></span></label>
            <label>Taxa percentual<input type="number" min="0" max="100" step="0.01" value={method.fee_percent} onChange={(event) => setSettings({ ...settings, payment_methods: settings.payment_methods.map((item, itemIndex) => itemIndex === index ? { ...item, fee_percent: Number(event.target.value) } : item) })} /></label>
            <label>Taxa fixa<input type="number" min="0" step="0.01" value={method.fee_fixed} onChange={(event) => setSettings({ ...settings, payment_methods: settings.payment_methods.map((item, itemIndex) => itemIndex === index ? { ...item, fee_fixed: Number(event.target.value) } : item) })} /></label>
          </article>)}
        </div>
      </section>
    </div>
    <button className="commerce-primary-action" type="button" onClick={() => void save()} disabled={busy}><Save /> Salvar configurações</button>
    <OperationVisualSettings
      session={session}
      onOpenFlavorImages={onOpenFlavorImages}
      onOpenProductImages={onOpenProductImages}
    />
  </section>;
}
