import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Save, Settings2, Timer } from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-commerce-tools.css";

type PaymentMethod = {
  code: string;
  label: string;
  fee_percent: number;
  fee_fixed: number;
  active: boolean;
  customer_selectable: boolean;
  sort_order: number;
};

type CommerceSettings = {
  automatic_checkout_enabled: boolean;
  automatic_checkout_minimum: number;
  reservation_minutes: number;
  payment_methods: PaymentMethod[];
};

const normalizeSettings = (value: CommerceSettings): CommerceSettings => ({
  automatic_checkout_enabled: Boolean(value.automatic_checkout_enabled),
  automatic_checkout_minimum: Math.min(
    30,
    Math.max(1, Number(value.automatic_checkout_minimum || 1)),
  ),
  reservation_minutes: Math.min(
    240,
    Math.max(5, Number(value.reservation_minutes || 30)),
  ),
  payment_methods: [...(value.payment_methods || [])]
    .map((method) => ({
      ...method,
      fee_percent: Math.max(0, Number(method.fee_percent || 0)),
      fee_fixed: Math.max(0, Number(method.fee_fixed || 0)),
      active: Boolean(method.active),
      customer_selectable: Boolean(method.customer_selectable),
      sort_order: Number(method.sort_order || 0),
    }))
    .sort((left, right) => left.sort_order - right.sort_order),
});

export default function OperationGlobalSettingsBff() {
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<CommerceSettings>("staff_get_commerce_settings");
      setSettings(normalizeSettings(next));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as configurações globais.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activePaymentCount = useMemo(
    () => settings?.payment_methods.filter((method) => method.active).length || 0,
    [settings?.payment_methods],
  );

  const updatePayment = (index: number, changes: Partial<PaymentMethod>) => {
    setSettings((current) =>
      current
        ? {
            ...current,
            payment_methods: current.payment_methods.map((method, methodIndex) =>
              methodIndex === index ? { ...method, ...changes } : method,
            ),
          }
        : current,
    );
  };

  const save = async () => {
    if (!settings || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<CommerceSettings>("staff_update_commerce_settings", {
        next_automatic_checkout_enabled: settings.automatic_checkout_enabled,
        next_automatic_checkout_minimum: settings.automatic_checkout_minimum,
        next_reservation_minutes: settings.reservation_minutes,
        next_payment_methods: settings.payment_methods,
      });
      setSettings(normalizeSettings(next));
      setNotice("Configurações salvas. Os próximos pedidos já seguirão estas regras.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações globais.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return (
      <section className="commerce-settings-page">
        <p className="operation-commercial-notice" role="status">
          {busy ? "Carregando configurações globais…" : notice}
        </p>
      </section>
    );
  }

  return (
    <section className="commerce-settings-page">
      <header className="commerce-tool-heading">
        <div>
          <small>Regras globais pelo BFF</small>
          <h2>Reservas, pagamentos e taxas</h2>
          <p>
            Ajuste as regras comerciais sem expor sessão, token ou acesso direto ao
            banco no navegador.
          </p>
        </div>
        <Settings2 />
      </header>

      {notice ? (
        <p className="operation-commercial-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="commerce-settings-grid">
        <section className="commerce-tool-card">
          <header>
            <Timer />
            <div>
              <small>Pedidos on-line</small>
              <h3>Reserva e confirmação</h3>
            </div>
          </header>
          <label className="commerce-check">
            <input
              type="checkbox"
              checked={settings.automatic_checkout_enabled}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  automatic_checkout_enabled: event.target.checked,
                })
              }
            />
            <span>
              <strong>Reserva automática de estoque</strong>
              <small>Aplica a regra somente aos próximos pedidos.</small>
            </span>
          </label>
          <label>
            Quantidade mínima
            <input
              type="number"
              min="1"
              max="30"
              value={settings.automatic_checkout_minimum}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  automatic_checkout_minimum: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Prazo para pagamento, em minutos
            <input
              type="number"
              min="5"
              max="240"
              value={settings.reservation_minutes}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  reservation_minutes: Number(event.target.value),
                })
              }
            />
            <small>Entre 5 minutos e 4 horas.</small>
          </label>
        </section>

        <section className="commerce-tool-card">
          <header>
            <CreditCard />
            <div>
              <small>Recebimentos</small>
              <h3>Meios de pagamento e taxas</h3>
            </div>
          </header>
          <p className="operation-commercial-notice">
            {activePaymentCount} meio{activePaymentCount === 1 ? "" : "s"} ativo
            {activePaymentCount === 1 ? "" : "s"}.
          </p>
          <div className="payment-method-settings">
            {settings.payment_methods.map((method, index) => (
              <article key={method.code}>
                <label className="commerce-check">
                  <input
                    type="checkbox"
                    checked={method.active}
                    onChange={(event) =>
                      updatePayment(index, { active: event.target.checked })
                    }
                  />
                  <span>
                    <strong>{method.label}</strong>
                    <small>
                      {method.customer_selectable
                        ? "Pode ser escolhido pelo cliente"
                        : "Uso interno na operação"}
                    </small>
                  </span>
                </label>
                <label>
                  Taxa percentual
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={method.fee_percent}
                    onChange={(event) =>
                      updatePayment(index, {
                        fee_percent: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Taxa fixa
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={method.fee_fixed}
                    onChange={(event) =>
                      updatePayment(index, { fee_fixed: Number(event.target.value) })
                    }
                  />
                </label>
              </article>
            ))}
          </div>
        </section>
      </div>

      <button
        className="commerce-primary-action"
        type="button"
        onClick={() => void save()}
        disabled={busy}
      >
        <Save /> {busy ? "Salvando…" : "Salvar configurações globais"}
      </button>
    </section>
  );
}
