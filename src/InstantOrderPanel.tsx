import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Droplets, MapPin, MessageCircle, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { trackPublicEvent } from "./analytics";
import "./instant-order.css";
import "./instant-order-enhancements.css";

export type InstantOrderFlavor = {
  id: string;
  name: string;
  image: string;
  price: number;
  free: number | null;
};

type SubmitResult = {
  accepted: boolean;
  order_number?: string;
  token?: string;
  status?: string;
  checkout_mode?: "automatic" | "staff_confirmation";
  total?: number;
  reserved_until?: string | null;
  pickup_label?: string;
  pickup_address?: string;
  message: string;
};

type OrderSauce = { id: string; name: string };

export function hasFirstAndLastName(value: string) {
  return value.trim().split(/\s+/).filter((part) => part.length >= 2).length >= 2;
}

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function InstantOrderPanel({
  open,
  onClose,
  flavors,
  initialFlavorId,
}: {
  open: boolean;
  onClose: () => void;
  flavors: InstantOrderFlavor[];
  initialFlavorId?: string | null;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [step, setStep] = useState<"details" | "sauces">("details");
  const [sauces, setSauces] = useState<OrderSauce[]>([]);
  const [sauceChoices, setSauceChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !initialFlavorId) return;
    setQuantities((current) => ({ ...current, [initialFlavorId]: Math.max(current[initialFlavorId] || 0, 1) }));
  }, [initialFlavorId, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    void requireSupabase().from("order_sauces").select("id,name").eq("active", true)
      .order("sort_order").order("name")
      .then(({ data }) => setSauces((data || []) as OrderSauce[]));
  }, [open]);

  const totalQuantity = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );
  const total = useMemo(
    () => flavors.reduce((sum, flavor) => sum + (quantities[flavor.id] || 0) * flavor.price, 0),
    [flavors, quantities],
  );

  const changeQuantity = (flavor: InstantOrderFlavor, delta: number) => {
    setQuantities((current) => {
      const maximum = flavor.free === null ? 30 : Math.max(0, flavor.free);
      const next = Math.max(0, Math.min(maximum, (current[flavor.id] || 0) + delta));
      return { ...current, [flavor.id]: next };
    });
  };

  const selectedUnits = useMemo(() => flavors.flatMap((flavor) =>
    Array.from({ length: quantities[flavor.id] || 0 }, (_, index) => ({
      flavor,
      unitNumber: index + 1,
      key: `${flavor.id}:${index + 1}`,
    }))), [flavors, quantities]);
  const allSaucesChosen = !sauces.length || selectedUnits.every((unit) => Boolean(sauceChoices[unit.key]));

  const continueToSauces = (event: FormEvent) => {
    event.preventDefault();
    if (!totalQuantity) return setNotice("Escolha pelo menos uma fatia para continuar.");
    if (!hasFirstAndLastName(name)) return setNotice("Informe seu nome e sobrenome para identificarmos o pedido.");
    if (phone.replace(/\D/g, "").length < 10) return setNotice("Informe um WhatsApp válido com DDD.");
    setNotice("");
    setStep("sauces");
  };

  const submit = async () => {
    if (!allSaucesChosen) return setNotice("Escolha uma opção de calda para cada fatia.");
    setBusy(true);
    setNotice("");
    trackPublicEvent("instant_order_start", { quantity: totalQuantity });
    const { data, error } = await requireSupabase().rpc("submit_instant_order_v2", {
      requested_customer_name: name.trim(),
      requested_customer_phone: phone,
      requested_items: flavors
        .filter((flavor) => (quantities[flavor.id] || 0) > 0)
        .map((flavor) => ({
          flavor_id: flavor.id,
          quantity: quantities[flavor.id],
          ...(sauces.length ? {
            sauces: Array.from({ length: quantities[flavor.id] || 0 }, (_, index) => {
              const choice = sauceChoices[`${flavor.id}:${index + 1}`];
              return { unit_number: index + 1, sauce_id: choice === "none" ? null : choice };
            }),
          } : {}),
        })),
      requested_notes: notes.trim(),
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const response = data as SubmitResult;
    if (!response.accepted) return setNotice(response.message);
    setResult(response);
    trackPublicEvent("instant_order_success", {
      quantity: totalQuantity,
      checkout_mode: response.checkout_mode,
    });
  };

  const reset = () => {
    setQuantities({});
    setName("");
    setPhone("");
    setNotes("");
    setNotice("");
    setResult(null);
    setStep("details");
    setSauceChoices({});
    onClose();
  };

  if (!open) return null;
  const whatsappMessage = result?.order_number
    ? `Olá, Adoce! Acabei de montar o pedido ${result.order_number} pelo site.`
    : "Olá, Adoce! Quero montar um pedido de fatias para retirada.";

  return (
    <div className="instant-order-layer">
      <button className="instant-order-backdrop" aria-label="Fechar pedido" onClick={onClose} />
      <aside className="instant-order-panel" role="dialog" aria-modal="true" aria-labelledby="instant-order-title">
        <button className="instant-order-close" aria-label="Fechar" onClick={onClose}><X /></button>
        {!result && step === "details" ? <>
          <header>
            <span><ShoppingBag /> Retirada de fatias</span>
            <h2 id="instant-order-title">Monte seu pedido</h2>
            <p>Escolha as quantidades. A Adoce confere tudo e continua o atendimento pelo seu WhatsApp.</p>
          </header>
          <div className="instant-order-flavors">
            {flavors.map((flavor) => {
              const quantity = quantities[flavor.id] || 0;
              return <article key={flavor.id} className={quantity ? "selected" : ""}>
                <img src={flavor.image} alt={`Fatia ${flavor.name}`} />
                <span><strong>{flavor.name}</strong><small>{money(flavor.price)} cada</small></span>
                <div>
                  <button type="button" aria-label={`Remover uma ${flavor.name}`} onClick={() => changeQuantity(flavor, -1)} disabled={!quantity}><Minus /></button>
                  <b>{quantity}</b>
                  <button type="button" aria-label={`Adicionar uma ${flavor.name}`} onClick={() => changeQuantity(flavor, 1)} disabled={flavor.free !== null && quantity >= flavor.free}><Plus /></button>
                </div>
              </article>;
            })}
          </div>
          <form onSubmit={continueToSauces}>
            <div className="instant-order-total"><span>{totalQuantity} fatia(s)</span><strong>{money(total)}</strong></div>
            <label>Nome e sobrenome<input required minLength={5} autoComplete="name" placeholder="Ex.: Rubens Bezerra" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>WhatsApp com DDD<input required inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Observação <small>(opcional)</small><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Horário desejado ou alguma informação importante" /></label>
            {notice ? <p className="instant-order-notice" role="alert">{notice}</p> : null}
            <button className="instant-order-submit" disabled={!totalQuantity}>Escolher caldas e enviar</button>
            <small className="instant-order-explanation">Nenhum pagamento será solicitado antes da confirmação da disponibilidade.</small>
          </form>
        </> : !result && step === "sauces" ? <section className="instant-order-sauces">
          <button type="button" className="instant-order-back" onClick={() => { setStep("details"); setNotice(""); }}><ArrowLeft /> Voltar ao pedido</button>
          <header>
            <span><Droplets /> Seu pedido, do seu jeito</span>
            <h2 id="instant-order-title">Escolha suas caldas</h2>
            <p>{sauces.length ? "Escolha uma opção para cada fatia. Se preferir, selecione sem calda." : "As caldas acabaram por hoje, mas suas fatias continuam esperando por você."}</p>
          </header>
          {sauces.length ? <div className="instant-order-sauce-list">
            {selectedUnits.map((unit) => <label key={unit.key}>
              <span><img src={unit.flavor.image} alt="" /><span><strong>{unit.flavor.name}</strong><small>Fatia {unit.unitNumber}</small></span></span>
              <select value={sauceChoices[unit.key] || ""} onChange={(event) => setSauceChoices((current) => ({ ...current, [unit.key]: event.target.value }))}>
                <option value="">Escolha a calda</option>
                <option value="none">Sem calda</option>
                {sauces.map((sauce) => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}
              </select>
            </label>)}
          </div> : <p className="instant-order-no-sauce"><Droplets /> Hoje o pedido vai sem calda. Você ainda pode enviar suas fatias normalmente.</p>}
          {notice ? <p className="instant-order-notice" role="alert">{notice}</p> : null}
          <button type="button" className="instant-order-submit" disabled={busy || !allSaucesChosen} onClick={() => void submit()}>{busy ? "Enviando com carinho..." : sauces.length ? "Enviar pedido para a Adoce" : "Enviar somente as fatias"}</button>
        </section> : <section className="instant-order-success">
          <Check />
          <span>Pedido recebido</span>
          <h2 id="instant-order-title">{result!.order_number}</h2>
          <p>{result!.message}</p>
          <dl><div><dt>Total</dt><dd>{money(result!.total || 0)}</dd></div><div><dt>Próximo passo</dt><dd>Confira o WhatsApp</dd></div></dl>
          {result!.pickup_address ? <div className="instant-order-pickup"><MapPin /><span><strong>{result!.pickup_label}</strong><small>{result!.pickup_address}</small></span><button type="button" onClick={() => void navigator.clipboard.writeText(result!.pickup_address || "")}><Copy /> Copiar</button></div> : null}
          <a href={`https://wa.me/5585982156026?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer"><MessageCircle /> Acompanhar pelo WhatsApp</a>
          <button type="button" className="instant-order-finish" onClick={reset}>Concluir</button>
        </section>}
      </aside>
    </div>
  );
}
