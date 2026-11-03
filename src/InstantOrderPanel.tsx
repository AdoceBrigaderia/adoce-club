import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Copy, Droplets, Gift, Heart, MapPin, MessageCircle, Minus, Package, Plus, ShoppingBag, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { trackPublicEvent } from "./analytics";
import { buildOrderWhatsAppMessage, orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import { pickupBoundsForDay, type PickupWindow } from "./pickup-window";
import { mascaraTelefone } from "./cadastro-rapido";
import { mergeOrderWithCart, readKnownOrders, rememberOrder, sameDayStatusLabel, type SameDayCheck } from "./same-day-orders";
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

export type PickupLocationCard = {
  name: string;
  address: string;
  timeLabel: string;
  icon: "pin" | "package";
};

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
  pickup_location_slug?: string;
  pickup_location_name?: string;
  message: string;
};

type OrderSauce = { id: string; name: string };
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
  initialPhone,
  pickupWindows = null,
  scheduleMessage = "",
  closedTodayLabel,
  pickupLocationCard,
  pickupLocationSlug = "cantinho-da-adoce",
}: {
  open: boolean;
  onClose: () => void;
  flavors: InstantOrderFlavor[];
  initialFlavorId?: string | null;
  // Vem do link que o bot do WhatsApp manda (?telefone=...) -- decisão do
  // proprietário em 02/11/2026: o bot não registra mais pedido sozinho, só
  // direciona para o carrinho do site, já com o WhatsApp preenchido.
  initialPhone?: string | null;
  pickupWindows?: PickupWindow[] | null;
  // Mensagem/horário de retirada de hoje (igual à mostrada no resto da
  // página) -- pedido do proprietário em 01/11/2026: mostrar isso num aviso
  // bloqueante assim que a tela de pedido abre, antes de qualquer outra
  // ação, e repetir como confirmação no passo final antes de enviar.
  scheduleMessage?: string;
  // Preenchido só quando a retirada de hoje já encerrou (fase
  // "finished_today" do serviceState) -- troca o aviso bloqueante genérico
  // pelo texto exato pedido pelo proprietário em 02/11/2026.
  closedTodayLabel?: string;
  // Card de confirmação (horário + local) mostrado uma vez, bloqueando o
  // envio, antes de finalizar o pedido -- decisão do proprietário em
  // 02/11/2026. Ausente quando a retirada de hoje não está aberta (o aviso
  // bloqueante de abertura/fechamento já cobre esses casos).
  pickupLocationCard?: PickupLocationCard;
  // Qual pickup_locations.slug vale para os pedidos de hoje -- decidido
  // pela operação (painel "Pedidos online" em AdoceHoje/OnlineOrdersControl),
  // nunca escolhido pela cliente.
  pickupLocationSlug?: string;
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
  const [step, setStep] = useState<"details" | "sauces" | "same_day">("details");
  const [sameDay, setSameDay] = useState<SameDayCheck | null>(null);
  const [sameDayAcknowledged, setSameDayAcknowledged] = useState(false);
  // Precisa reaparecer toda vez que a tela abre -- não é "só uma vez por
  // sessão": se o horário mudou de uma venda pra outra, a cliente precisa
  // ver de novo antes de montar o pedido.
  const [introAcknowledged, setIntroAcknowledged] = useState(false);
  const [pickupConfirmAcknowledged, setPickupConfirmAcknowledged] = useState(false);
  const [showPickupConfirm, setShowPickupConfirm] = useState(false);
  const [complementNote, setComplementNote] = useState("");
  const [sameDayMessage, setSameDayMessage] = useState("");
  const [newOrderAware, setNewOrderAware] = useState(false);
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
  const [editSauces, setEditSauces] = useState<Record<string, string>>({});
  const [notesMessage, setNotesMessage] = useState("");
  const [itemsMessage, setItemsMessage] = useState("");
  const [codeSent, setCodeSent] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [codeMessage, setCodeMessage] = useState("");
  const [sauces, setSauces] = useState<OrderSauce[]>([]);
  const [sauceChoices, setSauceChoices] = useState<Record<string, string>>({});
  const [loyaltyPreview, setLoyaltyPreview] = useState<LoyaltyPreview | null>(null);
  const [checkingClub, setCheckingClub] = useState(false);
  const [wantsReward, setWantsReward] = useState(false);
  const [rewardFlavorId, setRewardFlavorId] = useState("");
  const [rewardSauceId, setRewardSauceId] = useState("");
  const [showClubInvite, setShowClubInvite] = useState(false);
  const paymentMethod = "pix";
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
    if (!open || !initialPhone) return;
    setPhone((current) => current || mascaraTelefone(initialPhone));
  }, [open, initialPhone]);
  // Toda vez que a tela de pedido abre, o aviso de horário/mensagem de hoje
  // precisa aparecer de novo antes de qualquer outra ação.
  useEffect(() => {
    if (open) setIntroAcknowledged(false);
  }, [open]);
  useEffect(() => {
    if (open) {
      setPickupConfirmAcknowledged(false);
      setShowPickupConfirm(false);
    }
  }, [open]);
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

  // Decisão do proprietário em 02/11/2026: ao completar o WhatsApp, procura
  // automaticamente se é um cadastro do Clube Adoce e preenche o nome
  // sozinho -- sem login, sem código. Não dispara se a pessoa já digitou
  // (ou já veio preenchido) um nome; nunca sobrescreve o que foi digitado.
  useEffect(() => {
    if (!open || name.trim()) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    const timer = window.setTimeout(() => {
      fetch("/api/pedidos/cliente-por-telefone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { full_name?: string | null } | null) => {
          if (payload?.full_name) setName((current) => current || payload.full_name || "");
        })
        .catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [open, phone, name]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void requireSupabase().from("order_sauces").select("id,name").eq("active", true).order("sort_order").order("name").then((sauceResult) => {
      if (!active) return;
      setSauces((sauceResult.data || []) as OrderSauce[]);
    });
    return () => { active = false; };
  }, [open]);

  const totalQuantity = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );
  const specialFlavors = flavors.filter((flavor) => flavor.price !== 16);
  const priceIntroduction = specialFlavors.length
    ? `As fatias tradicionais custam R$ 16,00. ${specialFlavors.map((flavor) => `${flavor.name} custa ${money(flavor.price)}`).join("; ")}.`
    : "Cada fatia custa R$ 16,00.";
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

  // Sem nome e WhatsApp não dá para separar nem reservar a fatia, então a
  // identificação vem antes de montar o pedido -- em etapas: WhatsApp
  // primeiro (decisão do proprietário em 02/11/2026), depois nome e
  // sobrenome, só então o resto do carrinho. Quem já tem conta e está
  // logada tem nome e WhatsApp preenchidos sozinhos (efeito acima). Para
  // quem não está logada, o nome não é preenchido sozinho a partir do
  // WhatsApp digitado: isso exporia o nome de qualquer pessoa para quem
  // souber o número dela, sem provar que é a dona do WhatsApp.
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const nameOk = hasFirstAndLastName(name);
  const identified = nameOk && phoneOk;

  const changeQuantity = (flavor: InstantOrderFlavor, delta: number) => {
    if (delta > 0 && !identified) {
      setNotice("Primeiro informe seu WhatsApp com DDD e seu nome e sobrenome para escolher as fatias.");
      return;
    }
    setNotice("");
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
    if (pickupMinimum) setPickupTime((current) => (current && current >= pickupMinimum ? current : pickupMinimum));
  }, [pickupMinimum]);

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
  // A calda é escolhida no próprio card do sabor e começa em "sem calda",
  // então não existe mais etapa separada para ela.
  const allSaucesChosen = true;
  const rewardChoiceReady = !wantsReward || (Boolean(rewardFlavorId) && (!sauces.length || Boolean(rewardSauceId)));

  const detailsAreReady = () => {
    if (!totalQuantity) return setNotice("Escolha pelo menos uma fatia para continuar."), false;
    if (!hasFirstAndLastName(name)) return setNotice("Informe seu nome e sobrenome para identificarmos o pedido."), false;
    if (phone.replace(/\D/g, "").length < 10) return setNotice("Informe um WhatsApp válido com DDD."), false;
    if (!pickupTime) return setNotice("Escolha o horário desejado para a retirada."), false;
    if (pickupMinimum && pickupTime < pickupMinimum) {
      return setNotice(`Escolha um horário a partir das ${pickupMinimum.replace(":00", "h")} para retirar o pedido completo.`), false;
    }
    setNotice("");
    return true;
  };
  // Só a fatia-presente ainda precisa de uma etapa extra para escolher sabor.
  const needsSauceStep = wantsReward;

  const submit = async () => {
    if (!allSaucesChosen) return setNotice("Escolha uma opção de calda para cada fatia.");
    if (!rewardChoiceReady) return setNotice("Escolha o sabor e a calda da sua fatia-presente.");
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
    const serializedPayload = JSON.stringify({ ...requestPayload, paymentMethod, wantsReward, rewardFlavorId, rewardSauceId, pickupTime, pickupMethod, pickupLocationSlug });
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
      requested_pickup_location_slug: pickupLocationSlug,
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
    if (response.order_number && response.token) rememberOrder(response.order_number, response.token);
    setResult(response);
    setShowClubInvite(Boolean(response.offer_club_invite));
    trackPublicEvent("instant_order_success", {
      quantity: totalQuantity,
      checkout_mode: response.checkout_mode,
    });
    // Pedido do proprietário em 01/11/2026: não abrir o WhatsApp sozinho --
    // a cliente decide se e quando clica em "Finalizar pelo WhatsApp" (botão
    // na tela de sucesso, que já monta a mesma mensagem).
  };

  // Antes de criar outro pedido, confere se este celular ja pediu hoje.
  const checkSameDay = async (force = false) => {
    if (sameDayAcknowledged && !force) return false;
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("public_same_day_orders", {
      requested_phone: phone,
      known_orders: readKnownOrders().map(({ order_number, token }) => ({ order_number, token })),
    });
    setBusy(false);
    // Se a verificacao falhar, o pedido segue normalmente: a Operacao ainda
    // agrupa pedidos do mesmo celular.
    if (error || !(data as SameDayCheck)?.has_orders) return false;
    const check = data as SameDayCheck;
    const mine = check.orders[0];
    setSameDay(check);
    const savedNotes = mine?.customer_notes || "";
    setComplementNote(mine ? [savedNotes, notes.trim() && !savedNotes.includes(notes.trim()) ? notes.trim() : ""].filter(Boolean).join("\n") : notes);
    if (mine) {
      const merged = mergeOrderWithCart(mine, quantities, sauceChoices);
      setEditQuantities(merged.quantities);
      setEditSauces(merged.sauces);
    }
    setSameDayMessage("");
    setNotesMessage("");
    setItemsMessage("");
    setNewOrderAware(false);
    setCodeMessage("");
    setStep("same_day");
    return true;
  };

  // No aparelho do pedido a observacao e reescrita; em outro aparelho so
  // da para acrescentar um complemento, sem ver o que ja estava escrito.
  const sendComplement = async () => {
    const mine = sameDay?.orders[0];
    const known = mine ? readKnownOrders().find((order) => order.order_number === mine.order_number) : undefined;
    setBusy(true);
    const { data, error } = known
      ? await requireSupabase().rpc("public_set_order_notes", { order_code: known.order_number, order_token: known.token, requested_notes: complementNote })
      : await requireSupabase().rpc("public_add_order_complement", { requested_phone: phone, requested_note: complementNote, order_code: null, order_token: null });
    setBusy(false);
    const response = data as { ok: boolean; message: string } | null;
    if (error || !response) return setNotesMessage("Não foi possível enviar agora. Tente novamente ou fale com a loja pelo WhatsApp.");
    setNotesMessage(response.message);
    if (response.ok && !known) setComplementNote("");
  };

  const saveOrderItems = async () => {
    const mine = sameDay?.orders[0];
    const known = mine ? readKnownOrders().find((order) => order.order_number === mine.order_number) : undefined;
    if (!mine || !known) return;
    const requested = Object.entries(editQuantities).filter(([, quantity]) => quantity > 0).map(([flavorId, quantity]) => ({
      flavor_id: flavorId,
      quantity,
      sauces: Array.from({ length: quantity }, (_, index) => {
        const choice = editSauces[`${flavorId}:${index + 1}`];
        return { unit_number: index + 1, sauce_id: !choice || choice === "none" ? null : choice };
      }),
    }));
    if (!requested.length) return setItemsMessage("O pedido precisa ter pelo menos uma fatia. Para desistir de tudo, use \"Cancelar este pedido\".");
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("public_edit_order_items", { order_code: known.order_number, order_token: known.token, requested_items: requested });
    setBusy(false);
    const response = data as { ok: boolean; message: string; total?: number } | null;
    if (error || !response) return setItemsMessage("Não foi possível salvar agora. Tente novamente ou fale com a loja pelo WhatsApp.");
    setItemsMessage(response.message);
    if (response.ok) {
      setQuantities({});
      setSameDay((current) => current ? { ...current, orders: current.orders.map((order, index) => index ? order : {
        ...order,
        total: response.total ?? order.total,
        items: requested.map((item) => ({ flavor_id: item.flavor_id, quantity: item.quantity, name: editFlavorName(item.flavor_id), sauces: item.sauces })),
      }) } : current);
    }
  };

  const editFlavorName = (flavorId: string) =>
    flavors.find((flavor) => flavor.id === flavorId)?.name
    || sameDay?.orders[0]?.items.find((item) => item.flavor_id === flavorId)?.name
    || "Fatia";

  const editTotal = useMemo(() => {
    const order = sameDay?.orders[0];
    const orderUnits = order?.items.reduce((count, item) => count + item.quantity, 0) || 0;
    const fallback = order && orderUnits ? (Number(order.total) || 0) / orderUnits : 0;
    return Object.entries(editQuantities).reduce((sum, [flavorId, quantity]) =>
      sum + quantity * (flavors.find((flavor) => flavor.id === flavorId)?.price ?? fallback), 0);
  }, [editQuantities, flavors, sameDay]);

  const cancelSameDayOrder = async (orderNumber: string) => {
    const known = readKnownOrders().find((order) => order.order_number === orderNumber);
    if (!known || !window.confirm(`Cancelar o pedido ${orderNumber}?`)) return;
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("public_cancel_instant_order", { order_code: known.order_number, order_token: known.token });
    setBusy(false);
    const response = data as { ok: boolean; message: string } | null;
    if (error || !response) return setSameDayMessage("Não foi possível cancelar agora. Fale com a loja pelo WhatsApp.");
    setSameDayMessage(response.message);
    if (response.ok) setSameDay((current) => current ? { ...current, orders: current.orders.filter((order) => order.order_number !== orderNumber) } : current);
  };

  // Liberado o novo pedido, a pessoa volta ao carrinho para escolher as fatias.
  // Pedido feito em outro aparelho: o codigo chega no WhatsApp do pedido e
  // libera a edicao completa aqui (netlify/functions/order-access-code.ts).
  const requestAccessCode = async () => {
    setBusy(true);
    setCodeMessage("");
    const response = await fetch("/api/pedidos/codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", phone }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => ({})) as { masked_phone?: string; error?: string } | undefined;
    setBusy(false);
    if (!response?.ok) return setCodeMessage(payload?.error || "Não foi possível enviar o código agora.");
    setCodeSent(payload?.masked_phone || "seu WhatsApp");
    setAccessCode("");
  };

  const confirmAccessCode = async () => {
    setBusy(true);
    setCodeMessage("");
    const response = await fetch("/api/pedidos/codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", phone, code: accessCode }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => ({})) as { orders?: { order_number: string; token: string }[]; error?: string } | undefined;
    setBusy(false);
    if (!response?.ok) return setCodeMessage(payload?.error || "Não foi possível conferir o código agora.");
    for (const order of payload?.orders || []) rememberOrder(order.order_number, order.token);
    setCodeSent("");
    setAccessCode("");
    await checkSameDay(true);
  };

  const continueAsNewOrder = () => {
    setSameDayAcknowledged(true);
    setStep("details");
    setSameDayMessage("");
  };

  // Confere assim que o WhatsApp fica completo, antes de a pessoa montar o
  // carrinho inteiro a toa.
  const checkedPhone = useRef("");
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (!open || result || digits.length < 10) return;
    if (checkedPhone.current === digits) return;
    const timer = window.setTimeout(() => {
      checkedPhone.current = digits;
      setSameDayAcknowledged(false);
      void checkSameDay(true);
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, open, result]);

  const continueToSauces = async (event: FormEvent) => {
    event.preventDefault();
    if (!detailsAreReady()) return;
    if (await checkSameDay()) return;
    if (pickupLocationCard && !pickupConfirmAcknowledged) {
      setShowPickupConfirm(true);
      return;
    }
    if (needsSauceStep) {
      setStep("sauces");
      return;
    }
    void submit();
  };

  const confirmPickupAndContinue = () => {
    setPickupConfirmAcknowledged(true);
    setShowPickupConfirm(false);
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
    setSameDay(null);
    setSameDayAcknowledged(false);
    setComplementNote("");
    setSameDayMessage("");
    setSauceChoices({});
    setLoyaltyPreview(null);
    setCheckingClub(false);
    setWantsReward(false);
    setRewardFlavorId("");
    setRewardSauceId("");
    setShowClubInvite(false);
    setPickupMethod("customer");
    setPickupTime("");
    operationKey.current = crypto.randomUUID();
    operationPayload.current = "";
    onClose();
  };

  if (!open) return null;
  if (scheduleMessage && !introAcknowledged) {
    if (closedTodayLabel) {
      return (
        <div className="instant-order-layer">
          <div className="instant-order-backdrop" />
          <div className="instant-order-schedule-intro">
            <Clock3 />
            <h2>Retiradas encerradas por hoje</h2>
            <p>O horário de retirada de pedidos terminou às {closedTodayLabel}.</p>
            <p>Você ainda pode fazer seu pedido para retirada no próximo dia de funcionamento.</p>
            <button type="button" onClick={() => setIntroAcknowledged(true)}>Entendi, continuar</button>
          </div>
        </div>
      );
    }
    return (
      <div className="instant-order-layer">
        <div className="instant-order-backdrop" />
        <div className="instant-order-schedule-intro">
          <Clock3 />
          <h2>Antes de montar seu pedido</h2>
          <p>{scheduleMessage}</p>
          <button type="button" onClick={() => setIntroAcknowledged(true)}>OK, entendi</button>
        </div>
      </div>
    );
  }
  if (showPickupConfirm && pickupLocationCard) {
    return (
      <div className="instant-order-layer">
        <div className="instant-order-backdrop" />
        <div className="instant-order-pickup-confirm">
          {pickupLocationCard.icon === "package" ? <Package /> : <MapPin />}
          <h2>Antes de finalizar seu pedido</h2>
          <p>Confira onde e quando retirar seu pedido:</p>
          <div className="instant-order-pickup-confirm-card">
            <div>
              <Clock3 />
              <span>
                <strong>Horário de retirada</strong>
                <b>A partir das {pickupLocationCard.timeLabel}</b>
              </span>
            </div>
            <div>
              {pickupLocationCard.icon === "package" ? <Package /> : <MapPin />}
              <span>
                <strong>{pickupLocationCard.name}</strong>
                <b>{pickupLocationCard.address}</b>
              </span>
            </div>
          </div>
          <button type="button" onClick={confirmPickupAndContinue}>Entendi, continuar meu pedido</button>
        </div>
      </div>
    );
  }
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
      location: result.pickup_label && result.pickup_address
        ? `${result.pickup_label} — ${result.pickup_address}`
        : undefined,
    })
    : "Olá, Adoce! Quero montar um pedido de fatias para retirada.";

  return (
    <div className="instant-order-layer">
      <button className="instant-order-backdrop" aria-label="Fechar pedido" onClick={onClose} />
      {showClubInvite ? <section className="instant-order-club-invite" role="dialog" aria-modal="true" aria-labelledby="club-invite-title">
        <button type="button" className="instant-order-club-invite-close" aria-label="Fechar" onClick={() => setShowClubInvite(false)}><X /></button>
        <img src="/site/clube-convite-pedido.webp" alt="Cartão fidelidade com carimbos e uma fatia de torta como recompensa" />
        <div>
          <span><Heart /> Sua primeira compra merece um carinho especial!</span>
          <h2 id="club-invite-title">Boas-vindas ao Clube Adoce!</h2>
          <p>Com seu primeiro pedido, você já começa a juntar carimbos para ganhar uma fatia grátis.</p>
          <p><strong>Funciona assim:</strong> cada fatia comprada vale 1 carimbo. Juntou 14? Você ganha uma fatia tradicional por nossa conta!</p>
          <strong>Seu cadastro é automático e os carimbos aparecem após a confirmação do pagamento.</strong>
          <div><button type="button" onClick={() => setShowClubInvite(false)}><Gift /> Entendi</button></div>
          <small>É gratuito e seu pedido já foi recebido normalmente.</small>
        </div>
      </section> : null}
      <aside className="instant-order-panel" role="dialog" aria-modal={showClubInvite ? undefined : "true"} aria-hidden={showClubInvite || undefined} aria-labelledby="instant-order-title">
        <button className="instant-order-close" aria-label="Fechar" onClick={onClose}><X /></button>
        {!result && step === "details" ? <>
          <header>
            <img className="instant-order-logo" src="/brand-2026/logo-cantinho-adoce.png" alt="Cantinho da Adoce — Confeitaria Artesanal" />
            <h2 id="instant-order-title">Carrinho</h2>
          </header>
          <div className="instant-order-identify">
            <label className="instant-order-name">
              WhatsApp com DDD
              <input required inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" value={mascaraTelefone(phone)} onChange={(event) => setPhone(mascaraTelefone(event.target.value))} />
            </label>
            <label className={phoneOk ? "instant-order-name" : "instant-order-name is-locked"}>Nome e sobrenome<input required minLength={5} autoComplete="name" placeholder="Nome e sobrenome" value={name} onChange={(event) => setName(event.target.value)} disabled={!phoneOk} /></label>
          </div>
          {!flavors.length ? <div className="instant-order-empty">
            <ShoppingBag />
            <strong>Seu carrinho está vazio</strong>
            <p>Quando houver fatias disponíveis, escolha os sabores e volte aqui para concluir.</p>
            <a href="/cardapio" onClick={onClose}>Ver sabores</a>
          </div> : <div className={identified ? "instant-order-flavors" : "instant-order-flavors is-locked"} aria-disabled={!identified}>
            {!identified ? <p className="instant-order-identify-first" role="status">{phoneOk ? "Informe seu nome e sobrenome acima para escolher as fatias." : "Informe seu WhatsApp acima para escolher as fatias."}</p> : null}
            {flavors.map((flavor) => {
              const quantity = quantities[flavor.id] || 0;
              const readyAt = earliestPickupTimeForQuantity(flavor.batches, quantity, currentLocalTime());
              return <article key={flavor.id} className={quantity ? "selected" : ""}>
                <img src={flavor.image} alt={`Fatia ${flavor.name}`} />
                <span><strong>{flavor.name}</strong><small>{money(flavor.price)} cada</small></span>
                <div>
                  <button type="button" aria-label={`Remover uma ${flavor.name}`} onClick={() => changeQuantity(flavor, -1)} disabled={!quantity}><Minus /></button>
                  <b>{quantity}</b>
                  <button type="button" aria-label={`Adicionar uma ${flavor.name}`} onClick={() => changeQuantity(flavor, 1)} disabled={!identified || (flavor.free !== null && quantity >= flavor.free)}><Plus /></button>
                </div>
                {quantity > 0 && sauces.length ? <details className="instant-order-sauces-inline">
                  <summary><Droplets /> Caldas ({quantity})</summary>
                  {Array.from({ length: quantity }, (_, index) => <label key={index}>
                    Fatia {index + 1}
                    <select
                      aria-label={`Calda da fatia ${index + 1} de ${flavor.name}`}
                      value={sauceChoices[`${flavor.id}:${index + 1}`] || "none"}
                      onChange={(event) => setSauceChoices((current) => ({ ...current, [`${flavor.id}:${index + 1}`]: event.target.value }))}
                    >
                      <option value="none">Sem calda</option>
                      {sauces.map((sauce) => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}
                    </select>
                  </label>)}
                </details> : null}
                {flavor.batches.length ? <p className="instant-order-release-note" role="status"><Clock3 /><span>{quantity > 0 && readyAt ? <strong>{readyAt <= currentLocalTime() ? "Sua quantidade está disponível agora" : `Sua quantidade fica pronta a partir das ${readyAt.replace(":00", "h")}`}</strong> : null}{formatBatchAvailability(flavor.batches).map((line) => <small key={line}>{line}</small>)}</span></p> : null}
              </article>;
            })}
          </div>}
          {flavors.length ? <form onSubmit={continueToSauces}>
            <div className="instant-order-total"><span>{totalQuantity} fatia(s){wantsReward ? " + 1 presente" : ""}</span><strong>{money(displayTotal)}</strong></div>
            {phone.replace(/\D/g, "").length >= 10 ? <div className={`instant-order-club-preview ${loyaltyPreview?.recognized ? "recognized" : ""}`} aria-live="polite">
              {checkingClub ? <><Heart /><span><strong>Consultando seu Clube Adoce...</strong><small>Só um instante.</small></span></> : loyaltyPreview?.recognized ? <><Heart /><span><strong>Seu Clube Adoce foi reconhecido</strong><small>Você tem {loyaltyPreview.current_progress} de 14 carimbos. Após o pagamento deste pedido, ficará com {loyaltyPreview.projected_progress} de 14.</small>{loyaltyPreview.will_unlock_reward ? <em><Gift /> Esta compra completa seu cartão e libera uma fatia-presente.</em> : null}</span></> : <><Heart /><span><strong>Cada fatia confirmada vale um carimbo</strong><small>Se este WhatsApp estiver no Clube Adoce, os carimbos serão vinculados automaticamente após o pagamento.</small></span></>}
            </div> : null}
            {loyaltyPreview?.recognized && Number(loyaltyPreview.reward_choices || 0) > 0 ? <label className="instant-order-reward-choice"><input type="checkbox" checked={wantsReward} onChange={(event) => { setWantsReward(event.target.checked); if (!event.target.checked) { setRewardFlavorId(""); setRewardSauceId(""); } }} /><span><Gift /><span><strong>Quero receber minha fatia-presente neste pedido</strong><small>Você escolhe o sabor e a calda na próxima etapa. Ela só será resgatada após o pagamento.</small></span></span></label> : null}
            <p className="instant-order-payment-note"><strong>Pagamento por Pix.</strong> Enviaremos as orientações depois que a Adoce confirmar a disponibilidade.</p>
            {scheduleMessage ? <p className="instant-order-schedule-confirm" role="status"><Clock3 /><span><strong>Confira o horário antes de enviar:</strong> {scheduleMessage}</span></p> : null}
            <fieldset className="instant-order-pickup-choice"><legend>Quem fará a retirada?</legend><label><input type="radio" name="pickup-method" checked={pickupMethod === "customer"} onChange={() => setPickupMethod("customer")} /> Eu mesma(o)</label><label><input type="radio" name="pickup-method" checked={pickupMethod === "driver"} onChange={() => setPickupMethod("driver")} /> Entregador de aplicativo</label></fieldset>
            <label>Observação <small>(opcional)</small><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Alguma informação importante para a Adoce" /></label>
            {notice ? <p className="instant-order-notice" role="alert">{notice}</p> : null}
            <button className="instant-order-submit" disabled={!totalQuantity}>{needsSauceStep ? "Escolher minha fatia-presente" : "Enviar pedido"}</button>
            <small className="instant-order-explanation">Nenhum pagamento será solicitado antes da confirmação da disponibilidade.</small>
          </form> : null}
        </> : !result && step === "same_day" && sameDay ? <section className="instant-order-same-day" aria-labelledby="instant-order-title">
          <button type="button" className="instant-order-back" onClick={() => { setStep("details"); setSameDayMessage(""); }}><ArrowLeft /> Voltar ao carrinho</button>
          <header>
            <h2 id="instant-order-title">Você já fez um pedido hoje</h2>
            <p>{sameDay.orders.length ? "Para não duplicar, escolha abaixo o que você quer fazer com ele." : "Já existe um pedido hoje para este número. Se esqueceu de algo, mande como complemento para não duplicar."}</p>
          </header>
          {sameDay.orders.slice(0, 1).map((order) => {
            const known = readKnownOrders().find((item) => item.order_number === order.order_number);
            return <article key={order.order_number} className="instant-order-same-day-order">
              <strong>{order.order_number}</strong>
              <small>{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" })} · {sameDayStatusLabel[order.status] || order.status} · {money(Number(order.total) || 0)}</small>
              <ul>{order.items.map((item) => <li key={item.flavor_id || item.name}>{item.quantity}x {item.name}</li>)}</ul>
              <div>
                {known ? <a href={`/acompanhar?pedido=${encodeURIComponent(order.order_number)}&token=${encodeURIComponent(known.token)}`}>Ver como está meu pedido</a> : null}
                {order.can_cancel ? <button type="button" onClick={() => void cancelSameDayOrder(order.order_number)} disabled={busy}>Cancelar este pedido</button> : null}
              </div>
            </article>;
          })}
          {sameDayMessage ? <p className="instant-order-notice" role="status">{sameDayMessage}</p> : null}
          {!sameDay.orders.length ? <div className="instant-order-same-day-option instant-order-same-day-code">
            <h3>Fez o pedido em outro aparelho?</h3>
            {codeSent ? <>
              <p>Enviamos um código de 6 números para o WhatsApp {codeSent}. Digite aqui para ver e mudar o seu pedido.</p>
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Código recebido no WhatsApp" placeholder="000000" value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
              <button type="button" className="instant-order-submit" onClick={() => void confirmAccessCode()} disabled={busy || accessCode.length !== 6}>{busy ? "Conferindo..." : "Confirmar código"}</button>
              <button type="button" className="instant-order-same-day-new" onClick={() => void requestAccessCode()} disabled={busy}>Enviar outro código</button>
            </> : <>
              <p>Para ver os itens, mudar as fatias ou cancelar, confirme que o pedido é seu. Mandamos um código para o WhatsApp do pedido.</p>
              <button type="button" className="instant-order-submit" onClick={() => void requestAccessCode()} disabled={busy}>{busy ? "Enviando..." : "Sou eu, quero editar meu pedido"}</button>
            </>}
            {codeMessage ? <p className="instant-order-notice" role="alert">{codeMessage}</p> : null}
          </div> : null}

          <div className="instant-order-same-day-option">
            <h3>1. Observações do pedido</h3>
            <p>{sameDay.orders.length ? "Acrescente ou corrija o que a loja precisa saber." : "Escreva o que esqueceu. Vai junto com o pedido que já existe."}</p>
            <textarea aria-label="Observações do pedido" value={complementNote} onChange={(event) => setComplementNote(event.target.value)} placeholder="Ex.: sem calda na de Ninho, quem vai buscar é a Ana" maxLength={500} />
            <button type="button" className="instant-order-submit" onClick={() => void sendComplement()} disabled={busy || (!sameDay.orders.length && complementNote.trim().length < 2)}>{busy ? "Salvando..." : sameDay.orders.length ? "Salvar observação" : "Enviar junto com o pedido"}</button>
            {notesMessage ? <p className="instant-order-notice" role="status">{notesMessage}</p> : null}
          </div>

          <div className="instant-order-same-day-option">
            <h3>2. Mudar as fatias deste pedido</h3>
            {sameDay.orders[0]?.can_edit_items ? <>
              <p>Acrescente ou tire fatias no mesmo pedido. Já incluímos as que estavam no seu carrinho.</p>
              {[true, false].map((inOrderGroup) => {
                const ids = Array.from(new Set([...Object.keys(editQuantities), ...flavors.map((flavor) => flavor.id)]))
                  .filter((flavorId) => (flavorId in editQuantities) === inOrderGroup);
                if (!ids.length) return null;
                const rows = ids.map((flavorId) => {
                  const flavor = flavors.find((item) => item.id === flavorId);
                  const quantity = editQuantities[flavorId] || 0;
                  const inOrder = sameDay.orders[0].items.find((item) => item.flavor_id === flavorId)?.quantity || 0;
                  if (!flavor && !quantity) return null;
                  const limit = flavor && flavor.free !== null ? flavor.free + inOrder : inOrder;
                  return <div key={flavorId} className={quantity ? "selected" : ""}>
                    <span><strong>{editFlavorName(flavorId)}</strong>{flavor ? <small>{money(flavor.price)} cada</small> : <small>Esgotado para novas fatias</small>}</span>
                    <span className="instant-order-same-day-stepper">
                      <button type="button" aria-label={`Tirar uma ${editFlavorName(flavorId)}`} disabled={!quantity} onClick={() => setEditQuantities((current) => ({ ...current, [flavorId]: Math.max(0, (current[flavorId] || 0) - 1) }))}><Minus /></button>
                      <b>{quantity}</b>
                      <button type="button" aria-label={`Acrescentar uma ${editFlavorName(flavorId)}`} disabled={!flavor || (flavor.free !== null && quantity >= limit)} onClick={() => setEditQuantities((current) => ({ ...current, [flavorId]: (current[flavorId] || 0) + 1 }))}><Plus /></button>
                    </span>
                    {quantity && sauces.length ? <details className="instant-order-sauces-inline">
                      <summary><Droplets /> Caldas ({quantity})</summary>
                      {Array.from({ length: quantity }, (_, index) => <label key={index}>
                        Fatia {index + 1}
                        <select aria-label={`Calda da fatia ${index + 1} de ${editFlavorName(flavorId)}`} value={editSauces[`${flavorId}:${index + 1}`] || "none"} onChange={(event) => setEditSauces((current) => ({ ...current, [`${flavorId}:${index + 1}`]: event.target.value }))}>
                          <option value="none">Sem calda</option>
                          {sauces.map((sauce) => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}
                        </select>
                      </label>)}
                    </details> : null}
                  </div>;
                });
                return inOrderGroup
                  ? <div key="in-order" className="instant-order-same-day-editor">{rows}</div>
                  : <details key="others" className="instant-order-same-day-more"><summary><Plus /> Acrescentar outro sabor</summary><div className="instant-order-same-day-editor">{rows}</div></details>;
              })}
              <p className="instant-order-same-day-total">Novo total: <strong>{money(editTotal)}</strong></p>
              <button type="button" className="instant-order-submit" onClick={() => void saveOrderItems()} disabled={busy}>{busy ? "Salvando..." : "Salvar fatias no mesmo pedido"}</button>
              {itemsMessage ? <p className="instant-order-notice" role="status">{itemsMessage}</p> : null}
            </> : <p>{sameDay.orders.length
              ? "A loja já começou a cuidar deste pedido, então as fatias não podem mais ser mudadas por aqui. Fale com a gente pelo WhatsApp."
              : "Para mudar as fatias, abra o site no mesmo celular em que fez o pedido ou fale com a loja pelo WhatsApp."}</p>}
          </div>

          <div className="instant-order-same-day-option">
            <h3>3. Fazer outro pedido separado</h3>
            <label className="instant-order-same-day-aware"><input type="checkbox" checked={newOrderAware} onChange={(event) => setNewOrderAware(event.target.checked)} /><span>Quero fazer mais um pedido e estou ciente de que já existe um pedido anterior em meu nome hoje.</span></label>
            <button type="button" className="instant-order-same-day-new" onClick={continueAsNewOrder} disabled={busy || !newOrderAware}>Continuar para um novo pedido</button>
          </div>

          <a className="instant-order-same-day-whatsapp" href={orderWhatsAppUrl(orderWhatsAppNumber, "Olá, Adoce! Quero falar sobre o meu pedido de hoje.")} target="_blank" rel="noreferrer"><MessageCircle /> Falar com a loja</a>
        </section> : !result && step === "sauces" ? <section className="instant-order-sauces">
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
          {result!.pickup_address ? <div className="instant-order-pickup"><MapPin /><span><strong>{result!.pickup_label}</strong><small>{result!.pickup_address}</small>{result!.pickup_location_name ? <small>Pra chegar, é só escrever "{result!.pickup_location_name}" no Maps, Waze ou Uber.</small> : null}</span><button type="button" onClick={() => void navigator.clipboard.writeText(result!.pickup_address || "")}><Copy /> Copiar</button></div> : null}
          <a href={orderWhatsAppUrl(orderWhatsAppNumber, whatsappMessage)} target="_blank" rel="noreferrer"><MessageCircle /> Finalizar pelo WhatsApp</a>
          {result!.token ? <a className="instant-order-track" href={`/acompanhar?pedido=${encodeURIComponent(result!.order_number || "")}&token=${encodeURIComponent(result!.token)}`}>Acompanhar meu pedido</a> : null}
          <button type="button" className="instant-order-finish" onClick={reset}>Concluir</button>
        </section>}
      </aside>
    </div>
  );
}
