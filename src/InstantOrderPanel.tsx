import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Copy, Droplets, Gift, Heart, MapPin, MessageCircle, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { trackPublicEvent } from "./analytics";
import { buildOrderWhatsAppMessage, orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import { pickupBoundsForDay, pickupWindowHint, type PickupWindow } from "./pickup-window";
import { mascaraTelefone } from "./cadastro-rapido";
import {
  currentLocalTime,
  earliestPickupTimeForQuantity,
  formatBatchAvailability,
  latestRequiredPickupTime,
  type AvailabilityBatch,
} from "./availability-batches";
import "./instant-order.css";
import "./instant-order-enhancements.css";
import "./instant-order-empty.css";

export type InstantOrderFlavor = {
  id: string;
  name: string;
  image: string;
  price: number;
  free: number | null;
  batches: AvailabilityBatch[];
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
  reward_requested?: boolean;
  reward_flavor_name?: string;
  reward_sauce_name?: string;
  reward_upgrade?: number;
  offer_club_invite?: boolean;
  pickup_requested_time?: string;
  pickup_method?: "customer" | "driver";
  message: string;
};

type OrderSauce = { id: string; name: string };
type CheckoutPaymentMethod = { code: string; label: string };
type LoyaltyPreview = {
  recognized: boolean;
  current_progress?: number;
  purchase_quantity?: number;
  projected_progress?: number;
  projected_new_rewards?: number;
  available_rewards?: number;
  reward_choices?: number;
  will_unlock_reward?: boolean;
};

export function hasFirstAndLastName(value: string) {
  return value.trim().split(/\s+/).filter((part) => part.length >= 2).length >= 2;
}

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function InstantOrderPanel({
  open,
  onClose,
  flavors,
  initialFlavorId,
  pickupWindows = null,
}: {
  open: boolean;
  onClose: () => void;
  flavors: InstantOrderFlavor[];
  initialFlavorId?: string | null;
  pickupWindows?: PickupWindow[] | null;
}) {
  // Limites do campo cobrem da primeira abertura ao ultimo fechamento; a
  // validacao no envio e que recusa o vao entre duas janelas.
  const pickupBounds = pickupWindows ? pickupBoundsForDay(pickupWindows) : null;
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
  const [loyaltyPreview, setLoyaltyPreview] = useState<LoyaltyPreview | null>(null);
  const [checkingClub, setCheckingClub] = useState(false);
  const [wantsReward, setWantsReward] = useState(false);
  const [rewardFlavorId, setRewardFlavorId] = useState("");
  const [rewardSauceId, setRewardSauceId] = useState("");
  const [showClubInvite, setShowClubInvite] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<CheckoutPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [checkoutConfigAttempt, setCheckoutConfigAttempt] = useState(0);
  const [pickupMethod, setPickupMethod] = useState<"customer" | "driver">("customer");
  const [pickupTime, setPickupTime] = useState("");
  const operationKey = useRef(crypto.randomUUID());
  const operationPayload = useRef("");
  const orderWhatsAppNumber = useOrderWhatsAppNumber();

  useEffect(() => {
    if (!open || !initialFlavorId) return;
    setQuantities((current) => ({ ...current, [initialFlavorId]: Math.max(current[initialFlavorId] || 0, 1) }));
  }, [flavors, initialFlavorId, open]);
  useEffect(() => {
    if (!open) return;
    void requireSupabase().auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const { data: profile } = await requireSupabase()
        .from("profiles")
        .select("full_name,phone_e164")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.full_name) setName((current) => current || profile.full_name);
      if (profile?.phone_e164) setPhone((current) => current || mascaraTelefone(profile.phone_e164 || ""));
    }).catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setPaymentMethodsLoading(true);
    setPaymentMethodsError("");
    void Promise.all([
      requireSupabase().from("order_sauces").select("id,name").eq("active", true).order("sort_order").order("name"),
      requireSupabase().rpc("get_checkout_payment_methods"),
    ]).then(([sauceResult, paymentResult]) => {
      if (!active) return;
      setSauces((sauceResult.data || []) as OrderSauce[]);
      if (paymentResult.error) {
        setPaymentMethods([]);
        setPaymentMethod("");
        setPaymentMethodsError("Não foi possível carregar as formas de pagamento.");
        return;
      }
      const availableMethods = (paymentResult.data || []) as CheckoutPaymentMethod[];
      setPaymentMethods(availableMethods);
      setPaymentMethod((current) => availableMethods.some((method) => method.code === current) ? current : (availableMethods[0]?.code || ""));
      if (!availableMethods.length) setPaymentMethodsError("Nenhuma forma de pagamento está disponível no momento.");
    }).catch(() => {
      if (!active) return;
      setPaymentMethods([]);
      setPaymentMethod("");
      setPaymentMethodsError("Não foi possível carregar as formas de pagamento.");
    }).finally(() => {
      if (active) setPaymentMethodsLoading(false);
    });
    return () => { active = false; };
  }, [checkoutConfigAttempt, open]);

  const totalQuantity = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );
  const total = useMemo(
    () => flavors.reduce((sum, flavor) => sum + (quantities[flavor.id] || 0) * flavor.price, 0),
    [flavors, quantities],
  );
  const rewardFlavor = flavors.find((flavor) => flavor.id === rewardFlavorId);
  const pickupMinimum = latestRequiredPickupTime([
    ...flavors
      .filter((flavor) => (quantities[flavor.id] || 0) > 0)
      .map((flavor) => ({ batches: flavor.batches, quantity: quantities[flavor.id] || 0 })),
    ...(wantsReward && rewardFlavor
      ? [{ batches: rewardFlavor.batches, quantity: 1 }]
      : []),
  ], pickupBounds?.min, currentLocalTime());
  const rewardUpgrade = wantsReward && rewardFlavor ? Math.max(0, rewardFlavor.price - 16) : 0;
  const displayTotal = total + rewardUpgrade;

  useEffect(() => {
    if (!open || phone.replace(/\D/g, "").length < 10) {
      setLoyaltyPreview(null);
      setWantsReward(false);
      setCheckingClub(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = requireSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (active) {
          setCheckingClub(false);
          setLoyaltyPreview({ recognized: false });
          setWantsReward(false);
        }
        return;
      }
      if (active) setCheckingClub(true);
      const { data, error } = await supabase.rpc("member_instant_order_loyalty_preview", {
        requested_phone: phone,
        requested_quantity: totalQuantity,
      });
      if (!active) return;
      const preview = error ? { recognized: false } : data as LoyaltyPreview;
      setCheckingClub(false);
      setLoyaltyPreview(preview);
      if (!preview.recognized || Number(preview.reward_choices || 0) < 1) {
        setWantsReward(false);
        setRewardFlavorId("");
        setRewardSauceId("");
      }
    }, 450);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, phone, totalQuantity]);

  const changeQuantity = (flavor: InstantOrderFlavor, delta: number) => {
    setQuantities((current) => {
      const maximum = flavor.free === null ? 30 : Math.max(0, flavor.free);
      const next = Math.max(0, Math.min(maximum, (current[flavor.id] || 0) + delta));
      return { ...current, [flavor.id]: next };
    });
  };

  // O horario digitado NAO e corrigido enquanto a pessoa digita.
  //
  // Antes este efeito dependia de `pickupTime` e o reescrevia. Em <input
  // type="time"> o navegador emite valores intermediarios a cada tecla: quem
  // queria 20:00 digitava o "2", o campo virava "02:00", o efeito via que
  // 02:00 < 19:30 e devolvia 19:30 na hora. Resultado: **so era possivel
  // deixar 19:30**, e o aviso reaparecia sem parar. Cliente travava aqui.
  //
  // Agora a correcao acontece so quando o MINIMO muda — ou seja, quando a
  // pessoa altera as quantidades e o pedido passa a ficar pronto mais tarde.
  // O que ela digita fica intacto; a validacao final e feita no envio.
  const pickupTimeRef = useRef(pickupTime);
  pickupTimeRef.current = pickupTime;

  useEffect(() => {
    const escolhido = pickupTimeRef.current;
    if (escolhido && pickupMinimum && escolhido < pickupMinimum) {
      // Apenas avisa. NAO reescreve o campo: trocar o valor por baixo de quem
      // esta com o campo aberto e o que dava a sensacao de loop. A pessoa
      // decide o novo horario, e a validacao de verdade acontece ao avancar.
      setNotice(`Com as quantidades escolhidas, o pedido completo fica pronto a partir das ${pickupMinimum.replace(":00", "h")}. Ajuste o horário de retirada.`);
    }
  }, [pickupMinimum]);

  const selectedUnits = useMemo(() => flavors.flatMap((flavor) =>
    Array.from({ length: quantities[flavor.id] || 0 }, (_, index) => ({
      flavor,
      unitNumber: index + 1,
      key: `${flavor.id}:${index + 1}`,
    }))), [flavors, quantities]);
  const allSaucesChosen = !sauces.length || selectedUnits.every((unit) => Boolean(sauceChoices[unit.key]));
  const rewardChoiceReady = !wantsReward || (Boolean(rewardFlavorId) && (!sauces.length || Boolean(rewardSauceId)));

  const detailsAreReady = () => {
    if (!totalQuantity) return setNotice("Escolha pelo menos uma fatia para continuar."), false;
    if (!hasFirstAndLastName(name)) return setNotice("Informe seu nome e sobrenome para identificarmos o pedido."), false;
    if (phone.replace(/\D/g, "").length < 10) return setNotice("Informe um WhatsApp válido com DDD."), false;
    if (paymentMethodsLoading) return setNotice("Aguarde o carregamento das formas de pagamento."), false;
    if (paymentMethodsError) return setNotice("Tente carregar novamente as formas de pagamento para continuar."), false;
    if (!paymentMethod) return setNotice("Escolha como deseja pagar."), false;
    if (!pickupTime) return setNotice("Escolha o horário desejado para a retirada."), false;
    if (pickupMinimum && pickupTime < pickupMinimum) {
      return setNotice(`Escolha um horário a partir das ${pickupMinimum.replace(":00", "h")} para retirar o pedido completo.`), false;
    }
    setNotice("");
    return true;
  };
  const needsSauceStep = sauces.length > 0 || wantsReward;

  const submit = async () => {
    if (!allSaucesChosen) return setNotice("Escolha uma opção de calda para cada fatia.");
    if (!rewardChoiceReady) return setNotice("Escolha o sabor e a calda da sua fatia-presente.");
    if (!paymentMethod) return setNotice("Escolha como deseja pagar.");
    if (!pickupTime) return setNotice("Escolha o horário desejado para a retirada.");
    if (pickupMinimum && pickupTime < pickupMinimum) {
      return setNotice(`Escolha um horário a partir das ${pickupMinimum.replace(":00", "h")} para retirar o pedido completo.`);
    }
    setBusy(true);
    setNotice("");
    trackPublicEvent("instant_order_start", { quantity: totalQuantity });
    const requestPayload = {
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
    };
    const serializedPayload = JSON.stringify({ ...requestPayload, paymentMethod, wantsReward, rewardFlavorId, rewardSauceId, pickupTime, pickupMethod });
    if (operationPayload.current && operationPayload.current !== serializedPayload) {
      operationKey.current = crypto.randomUUID();
    }
    operationPayload.current = serializedPayload;
    const { data, error } = await requireSupabase().rpc("submit_instant_order_v7", {
      ...requestPayload,
      requested_operation_key: operationKey.current,
      requested_payment_method: paymentMethod,
      requested_reward: wantsReward ? {
        flavor_id: rewardFlavorId,
        sauce_id: rewardSauceId === "none" ? null : rewardSauceId,
      } : null,
      requested_pickup_time: pickupTime,
      requested_pickup_method: pickupMethod,
    });
    setBusy(false);
    if (error) {
      const permissionDenied = /permission denied for function submit_instant_order_v7/i.test(error.message);
      return setNotice(permissionDenied
        ? "Não foi possível registrar o pedido agora. Tente novamente em instantes."
        : error.message);
    }
    const response = data as SubmitResult;
    if (!response.accepted) return setNotice(response.message);
    setResult(response);
    setShowClubInvite(Boolean(response.offer_club_invite));
    trackPublicEvent("instant_order_success", {
      quantity: totalQuantity,
      checkout_mode: response.checkout_mode,
    });
    const whatsappItems = selectedUnits.map((unit) => {
      const sauceId = sauceChoices[unit.key];
      return {
        name: unit.flavor.name,
        sauce: sauceId === "none" ? "Sem calda" : (sauces.find((sauce) => sauce.id === sauceId)?.name || "Sem calda"),
      };
    });
    const message = buildOrderWhatsAppMessage({
      orderNumber: response.order_number || "PEDIDO",
      customerName: name,
      items: whatsappItems,
      total: response.total || displayTotal,
      pickupTime,
      pickupMethod,
    });
    window.location.assign(orderWhatsAppUrl(orderWhatsAppNumber, message));
  };

  const continueToSauces = (event: FormEvent) => {
    event.preventDefault();
    if (!detailsAreReady()) return;
    if (needsSauceStep) {
      setStep("sauces");
      return;
    }
    void submit();
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
    setLoyaltyPreview(null);
    setCheckingClub(false);
    setWantsReward(false);
    setRewardFlavorId("");
    setRewardSauceId("");
    setShowClubInvite(false);
    setPaymentMethod("");
    setPaymentMethodsError("");
    setPickupMethod("customer");
    setPickupTime("");
    operationKey.current = crypto.randomUUID();
    operationPayload.current = "";
    onClose();
  };

  const joinClub = () => {
    sessionStorage.setItem("adoce-club-order-invite", JSON.stringify({ name: name.trim(), phone }));
    window.location.href = "/#cadastro";
  };

  if (!open) return null;
  const whatsappMessage = result?.order_number
    ? buildOrderWhatsAppMessage({
      orderNumber: result.order_number,
      customerName: name,
      items: selectedUnits.map((unit) => {
        const sauceId = sauceChoices[unit.key];
        return {
          name: unit.flavor.name,
          sauce: sauceId === "none" ? "Sem calda" : (sauces.find((sauce) => sauce.id === sauceId)?.name || "Sem calda"),
        };
      }),
      total: result.total || displayTotal,
      pickupTime,
      pickupMethod,
    })
    : "Olá, Adoce! Quero montar um pedido de fatias para retirada.";

  return (
    <div className="instant-order-layer">
      <button className="instant-order-backdrop" aria-label="Fechar pedido" onClick={onClose} />
      {showClubInvite ? <section className="instant-order-club-invite" role="dialog" aria-modal="true" aria-labelledby="club-invite-title">
        <button type="button" className="instant-order-club-invite-close" aria-label="Agora não" onClick={() => setShowClubInvite(false)}><X /></button>
        <img src="/site/clube-convite-pedido.webp" alt="Cartão fidelidade com carimbos e uma fatia de torta como recompensa" />
        <div>
          <span><Heart /> Um carinho para suas próximas escolhas</span>
          <h2 id="club-invite-title">Você já conhece o Clube Adoce?</h2>
          <p>Cada fatia confirmada vale um carimbo. Ao completar 14, você ganha uma fatia para adoçar o seu dia.</p>
          <strong>Quer participar?</strong>
          <div><button type="button" onClick={joinClub}><Gift /> Quero fazer parte</button><button type="button" onClick={() => setShowClubInvite(false)}>Agora não</button></div>
          <small>É opcional, gratuito e seu pedido já foi recebido normalmente.</small>
        </div>
      </section> : null}
      <aside className="instant-order-panel" role="dialog" aria-modal={showClubInvite ? undefined : "true"} aria-hidden={showClubInvite || undefined} aria-labelledby="instant-order-title">
        <button className="instant-order-close" aria-label="Fechar" onClick={onClose}><X /></button>
        {!result && step === "details" ? <>
          <header>
            <span><ShoppingBag /> Retirada de fatias</span>
            <h2 id="instant-order-title">Monte seu pedido</h2>
            <p>Escolha as quantidades. A Adoce confere tudo e continua o atendimento pelo seu WhatsApp.</p>
          </header>
          {!flavors.length ? <div className="instant-order-empty">
            <ShoppingBag />
            <strong>Seu carrinho está vazio</strong>
            <p>Quando houver fatias disponíveis, escolha os sabores e volte aqui para concluir.</p>
            <a href="/#adoce-hoje" onClick={onClose}>Ver sabores</a>
          </div> : <div className="instant-order-flavors">
            {flavors.map((flavor) => {
              const quantity = quantities[flavor.id] || 0;
              const readyAt = earliestPickupTimeForQuantity(flavor.batches, quantity, currentLocalTime());
              return <article key={flavor.id} className={quantity ? "selected" : ""}>
                <img src={flavor.image} alt={`Fatia ${flavor.name}`} />
                <span><strong>{flavor.name}</strong><small>{money(flavor.price)} cada</small></span>
                <div>
                  <button type="button" aria-label={`Remover uma ${flavor.name}`} onClick={() => changeQuantity(flavor, -1)} disabled={!quantity}><Minus /></button>
                  <b>{quantity}</b>
                  <button type="button" aria-label={`Adicionar uma ${flavor.name}`} onClick={() => changeQuantity(flavor, 1)} disabled={flavor.free !== null && quantity >= flavor.free}><Plus /></button>
                </div>
                {flavor.batches.length ? <p className="instant-order-release-note" role="status"><Clock3 /><span>{quantity > 0 && readyAt ? <strong>{readyAt <= currentLocalTime() ? "Sua quantidade está disponível agora" : `Sua quantidade fica pronta a partir das ${readyAt.replace(":00", "h")}`}</strong> : null}{formatBatchAvailability(flavor.batches).map((line) => <small key={line}>{line}</small>)}</span></p> : null}
              </article>;
            })}
          </div>}
          {flavors.length ? <form onSubmit={continueToSauces}>
            <div className="instant-order-total"><span>{totalQuantity} fatia(s){wantsReward ? " + 1 presente" : ""}</span><strong>{money(displayTotal)}</strong></div>
            <label>Nome e sobrenome<input required minLength={5} autoComplete="name" placeholder="Ex.: Rubens Bezerra" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>WhatsApp com DDD<input required inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" value={mascaraTelefone(phone)} onChange={(event) => setPhone(mascaraTelefone(event.target.value))} /></label>
            {phone.replace(/\D/g, "").length >= 10 ? <div className={`instant-order-club-preview ${loyaltyPreview?.recognized ? "recognized" : ""}`} aria-live="polite">
              {checkingClub ? <><Heart /><span><strong>Consultando seu Clube Adoce...</strong><small>Só um instante.</small></span></> : loyaltyPreview?.recognized ? <><Heart /><span><strong>Seu Clube Adoce foi reconhecido</strong><small>Você tem {loyaltyPreview.current_progress} de 14 carimbos. Após o pagamento deste pedido, ficará com {loyaltyPreview.projected_progress} de 14.</small>{loyaltyPreview.will_unlock_reward ? <em><Gift /> Esta compra completa seu cartão e libera uma fatia-presente.</em> : null}</span></> : <><Heart /><span><strong>Cada fatia confirmada vale um carimbo</strong><small>Se este WhatsApp estiver no Clube Adoce, os carimbos serão vinculados automaticamente após o pagamento.</small></span></>}
            </div> : null}
            {loyaltyPreview?.recognized && Number(loyaltyPreview.reward_choices || 0) > 0 ? <label className="instant-order-reward-choice"><input type="checkbox" checked={wantsReward} onChange={(event) => { setWantsReward(event.target.checked); if (!event.target.checked) { setRewardFlavorId(""); setRewardSauceId(""); } }} /><span><Gift /><span><strong>Quero receber minha fatia-presente neste pedido</strong><small>Você escolhe o sabor e a calda na próxima etapa. Ela só será resgatada após o pagamento.</small></span></span></label> : null}
            <label>Como deseja pagar?<select required value={paymentMethod} disabled={paymentMethodsLoading || Boolean(paymentMethodsError)} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">{paymentMethodsLoading ? "Carregando formas de pagamento..." : "Escolha a forma de pagamento"}</option>{paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select><small>A cobrança só acontece depois que a Adoce confirmar a disponibilidade.</small></label>
            {paymentMethodsError ? <div className="instant-order-payment-error" role="alert"><span>{paymentMethodsError} Tente novamente para continuar.</span><button type="button" onClick={() => setCheckoutConfigAttempt((attempt) => attempt + 1)}>Tentar novamente</button></div> : null}
            <fieldset className="instant-order-pickup-choice"><legend>Quem fará a retirada?</legend><label><input type="radio" name="pickup-method" checked={pickupMethod === "customer"} onChange={() => setPickupMethod("customer")} /> Eu mesma(o)</label><label><input type="radio" name="pickup-method" checked={pickupMethod === "driver"} onChange={() => setPickupMethod("driver")} /> Entregador de aplicativo</label></fieldset>
            <label>Observação <small>(opcional)</small><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Alguma informação importante para a Adoce" /></label>
            <label>Horário desejado para retirada<input type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} />{pickupMinimum ? <small>Seu pedido completo pode ser retirado a partir das {pickupMinimum.replace(":00", "h")}.</small> : pickupWindows?.length ? <small>{pickupWindowHint(pickupWindows)}</small> : null}</label>
            {notice ? <p className="instant-order-notice" role="alert">{notice}</p> : null}
            <button className="instant-order-submit" disabled={!totalQuantity || paymentMethodsLoading || Boolean(paymentMethodsError) || !paymentMethod}>{needsSauceStep ? "Escolher caldas e enviar" : "Enviar pedido"}</button>
            <small className="instant-order-explanation">Nenhum pagamento será solicitado antes da confirmação da disponibilidade.</small>
          </form> : null}
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
          {wantsReward ? <div className="instant-order-reward-picker-public">
            <span><Gift /><span><strong>Sua fatia-presente</strong><small>Ela também será separada e baixada do estoque.</small></span></span>
            <label>Sabor<select value={rewardFlavorId} onChange={(event) => setRewardFlavorId(event.target.value)}><option value="">Escolha o sabor</option>{flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}{flavor.price > 16 ? ` · diferença ${money(flavor.price - 16)}` : " · presente"}</option>)}</select></label>
            {sauces.length ? <label>Calda<select value={rewardSauceId} onChange={(event) => setRewardSauceId(event.target.value)}><option value="">Escolha a calda</option><option value="none">Sem calda</option>{sauces.map((sauce) => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}</select></label> : <small>Hoje ela será preparada sem calda.</small>}
          </div> : null}
          {notice ? <p className="instant-order-notice" role="alert">{notice}</p> : null}
          <button type="button" className="instant-order-submit" disabled={busy || !allSaucesChosen || !rewardChoiceReady} onClick={() => void submit()}>{busy ? "Registrando pedido..." : "Finalizar pelo WhatsApp"}</button>
        </section> : <section className="instant-order-success">
          <Check />
          <span>Pedido recebido</span>
          <h2 id="instant-order-title">{result!.order_number}</h2>
          <p>{result!.message}</p>
          {loyaltyPreview?.recognized ? <div className="instant-order-club-success"><Heart /><span><strong>{totalQuantity} carimbo(s) reservado(s) para esta compra</strong><small>Eles entram no seu cartão assim que o pagamento for confirmado.{loyaltyPreview.will_unlock_reward ? " Esta compra também completa seu cartão e libera sua fatia-presente." : ""}</small></span></div> : null}
          {result!.reward_requested ? <div className="instant-order-reward-success"><Gift /><span><strong>Sua fatia-presente entrou no pedido</strong><small>{result!.reward_flavor_name}{result!.reward_sauce_name ? ` · ${result!.reward_sauce_name}` : ""}. Ela será resgatada e baixada do estoque quando o pagamento for confirmado.</small></span></div> : null}
          <dl><div><dt>Total</dt><dd>{money(result!.total || 0)}</dd></div><div><dt>Retirada</dt><dd>{result!.pickup_requested_time || pickupTime}</dd></div><div><dt>Próximo passo</dt><dd>Confira o WhatsApp</dd></div></dl>
          {result!.pickup_address ? <div className="instant-order-pickup"><MapPin /><span><strong>{result!.pickup_label}</strong><small>{result!.pickup_address}</small></span><button type="button" onClick={() => void navigator.clipboard.writeText(result!.pickup_address || "")}><Copy /> Copiar</button></div> : null}
          <a href={orderWhatsAppUrl(orderWhatsAppNumber, whatsappMessage)} target="_blank" rel="noreferrer"><MessageCircle /> Finalizar pelo WhatsApp</a>
          <button type="button" className="instant-order-finish" onClick={reset}>Concluir</button>
        </section>}
      </aside>
    </div>
  );
}
