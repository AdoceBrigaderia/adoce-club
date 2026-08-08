import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Droplets,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import { trackPublicEvent } from "./analytics";
import {
  isPickupTimeAllowed,
  pickupWindowHint,
  pickupWindowMessage,
  type PickupWindow,
} from "./pickup-window";
import {
  loadPublicInstantOrderOptions,
  previewPublicInstantOrderLoyalty,
  quotePublicInstantOrder,
  submitPublicInstantOrder,
  type PublicCheckoutPaymentMethod,
  type PublicInstantOrderItem,
  type PublicInstantOrderLoyaltyPreview,
  type PublicInstantOrderQuote,
  type PublicInstantOrderReward,
  type PublicInstantOrderSubmission,
  type PublicOrderSauce,
} from "./services/public-instant-order";
import "./instant-order.css";
import "./instant-order-enhancements.css";

export type InstantOrderFlavor = {
  id: string;
  name: string;
  image: string;
  price: number;
  free: number | null;
};

export function hasFirstAndLastName(value: string) {
  return value.trim().split(/\s+/).filter((part) => part.length >= 2).length >= 2;
}

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function InstantOrderPanel({
  open,
  onClose,
  flavors,
  initialFlavorId,
  pickupWindow = null,
}: {
  open: boolean;
  onClose: () => void;
  flavors: InstantOrderFlavor[];
  initialFlavorId?: string | null;
  pickupWindow?: PickupWindow | null;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<PublicInstantOrderSubmission | null>(null);
  const [step, setStep] = useState<"details" | "sauces">("details");
  const [sauces, setSauces] = useState<PublicOrderSauce[]>([]);
  const [sauceChoices, setSauceChoices] = useState<Record<string, string>>({});
  const [loyaltyPreview, setLoyaltyPreview] =
    useState<PublicInstantOrderLoyaltyPreview | null>(null);
  const [checkingClub, setCheckingClub] = useState(false);
  const [wantsReward, setWantsReward] = useState(false);
  const [rewardFlavorId, setRewardFlavorId] = useState("");
  const [rewardSauceId, setRewardSauceId] = useState("");
  const [showClubInvite, setShowClubInvite] = useState(false);
  const [paymentMethods, setPaymentMethods] =
    useState<PublicCheckoutPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [quote, setQuote] = useState<PublicInstantOrderQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (!open || !initialFlavorId) return;
    setQuantities((current) => ({
      ...current,
      [initialFlavorId]: Math.max(current[initialFlavorId] || 0, 1),
    }));
  }, [initialFlavorId, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadPublicInstantOrderOptions()
      .then((options) => {
        if (!active) return;
        setSauces(options.sauces || []);
        const availableMethods = options.paymentMethods || [];
        setPaymentMethods(availableMethods);
        setPaymentMethod((current) =>
          availableMethods.some((method) => method.code === current)
            ? current
            : availableMethods[0]?.code || "",
        );
      })
      .catch((error) => {
        if (active) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as opções do pedido.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [open]);

  const totalQuantity = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );

  const selectedItems = useMemo<PublicInstantOrderItem[]>(
    () =>
      flavors
        .filter((flavor) => (quantities[flavor.id] || 0) > 0)
        .map((flavor) => ({
          flavor_id: flavor.id,
          quantity: quantities[flavor.id],
          ...(sauces.length
            ? {
                sauces: Array.from(
                  { length: quantities[flavor.id] || 0 },
                  (_, index) => {
                    const choice = sauceChoices[`${flavor.id}:${index + 1}`];
                    return {
                      unit_number: index + 1,
                      sauce_id: choice === "none" ? null : choice || null,
                    };
                  },
                ),
              }
            : {}),
        })),
    [flavors, quantities, sauceChoices, sauces.length],
  );

  const selectedReward = useMemo<PublicInstantOrderReward | null>(
    () =>
      wantsReward && rewardFlavorId
        ? {
            flavor_id: rewardFlavorId,
            sauce_id: rewardSauceId === "none" ? null : rewardSauceId || null,
          }
        : null,
    [rewardFlavorId, rewardSauceId, wantsReward],
  );

  const localFallbackTotal = useMemo(
    () =>
      flavors.reduce(
        (sum, flavor) =>
          sum + (quantities[flavor.id] || 0) * Number(flavor.price || 0),
        0,
      ),
    [flavors, quantities],
  );
  const displayTotal = quote?.total ?? localFallbackTotal;
  const rewardUpgrade = quote?.reward_upgrade ?? 0;

  useEffect(() => {
    if (!open || !selectedItems.length) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setQuoting(true);
      void quotePublicInstantOrder({ items: selectedItems, reward: selectedReward })
        .then((nextQuote) => {
          if (active) setQuote(nextQuote);
        })
        .catch((error) => {
          if (!active) return;
          setQuote(null);
          if (selectedReward) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Não foi possível validar a fatia-presente.",
            );
          }
        })
        .finally(() => {
          if (active) setQuoting(false);
        });
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, selectedItems, selectedReward]);

  useEffect(() => {
    if (!open || phone.replace(/\D/g, "").length < 10) {
      setLoyaltyPreview(null);
      setWantsReward(false);
      setCheckingClub(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setCheckingClub(true);
      void previewPublicInstantOrderLoyalty({
        phone,
        quantity: totalQuantity,
      })
        .then((preview) => {
          if (!active) return;
          setLoyaltyPreview(preview);
          if (!preview.recognized || Number(preview.reward_choices || 0) < 1) {
            setWantsReward(false);
            setRewardFlavorId("");
            setRewardSauceId("");
          }
        })
        .catch(() => {
          if (active) {
            setLoyaltyPreview({ recognized: false });
            setWantsReward(false);
          }
        })
        .finally(() => {
          if (active) setCheckingClub(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, phone, totalQuantity]);

  const changeQuantity = (flavor: InstantOrderFlavor, delta: number) => {
    setQuantities((current) => {
      const maximum = flavor.free === null ? 30 : Math.max(0, flavor.free);
      const next = Math.max(
        0,
        Math.min(maximum, (current[flavor.id] || 0) + delta),
      );
      return { ...current, [flavor.id]: next };
    });
  };

  const selectedUnits = useMemo(
    () =>
      flavors.flatMap((flavor) =>
        Array.from({ length: quantities[flavor.id] || 0 }, (_, index) => ({
          flavor,
          unitNumber: index + 1,
          key: `${flavor.id}:${index + 1}`,
        })),
      ),
    [flavors, quantities],
  );
  const allSaucesChosen =
    !sauces.length ||
    selectedUnits.every((unit) => Boolean(sauceChoices[unit.key]));
  const rewardChoiceReady =
    !wantsReward ||
    (Boolean(rewardFlavorId) &&
      (!sauces.length || Boolean(rewardSauceId)) &&
      Boolean(quote));

  const continueToSauces = (event: FormEvent) => {
    event.preventDefault();
    if (!totalQuantity)
      return setNotice("Escolha pelo menos uma fatia para continuar.");
    if (!hasFirstAndLastName(name))
      return setNotice(
        "Informe seu nome e sobrenome para identificarmos o pedido.",
      );
    if (phone.replace(/\D/g, "").length < 10)
      return setNotice("Informe um WhatsApp válido com DDD.");
    if (!isPickupTimeAllowed(pickupTime, pickupWindow))
      return setNotice(pickupWindowMessage(pickupWindow));
    if (!quote)
      return setNotice(
        "Aguarde um instante enquanto confirmamos preços e disponibilidade.",
      );
    setNotice("");
    setStep("sauces");
  };

  const submit = async () => {
    if (!allSaucesChosen)
      return setNotice("Escolha uma opção de calda para cada fatia.");
    if (!rewardChoiceReady)
      return setNotice("Escolha o sabor e a calda da sua fatia-presente.");
    if (!paymentMethod) return setNotice("Escolha como deseja pagar.");

    setBusy(true);
    setNotice("");
    trackPublicEvent("instant_order_start", { quantity: totalQuantity });
    try {
      const response = await submitPublicInstantOrder({
        customerName: name.trim(),
        customerPhone: phone,
        items: selectedItems,
        notes: [
          `Horário desejado para retirada: ${pickupTime}`,
          notes.trim(),
        ].filter(Boolean).join("\n"),
        paymentMethod,
        reward: selectedReward,
      });
      if (!response.accepted) {
        setNotice(response.message);
        return;
      }
      setResult(response);
      setShowClubInvite(Boolean(response.offer_club_invite));
      if (response.total !== undefined) {
        setQuote((current) =>
          current
            ? {
                ...current,
                subtotal: Number(response.subtotal ?? current.subtotal),
                total: Number(response.total),
                reward_upgrade: Number(
                  response.reward_upgrade ?? current.reward_upgrade,
                ),
                server_calculated: true,
              }
            : current,
        );
      }
      trackPublicEvent("instant_order_success", {
        quantity: totalQuantity,
        checkout_mode: response.checkout_mode,
      });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o pedido.",
      );
    } finally {
      setBusy(false);
    }
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
    setPaymentMethod("pix");
    setQuote(null);
    onClose();
  };

  const joinClub = () => {
    sessionStorage.setItem(
      "adoce-club-order-invite",
      JSON.stringify({ name: name.trim(), phone }),
    );
    window.location.href = "/#cadastro";
  };

  if (!open) return null;
  const whatsappMessage = result?.order_number
    ? `Olá, Adoce! Acabei de montar o pedido ${result.order_number} pelo site.`
    : "Olá, Adoce! Quero montar um pedido de fatias para retirada.";

  return (
    <div className="instant-order-layer">
      <button
        className="instant-order-backdrop"
        aria-label="Fechar pedido"
        onClick={onClose}
      />
      {showClubInvite ? (
        <section
          className="instant-order-club-invite"
          role="dialog"
          aria-modal="true"
          aria-labelledby="club-invite-title"
        >
          <button
            type="button"
            className="instant-order-club-invite-close"
            aria-label="Agora não"
            onClick={() => setShowClubInvite(false)}
          >
            <X />
          </button>
          <img
            src="/site/clube-convite-pedido.webp"
            alt="Cartão fidelidade com carimbos e uma fatia de bolo como recompensa"
          />
          <div>
            <span>
              <Heart /> Um carinho para suas próximas escolhas
            </span>
            <h2 id="club-invite-title">Você já conhece o Clube Adoce?</h2>
            <p>
              Cada fatia confirmada vale um carimbo. Ao completar 14, você ganha
              uma fatia para adoçar o seu dia.
            </p>
            <strong>Quer participar?</strong>
            <div>
              <button type="button" onClick={joinClub}>
                <Gift /> Quero fazer parte
              </button>
              <button type="button" onClick={() => setShowClubInvite(false)}>
                Agora não
              </button>
            </div>
            <small>É opcional, gratuito e seu pedido já foi recebido normalmente.</small>
          </div>
        </section>
      ) : null}
      <aside
        className="instant-order-panel"
        role="dialog"
        aria-modal={showClubInvite ? undefined : "true"}
        aria-hidden={showClubInvite || undefined}
        aria-labelledby="instant-order-title"
      >
        <button className="instant-order-close" aria-label="Fechar" onClick={onClose}>
          <X />
        </button>
        {!result && step === "details" ? (
          <>
            <header>
              <span>
                <ShoppingBag /> Retirada de fatias
              </span>
              <h2 id="instant-order-title">Monte seu pedido</h2>
              <p>
                Escolha as quantidades. Preços e disponibilidade são confirmados
                pelo sistema antes do envio.
              </p>
            </header>
            <div className="instant-order-flavors">
              {flavors.map((flavor) => {
                const quantity = quantities[flavor.id] || 0;
                const quotedItem = quote?.items.find(
                  (item) => item.flavor_id === flavor.id,
                );
                return (
                  <article key={flavor.id} className={quantity ? "selected" : ""}>
                    <img src={flavor.image} alt={`Fatia ${flavor.name}`} />
                    <span>
                      <strong>{flavor.name}</strong>
                      <small>
                        {money(quotedItem?.unit_price ?? flavor.price)} cada
                      </small>
                    </span>
                    <div>
                      <button
                        type="button"
                        aria-label={`Remover uma ${flavor.name}`}
                        onClick={() => changeQuantity(flavor, -1)}
                        disabled={!quantity}
                      >
                        <Minus />
                      </button>
                      <b>{quantity}</b>
                      <button
                        type="button"
                        aria-label={`Adicionar uma ${flavor.name}`}
                        onClick={() => changeQuantity(flavor, 1)}
                        disabled={
                          flavor.free !== null && quantity >= flavor.free
                        }
                      >
                        <Plus />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <form onSubmit={continueToSauces}>
              <div className="instant-order-total">
                <span>
                  {totalQuantity} fatia(s)
                  {wantsReward ? " + 1 presente" : ""}
                  {quoting ? " · conferindo" : ""}
                </span>
                <strong>{money(displayTotal)}</strong>
              </div>
              <label>
                Nome e sobrenome
                <input
                  required
                  minLength={5}
                  autoComplete="name"
                  placeholder="Ex.: Rubens Bezerra"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                WhatsApp com DDD
                <input
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(85) 99999-9999"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
              {phone.replace(/\D/g, "").length >= 10 ? (
                <div
                  className={`instant-order-club-preview ${
                    loyaltyPreview?.recognized ? "recognized" : ""
                  }`}
                  aria-live="polite"
                >
                  {checkingClub ? (
                    <>
                      <Heart />
                      <span>
                        <strong>Consultando seu Clube Adoce...</strong>
                        <small>Só um instante.</small>
                      </span>
                    </>
                  ) : loyaltyPreview?.recognized ? (
                    <>
                      <Heart />
                      <span>
                        <strong>Seu Clube Adoce foi reconhecido</strong>
                        <small>
                          Você tem {loyaltyPreview.current_progress} de 14 carimbos.
                          Após o pagamento, ficará com {loyaltyPreview.projected_progress}
                          de 14.
                        </small>
                        {loyaltyPreview.will_unlock_reward ? (
                          <em>
                            <Gift /> Esta compra completa seu cartão e libera uma
                            fatia-presente.
                          </em>
                        ) : null}
                      </span>
                    </>
                  ) : (
                    <>
                      <Heart />
                      <span>
                        <strong>Cada fatia confirmada vale um carimbo</strong>
                        <small>
                          Entre no Clube para consultar e usar suas recompensas neste
                          pedido.
                        </small>
                      </span>
                    </>
                  )}
                </div>
              ) : null}
              {loyaltyPreview?.recognized &&
              Number(loyaltyPreview.reward_choices || 0) > 0 ? (
                <label className="instant-order-reward-choice">
                  <input
                    type="checkbox"
                    checked={wantsReward}
                    onChange={(event) => {
                      setWantsReward(event.target.checked);
                      if (!event.target.checked) {
                        setRewardFlavorId("");
                        setRewardSauceId("");
                      }
                    }}
                  />
                  <span>
                    <Gift />
                    <span>
                      <strong>Quero receber minha fatia-presente neste pedido</strong>
                      <small>
                        Você escolhe o sabor e a calda na próxima etapa. A diferença,
                        quando existir, é calculada pelo sistema.
                      </small>
                    </span>
                  </span>
                </label>
              ) : null}
              <label>
                Como deseja pagar?
                <select
                  required
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="">Escolha a forma de pagamento</option>
                  {paymentMethods.map((method) => (
                    <option key={method.code} value={method.code}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <small>
                  Somente formas liberadas para clientes aparecem aqui. A cobrança
                  ocorre após a confirmação da Adoce.
                </small>
              </label>
              <label>
                Horário desejado para retirada
                <input
                  required
                  type="time"
                  value={pickupTime}
                  min={pickupWindow?.min}
                  max={pickupWindow?.max}
                  onChange={(event) => setPickupTime(event.target.value)}
                />
                {pickupWindow ? <small>{pickupWindowHint(pickupWindow)}</small> : null}
              </label>
              <label>
                Observação <small>(opcional)</small>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Alguma informação importante"
                />
              </label>
              {notice ? (
                <p className="instant-order-notice" role="alert">
                  {notice}
                </p>
              ) : null}
              <button
                className="instant-order-submit"
                disabled={!totalQuantity || quoting || !quote}
              >
                {quoting ? "Confirmando valores..." : "Escolher caldas e enviar"}
              </button>
              <small className="instant-order-explanation">
                O valor mostrado foi recalculado no servidor. Nenhum pagamento será
                solicitado antes da confirmação da disponibilidade.
              </small>
            </form>
          </>
        ) : !result && step === "sauces" ? (
          <section className="instant-order-sauces">
            <button
              type="button"
              className="instant-order-back"
              onClick={() => {
                setStep("details");
                setNotice("");
              }}
            >
              <ArrowLeft /> Voltar ao pedido
            </button>
            <header>
              <span>
                <Droplets /> Seu pedido, do seu jeito
              </span>
              <h2 id="instant-order-title">Escolha suas caldas</h2>
              <p>
                {sauces.length
                  ? "Escolha uma opção para cada fatia. Se preferir, selecione sem calda."
                  : "As caldas acabaram por hoje, mas suas fatias continuam esperando por você."}
              </p>
            </header>
            {sauces.length ? (
              <div className="instant-order-sauce-list">
                {selectedUnits.map((unit) => (
                  <label key={unit.key}>
                    <span>
                      <img src={unit.flavor.image} alt="" />
                      <span>
                        <strong>{unit.flavor.name}</strong>
                        <small>Fatia {unit.unitNumber}</small>
                      </span>
                    </span>
                    <select
                      value={sauceChoices[unit.key] || ""}
                      onChange={(event) =>
                        setSauceChoices((current) => ({
                          ...current,
                          [unit.key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Escolha a calda</option>
                      <option value="none">Sem calda</option>
                      {sauces.map((sauce) => (
                        <option key={sauce.id} value={sauce.id}>
                          {sauce.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <p className="instant-order-no-sauce">
                <Droplets /> Hoje o pedido vai sem calda. Você ainda pode enviar suas
                fatias normalmente.
              </p>
            )}
            {wantsReward ? (
              <div className="instant-order-reward-picker-public">
                <span>
                  <Gift />
                  <span>
                    <strong>Sua fatia-presente</strong>
                    <small>
                      O sistema verifica a recompensa, o estoque e qualquer diferença
                      de valor.
                    </small>
                  </span>
                </span>
                <label>
                  Sabor
                  <select
                    value={rewardFlavorId}
                    onChange={(event) => setRewardFlavorId(event.target.value)}
                  >
                    <option value="">Escolha o sabor</option>
                    {flavors.map((flavor) => (
                      <option key={flavor.id} value={flavor.id}>
                        {flavor.name}
                        {rewardFlavorId === flavor.id && quote
                          ? rewardUpgrade > 0
                            ? ` · diferença ${money(rewardUpgrade)}`
                            : " · presente"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {sauces.length ? (
                  <label>
                    Calda
                    <select
                      value={rewardSauceId}
                      onChange={(event) => setRewardSauceId(event.target.value)}
                    >
                      <option value="">Escolha a calda</option>
                      <option value="none">Sem calda</option>
                      {sauces.map((sauce) => (
                        <option key={sauce.id} value={sauce.id}>
                          {sauce.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <small>Hoje ela será preparada sem calda.</small>
                )}
                {selectedReward ? (
                  <strong>
                    {quoting
                      ? "Calculando diferença..."
                      : rewardUpgrade > 0
                        ? `Diferença confirmada: ${money(rewardUpgrade)}`
                        : "Sem diferença de valor"}
                  </strong>
                ) : null}
              </div>
            ) : null}
            {notice ? (
              <p className="instant-order-notice" role="alert">
                {notice}
              </p>
            ) : null}
            <button
              type="button"
              className="instant-order-submit"
              disabled={
                busy || quoting || !quote || !allSaucesChosen || !rewardChoiceReady
              }
              onClick={() => void submit()}
            >
              {busy
                ? "Enviando com carinho..."
                : quoting
                  ? "Confirmando valores..."
                  : wantsReward
                    ? `Enviar pedido · ${money(displayTotal)}`
                    : sauces.length
                      ? `Enviar pedido · ${money(displayTotal)}`
                      : `Enviar somente as fatias · ${money(displayTotal)}`}
            </button>
          </section>
        ) : (
          <section className="instant-order-success">
            <Check />
            <span>Pedido recebido</span>
            <h2 id="instant-order-title">{result!.order_number}</h2>
            <p>{result!.message}</p>
            {loyaltyPreview?.recognized ? (
              <div className="instant-order-club-success">
                <Heart />
                <span>
                  <strong>
                    {totalQuantity} carimbo(s) reservado(s) para esta compra
                  </strong>
                  <small>
                    Eles entram no seu cartão assim que o pagamento for confirmado.
                    {loyaltyPreview.will_unlock_reward
                      ? " Esta compra também completa seu cartão e libera sua fatia-presente."
                      : ""}
                  </small>
                </span>
              </div>
            ) : null}
            {result!.reward_requested ? (
              <div className="instant-order-reward-success">
                <Gift />
                <span>
                  <strong>Sua fatia-presente entrou no pedido</strong>
                  <small>
                    {result!.reward_flavor_name}
                    {result!.reward_sauce_name
                      ? ` · ${result!.reward_sauce_name}`
                      : ""}
                    . Ela será resgatada e baixada do estoque quando o pagamento for
                    confirmado.
                  </small>
                </span>
              </div>
            ) : null}
            <dl>
              <div>
                <dt>Total confirmado</dt>
                <dd>{money(result!.total || 0)}</dd>
              </div>
              <div>
                <dt>Próximo passo</dt>
                <dd>Confira o WhatsApp</dd>
              </div>
            </dl>
            {result!.pickup_address ? (
              <div className="instant-order-pickup">
                <MapPin />
                <span>
                  <strong>{result!.pickup_label}</strong>
                  <small>{result!.pickup_address}</small>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(result!.pickup_address || "")
                  }
                >
                  <Copy /> Copiar
                </button>
              </div>
            ) : null}
            <a
              href={`https://wa.me/5585982156026?text=${encodeURIComponent(
                whatsappMessage,
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Acompanhar pelo WhatsApp
            </a>
            <button type="button" className="instant-order-finish" onClick={reset}>
              Concluir
            </button>
          </section>
        )}
      </aside>
    </div>
  );
}
