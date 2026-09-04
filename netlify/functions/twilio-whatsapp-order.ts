import twilio from "twilio";
import { env, hmacHex, normalizeBrazilPhone, serviceClient } from "./_shared/whatsapp-auth";
import { downloadAndStoreTwilioMedia } from "./_shared/whatsapp-media";
import {
  catalogMessage,
  driverAddressMessage,
  emptyFestivalMenuMessage,
  isFullName,
  mainMenuMessage,
  MAX_SLICES_PER_FLAVOR,
  normalizeCommand,
  optionsMessage,
  orderSummary,
  parseOption,
  PICKUP_CLOSING,
  PICKUP_OPENING,
  pickupTimeOptions,
  pickupTimesMessage,
  pixMessage,
  quantityMessage,
  removeItemMessage,
  sauceModeMessage,
  sliceSauceMessage,
  twiml,
  type BotFlavor,
  type BotOption,
  type BotSelection,
} from "./_shared/whatsapp-order-bot";

type CatalogBatch = { available_from: string; quantity_free: number };
type CatalogFlavor = BotFlavor & { batches: CatalogBatch[] };
type Catalog = {
  service_date: string;
  flavors: CatalogFlavor[];
  sauces: BotOption[];
  payment_methods: BotOption[];
};
type Conversation = { step: string; state: OrderState } | null;
type SauceChoice = { flavorId: string; unitNumber: number; code: string; label: string };
type MenuEntry = { id: string; name: string; price: number };
type OrderState = {
  operationKey?: string;
  menu?: MenuEntry[];
  selections?: BotSelection[];
  name?: string;
  sauces?: BotOption[];
  sauce?: BotOption;
  sauceStep?: "mode" | "pick";
  sauceMode?: "uniform" | "per_slice";
  sauceSelections?: SauceChoice[];
  payments?: BotOption[];
  payment?: BotOption;
  pickupMethod?: "customer" | "driver";
  pickupTime?: string;
  pickupOptions?: string[];
  menuMode?: boolean;
  emptyCatalog?: boolean;
  removing?: boolean;
  previousStep?: string;
  department?: SupportDepartment;
  supportThreadId?: string;
  pendingFlavorId?: string;
};
type SupportDepartment = "festival" | "quote";
type FunctionContext = { waitUntil?: (promise: Promise<unknown>) => void };

const MAX_WEBHOOK_BYTES = 32768;
// Pedido em andamento sem confirmação vence em 30 min — evita retomar um
// carrinho velho com estoque desatualizado. Só o atendimento humano dura mais.
const CONVERSATION_TTL_MINUTES = 30;
const HANDOFF_TTL_HOURS = 24;
const XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
  "Cache-Control": "no-store",
};

const responseXml = (xml: string, status = 200) =>
  new Response(xml || twiml(), { status, headers: XML_HEADERS });

const localClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
};

const earliestPickup = (selections: BotSelection[], catalog: Catalog) => {
  // Retirada só à noite: nunca antes das 20h e nunca depois das 23h.
  const now = localClock();
  const required: string[] = [PICKUP_OPENING];
  if (now > PICKUP_OPENING) required.push(now);
  for (const selection of selections) {
    const flavor = catalog.flavors.find((item) => item.id === selection.id);
    if (!flavor) return null;
    let accumulated = 0;
    let found: string | null = null;
    for (const batch of [...flavor.batches].sort((a, b) => a.available_from.localeCompare(b.available_from))) {
      accumulated += Number(batch.quantity_free || 0);
      if (accumulated >= selection.quantity) {
        found = batch.available_from.slice(0, 5);
        break;
      }
    }
    if (!found) return null;
    required.push(found);
  }
  const minimum = required.sort().at(-1) || null;
  if (minimum && minimum > PICKUP_CLOSING) return null;
  return minimum;
};

const totalSlices = (state: OrderState) =>
  (state.selections || []).reduce((sum, item) => sum + item.quantity, 0);

const sliceSlots = (state: OrderState) => {
  const slots: { flavorId: string; flavorName: string; unitNumber: number }[] = [];
  for (const item of state.selections || [])
    for (let unit = 1; unit <= item.quantity; unit += 1)
      slots.push({ flavorId: item.id, flavorName: item.name, unitNumber: unit });
  return slots;
};

const describeSauce = (state: OrderState) => {
  if (state.sauceMode === "per_slice" && state.sauceSelections?.length) {
    const counts = new Map<string, number>();
    for (const entry of state.sauceSelections)
      counts.set(entry.label, (counts.get(entry.label) || 0) + 1);
    return `por fatia — ${Array.from(counts, ([label, count]) => `${count}x ${label}`).join(", ")}`;
  }
  return state.sauce?.label || "Sem calda";
};

const isBackCommand = (command: string) => command === "0" || command === "voltar";

const cleanProviderError = (message: string) => {
  if (/quantidade escolhida|dispon[ií]vel|estoque|pronta/i.test(message))
    return "A disponibilidade mudou enquanto montávamos o pedido. Escolha 3 para cancelar e abrir o cardápio novamente.";
  if (/hor[aá]rio|retirada|passou/i.test(message))
    return "Esse horário de retirada não está mais disponível. Escolha 2 para selecionar outro horário.";
  if (/muitas tentativas/i.test(message))
    return "Recebemos muitas tentativas em pouco tempo. Aguarde alguns minutos antes de escolher novamente.";
  return "Não consegui registrar o pedido agora. Escolha 1 para tentar novamente, 2 para mudar o horário ou 3 para cancelar.";
};

export default async (request: Request, context?: FunctionContext) => {
  if (request.method !== "POST") return responseXml(twiml("Método não permitido."), 405);
  if (env("WHATSAPP_ORDER_BOT_ENABLED") !== "true")
    return responseXml(twiml("O pedido automático está temporariamente indisponível. A equipe da Adoce continuará o atendimento por aqui."), 503);

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_WEBHOOK_BYTES) return responseXml(twiml(), 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES)
    return responseXml(twiml(), 413);

  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const configuredUrl = env("TWILIO_WHATSAPP_ORDER_WEBHOOK_URL") || "";
  const expectedTo = env("TWILIO_WHATSAPP_FROM") || "";
  const hmacSecret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  if (!authToken || !configuredUrl || !expectedTo || !hmacSecret) return responseXml(twiml(), 503);

  const form = new URLSearchParams(rawBody);
  const params = Object.fromEntries(form.entries());
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature || !twilio.validateRequest(authToken, signature, configuredUrl, params))
    return responseXml(twiml(), 401);

  const from = form.get("From") || "";
  const to = form.get("To") || "";
  const messageSid = form.get("MessageSid") || form.get("SmsMessageSid") || "";
  const body = (form.get("Body") || "").slice(0, 4000);
  const mediaUrl = form.get("MediaUrl0") || "";
  const mediaContentType = form.get("MediaContentType0") || "";
  const hasMedia = Number(form.get("NumMedia") || "0") > 0 && Boolean(mediaUrl);
  const phone = normalizeBrazilPhone(from.replace(/^whatsapp:/, ""));
  const normalizedExpected = expectedTo.startsWith("whatsapp:") ? expectedTo : `whatsapp:${expectedTo}`;
  if (!phone || to !== normalizedExpected || !/^[A-Za-z0-9]{8,80}$/.test(messageSid))
    return responseXml(twiml(), 400);

  const admin = serviceClient();
  if (!admin) return responseXml(twiml(), 503);
  const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);
  const storeInboundMedia = async (threadId: string) => {
    if (!hasMedia) return;
    const stored = await downloadAndStoreTwilioMedia(
      admin,
      mediaUrl,
      mediaContentType,
      env("TWILIO_ACCOUNT_SID") || "",
      authToken,
      `inbound/${threadId}`,
      `${messageSid}.${mediaContentType.split("/").at(-1) || "bin"}`,
    );
    const { error } = await admin.schema("private").from("whatsapp_support_messages").insert({
      thread_id: threadId,
      message_sid: `${messageSid}-media`,
      direction: "inbound",
      body: body || `Mídia recebida (${stored.kind})`,
      media_kind: stored.kind,
      media_storage_path: stored.storagePath,
      media_content_type: stored.contentType,
      media_filename: stored.filename,
      media_size_bytes: stored.sizeBytes,
    });
    if (error) throw new Error(`media_store:${error.code}`);
  };

  const { data: prepared, error: prepareError } = await admin.rpc("server_prepare_whatsapp_order_message", {
    requested_message_sid: messageSid,
    requested_phone_hmac: phoneHash,
  });
  if (prepareError) return responseXml(twiml(), 503);
  if (prepared?.process === false) return responseXml(String(prepared.response_xml || twiml()));

  let nextConversation: { step: string; state: OrderState } | null = null;
  let clearBeforeFinish = false;
  const finish = async (message: string, status = 200) => {
    const xml = twiml(message);
    const ttlMs = nextConversation?.step === "handoff"
      ? HANDOFF_TTL_HOURS * 60 * 60 * 1000
      : CONVERSATION_TTL_MINUTES * 60 * 1000;
    const expires = nextConversation
      ? new Date(Date.now() + ttlMs).toISOString()
      : null;
    const { error } = await admin.rpc("server_finish_whatsapp_order_message", {
      requested_message_sid: messageSid,
      requested_phone_hmac: phoneHash,
      requested_phone_last4: phone.slice(-4),
      requested_response_xml: xml,
      requested_step: nextConversation?.step || null,
      requested_state: nextConversation?.state || null,
      requested_expires_at: expires,
      requested_clear: clearBeforeFinish,
    });
    if (error) console.error("whatsapp order completion failed", error.code);
    return responseXml(xml, status);
  };
  const save = async (step: string, state: OrderState) => {
    nextConversation = { step, state };
  };
  const clear = async () => {
    clearBeforeFinish = true;
    nextConversation = null;
  };
  const loadCatalog = async () => {
    const { data, error } = await admin.rpc("server_get_whatsapp_order_catalog");
    if (error || !data) throw new Error(`catalog:${error?.code || "empty"}`);
    return data as Catalog;
  };

  const notifySupport = async (department: SupportDepartment, threadId: string) => {
    const accountSid = env("TWILIO_ACCOUNT_SID") || "";
    const contentSid = env("TWILIO_SUPPORT_NOTIFICATION_CONTENT_SID") || "";
    const operator = department === "festival"
      ? env("TWILIO_FESTIVAL_STAFF_TO") || ""
      : env("TWILIO_QUOTE_STAFF_TO") || "";
    if (!accountSid || !contentSid || !operator) return;
    const destination = operator.startsWith("whatsapp:") ? operator : `whatsapp:${operator}`;
    const siteUrl = (env("SITE_URL") || "https://www.adocebrigaderia.com.br").replace(/\/$/, "");
    try {
      await twilio(accountSid, authToken).messages.create({
        from: normalizedExpected,
        to: destination,
        contentSid,
        contentVariables: JSON.stringify({
          "1": department === "festival" ? "Festival de Fatias" : "Orçamento",
          "2": phone.slice(-4),
          "3": `${siteUrl}/operacao?whatsapp=${encodeURIComponent(threadId)}`,
        }),
      });
    } catch (error) {
      console.error("whatsapp support notification failed", error instanceof Error ? error.name : "unknown");
    }
  };

  try {
    if (prepared?.allowed !== true)
      return await finish("Recebemos muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente.");

    const showMainMenu = async () => {
      await save("choose_items", { menuMode: true });
      return await finish(mainMenuMessage());
    };
    const handoff = async (department: SupportDepartment, note?: string) => {
      const { data: threadId, error } = await admin.rpc("server_open_whatsapp_support_thread", {
        requested_phone_hmac: phoneHash,
        requested_phone_last4: phone.slice(-4),
        requested_department: department,
        requested_message_sid: messageSid,
        requested_body: body,
      });
      if (error || !threadId) throw new Error(`support:${error?.code || "open"}`);
      await storeInboundMedia(String(threadId));
      await save("handoff", { department, supportThreadId: String(threadId) });
      const notification = notifySupport(department, String(threadId));
      if (context?.waitUntil) context.waitUntil(notification);
      else void notification;
      const base = department === "festival"
        ? "Certo. Encaminhei sua conversa para a equipe do Festival de Fatias. Pode escrever sua dúvida por aqui."
        : "Certo. Encaminhei sua conversa para a equipe de orçamentos. Pode contar por aqui o que você deseja.";
      return await finish(note ? `${note}\n\n${base}` : base);
    };
    const startOrder = async () => {
      const catalog = await loadCatalog();
      const flavors = catalog.flavors.slice(0, 20);
      if (!flavors.length) {
        await save("choose_items", { emptyCatalog: true });
        return await finish(emptyFestivalMenuMessage());
      }
      // Guarda só a lista estável (id/nome/preço). A quantidade disponível é
      // relida do catálogo a cada mensagem, nunca do estado.
      const menu = flavors.map((flavor) => ({ id: flavor.id, name: flavor.name, price: flavor.price }));
      await save("choose_items", { menu, selections: [] });
      return await finish(catalogMessage(flavors));
    };

    // Reconstrói a lista de sabores exibida (posição estável) com a quantidade
    // disponível ao vivo do catálogo recém-carregado.
    const liveFlavors = (state: OrderState, catalog: Catalog): BotFlavor[] => {
      const freeById = new Map(catalog.flavors.map((flavor) => [flavor.id, flavor.free]));
      return (state.menu || []).map((entry) => ({ ...entry, free: freeById.get(entry.id) ?? 0 }));
    };

    const pickupMethodOptions: BotOption[] = [
      { code: "customer", label: "Eu mesma(o)" },
      { code: "driver", label: "Entregador de aplicativo" },
    ];
    const pickupMethodPrompt = (state: OrderState) =>
      (state.payment?.code === "pix" ? `${pixMessage()}\n\n` : "") +
      optionsMessage("Quem fará a retirada?", pickupMethodOptions, true);
    const summaryMessage = (state: OrderState) => {
      const base = orderSummary({
        name: state.name || "Cliente",
        selections: state.selections || [],
        sauceLabel: describeSauce(state),
        paymentLabel: state.payment?.label || "A combinar",
        pickupMethod: state.pickupMethod || "customer",
        pickupTime: state.pickupTime || "",
      });
      const extras: string[] = [];
      if (state.pickupMethod === "driver") extras.push(driverAddressMessage(state.name || "seu nome"));
      if (state.payment?.code === "pix") extras.push(pixMessage());
      return [base, ...extras].join("\n\n");
    };

    // Reapresenta o texto de um passo anterior quando o cliente digita "0/voltar".
    const renderStep = (step: string, state: OrderState): string => {
      switch (step) {
        case "name":
          return "Agora digite seu *nome e sobrenome* para identificar o pedido.";
        case "sauce":
          if (state.sauceStep === "mode") return sauceModeMessage(totalSlices(state));
          if (state.sauceMode === "per_slice") {
            const slots = sliceSlots(state);
            const index = Math.min(state.sauceSelections?.length || 0, Math.max(slots.length - 1, 0));
            return sliceSauceMessage(index + 1, slots.length, slots[index]?.flavorName || "", state.sauces || []);
          }
          return optionsMessage("Escolha a calda para todas as fatias:", state.sauces || [], true);
        case "payment":
          return optionsMessage("Como deseja pagar?", state.payments || [], true);
        case "pickup_method":
          return pickupMethodPrompt(state);
        case "pickup_time":
          return pickupTimesMessage(state.pickupOptions || []);
        case "confirm":
          return summaryMessage(state);
        default:
          return mainMenuMessage();
      }
    };

    // Depois da calda: Pix é a única forma, então pula a pergunta e mostra a chave.
    const afterSauce = async (state: OrderState, from: string) => {
      const payments = state.payments || [];
      if (!payments.length) return await handoff("festival");
      if (payments.length === 1) {
        const next = { ...state, payment: payments[0], previousStep: from };
        await save("pickup_method", next);
        return await finish(pickupMethodPrompt(next));
      }
      await save("payment", { ...state, previousStep: from });
      return await finish(optionsMessage("Como deseja pagar?", payments, true));
    };

    const goBack = async (step: string, state: OrderState) => {
      const next = { ...state, previousStep: undefined };
      await save(step, next);
      return await finish(renderStep(step, next));
    };

    const command = normalizeCommand(body);
    const conversation = (prepared?.conversation || null) as Conversation;
    if (conversation?.step === "handoff") {
      const { data: supportThreadId, error } = await admin.rpc("server_append_whatsapp_support_message", {
        requested_phone_hmac: phoneHash,
        requested_message_sid: messageSid,
        requested_body: body,
      });
      if (error) throw new Error(`support:${error.code || "append"}`);
      if (!supportThreadId) {
        await clear();
        return await showMainMenu();
      }
      await storeInboundMedia(String(supportThreadId));
      return await finish("");
    }
    if (command === "cancelar" || command === "sair") {
      await clear();
      return await showMainMenu();
    }
    if (command === "atendente" || command === "humano") return await handoff("festival");
    if (["menu", "pedido", "pedir", "comprar"].includes(command)) {
      await clear();
      return await startOrder();
    }

    if (hasMedia && !conversation) return await handoff("festival");
    if (hasMedia && conversation && conversation.step !== "handoff")
      return await finish(
        "Recebi seu anexo, mas para continuar o pedido preciso que você responda com o número da opção. Se quiser falar com uma pessoa, digite *atendente*.",
      );
    if (!conversation) return await showMainMenu();
    if (conversation.step === "completed") {
      if (command === "1") return await startOrder();
      if (command === "2") return await handoff("festival");
      if (command === "3") return await handoff("quote");
      return await finish("1. Fazer outro pedido\n2. Falar com a equipe sobre o Festival de Fatias\n3. Realizar orçamento\n\nResponda com o número da opção desejada.");
    }

    const state = conversation.state || {};
    if (conversation.step === "choose_items" && state.emptyCatalog) {
      if (command === "1") return await handoff("festival");
      if (command === "2") {
        await clear();
        return await showMainMenu();
      }
      return await finish(emptyFestivalMenuMessage());
    }
    if (conversation.step === "choose_items" && state.menuMode) {
      if (command === "1") return await startOrder();
      if (command === "2") return await handoff("festival");
      if (command === "3") return await handoff("quote");
      return await finish(mainMenuMessage());
    }

    if (conversation.step === "choose_items") {
      // Estoque ao vivo: relê o catálogo a cada mensagem, nunca usa cache do estado.
      const catalog = await loadCatalog();
      const flavors = liveFlavors(state, catalog);
      const freeById = new Map(catalog.flavors.map((flavor) => [flavor.id, flavor.free]));
      const selections = state.selections || [];
      if (state.removing) {
        const next = { ...state };
        delete next.removing;
        const pick = Number(command);
        if (isBackCommand(command) || pick === selections.length + 1) {
          await save("choose_items", next);
          return await finish(catalogMessage(flavors, selections));
        }
        if (Number.isInteger(pick) && pick >= 1 && pick <= selections.length) {
          const updated = selections.filter((_, index) => index !== pick - 1);
          await save("choose_items", { ...next, selections: updated });
          return await finish(
            updated.length
              ? catalogMessage(flavors, updated)
              : `Pedido esvaziado.\n\n${catalogMessage(flavors, updated)}`,
          );
        }
        return await finish(removeItemMessage(selections));
      }
      if (state.pendingFlavorId) {
        const flavor = flavors.find((item) => item.id === state.pendingFlavorId);
        if (!flavor) return await startOrder();
        const selectedQuantity = selections.find((item) => item.id === flavor.id)?.quantity || 0;
        const maximum = Math.min(MAX_SLICES_PER_FLAVOR, flavor.free - selectedQuantity);
        if (maximum < 1) {
          const next = { ...state };
          delete next.pendingFlavorId;
          await save("choose_items", next);
          return await finish(`Esse sabor já atingiu o limite disponível.\n\n${catalogMessage(flavors, selections)}`);
        }
        const quantityIndex = Number(command);
        if (quantityIndex === maximum + 1) {
          const next = { ...state };
          delete next.pendingFlavorId;
          await save("choose_items", next);
          return await finish(catalogMessage(flavors, selections));
        }
        if (!Number.isInteger(quantityIndex) || quantityIndex < 1 || quantityIndex > maximum)
          return await finish(quantityMessage(flavor, maximum));
        const updated = selections.filter((item) => item.id !== flavor.id);
        updated.push({ ...flavor, quantity: selectedQuantity + quantityIndex });
        const next = { ...state, selections: updated };
        delete next.pendingFlavorId;
        await save("choose_items", next);
        return await finish(catalogMessage(flavors, updated));
      }

      const finishBasket = async () => {
        if (!selections.length)
          return await finish(`Escolha pelo menos um sabor antes de continuar.\n\n${catalogMessage(flavors, selections)}`);
        // Revalida a cesta contra o estoque ao vivo antes de seguir.
        const adjusted: BotSelection[] = [];
        const problems: string[] = [];
        for (const item of selections) {
          const live = freeById.get(item.id) ?? 0;
          if (live <= 0) {
            problems.push(`• ${item.name}: esgotou, tirei do pedido`);
            continue;
          }
          if (item.quantity > live) {
            problems.push(`• ${item.name}: só há ${live} agora, ajustei para ${live}`);
            adjusted.push({ ...item, quantity: live });
          } else {
            adjusted.push(item);
          }
        }
        if (problems.length) {
          await save("choose_items", { ...state, selections: adjusted });
          return await finish(
            `O estoque mudou enquanto você montava o pedido:\n${problems.join("\n")}\n\n${catalogMessage(flavors, adjusted)}`,
          );
        }
        await save("name", { ...state, operationKey: state.operationKey || crypto.randomUUID(), previousStep: "choose_items" });
        return await finish("Agora digite seu *nome e sobrenome* para identificar o pedido.");
      };
      if (["ok", "concluir", "continuar", "finalizar"].includes(command)) return await finishBasket();

      const choice = Number(command);
      if (!Number.isInteger(choice)) return await finish(catalogMessage(flavors, selections));
      if (choice >= 1 && choice <= flavors.length) {
        const flavor = flavors[choice - 1];
        const selectedQuantity = selections.find((item) => item.id === flavor.id)?.quantity || 0;
        const maximum = Math.min(MAX_SLICES_PER_FLAVOR, flavor.free - selectedQuantity);
        if (maximum < 1) {
          const reason = flavor.free <= 0 ? "esgotou" : "já atingiu o limite disponível";
          return await finish(`*${flavor.name}* ${reason}. Escolha outro sabor.\n\n${catalogMessage(flavors, selections)}`);
        }
        await save("choose_items", { ...state, pendingFlavorId: flavor.id });
        return await finish(quantityMessage(flavor, maximum));
      }
      if (choice === flavors.length + 1) return await finishBasket();
      if (choice === flavors.length + 2) {
        await clear();
        return await showMainMenu();
      }
      if (choice === flavors.length + 3) return await handoff("festival");
      if (selections.length && choice === flavors.length + 4) {
        await save("choose_items", { ...state, removing: true });
        return await finish(removeItemMessage(selections));
      }
      return await finish(catalogMessage(flavors, selections));
    }

    if (conversation.step === "name") {
      if (isBackCommand(command)) {
        const catalog = await loadCatalog();
        await save("choose_items", { ...state, previousStep: undefined });
        return await finish(catalogMessage(liveFlavors(state, catalog), state.selections || []));
      }
      if (!isFullName(body)) return await finish("Digite seu nome e sobrenome. Exemplo: *Maria da Silva*.");
      const catalog = await loadCatalog();
      const realSauces = catalog.sauces;
      const sauces = [...realSauces, { code: "", label: "Sem calda" }];
      const next = { ...state, name: body.trim(), sauces, payments: catalog.payment_methods };
      // Sem caldas cadastradas: não faz sentido perguntar, segue com "Sem calda".
      if (!realSauces.length)
        return await afterSauce({ ...next, sauce: { code: "", label: "Sem calda" }, sauceMode: "uniform" }, "name");
      if (totalSlices(next) >= 2) {
        await save("sauce", { ...next, sauceStep: "mode", previousStep: "name" });
        return await finish(sauceModeMessage(totalSlices(next)));
      }
      await save("sauce", { ...next, sauceStep: "pick", sauceMode: "uniform", previousStep: "name" });
      return await finish(optionsMessage("Escolha a calda para todas as fatias:", sauces, true));
    }

    if (conversation.step === "sauce") {
      const slots = sliceSlots(state);

      // Sub-passo "mode": mesma calda para todas ou escolher fatia por fatia?
      if (state.sauceStep === "mode") {
        if (isBackCommand(command)) return await goBack("name", state);
        if (command === "1") {
          await save("sauce", { ...state, sauceStep: "pick", sauceMode: "uniform", previousStep: "name" });
          return await finish(optionsMessage("Escolha a calda para todas as fatias:", state.sauces || [], true));
        }
        if (command === "2") {
          await save("sauce", {
            ...state,
            sauceStep: "pick",
            sauceMode: "per_slice",
            sauceSelections: [],
            previousStep: "name",
          });
          return await finish(sliceSauceMessage(1, slots.length, slots[0]?.flavorName || "", state.sauces || []));
        }
        return await finish(sauceModeMessage(totalSlices(state)));
      }

      const backFromSauce = async () => {
        // 2+ fatias: volta para a pergunta "mesma para todas?". 1 fatia: volta ao nome.
        if (slots.length >= 2) {
          const reset = { ...state, sauceStep: "mode" as const, sauceMode: undefined, sauceSelections: undefined };
          await save("sauce", { ...reset, previousStep: "name" });
          return await finish(sauceModeMessage(totalSlices(state)));
        }
        return await goBack("name", { ...state, sauceMode: undefined, sauceSelections: undefined });
      };

      // Sub-passo "pick" — fatia por fatia
      if (state.sauceMode === "per_slice") {
        const answered = state.sauceSelections || [];
        if (isBackCommand(command)) {
          if (!answered.length) return await backFromSauce();
          const trimmed = answered.slice(0, -1);
          await save("sauce", { ...state, sauceSelections: trimmed });
          const slot = slots[trimmed.length];
          return await finish(sliceSauceMessage(trimmed.length + 1, slots.length, slot?.flavorName || "", state.sauces || []));
        }
        const slot = slots[answered.length];
        const sauce = parseOption(body, state.sauces || []);
        if (!sauce)
          return await finish(sliceSauceMessage(answered.length + 1, slots.length, slot?.flavorName || "", state.sauces || []));
        const updated = [
          ...answered,
          { flavorId: slot.flavorId, unitNumber: slot.unitNumber, code: sauce.code, label: sauce.label },
        ];
        if (updated.length < slots.length) {
          await save("sauce", { ...state, sauceSelections: updated });
          const nextSlot = slots[updated.length];
          return await finish(sliceSauceMessage(updated.length + 1, slots.length, nextSlot.flavorName, state.sauces || []));
        }
        return await afterSauce({ ...state, sauceSelections: updated, sauce: undefined }, "sauce");
      }

      // Sub-passo "pick" — uniforme
      if (isBackCommand(command)) return await backFromSauce();
      const sauce = parseOption(body, state.sauces || []);
      if (!sauce) return await finish(optionsMessage("Escolha a calda para todas as fatias:", state.sauces || [], true));
      return await afterSauce({ ...state, sauce, sauceMode: "uniform", sauceSelections: undefined }, "sauce");
    }

    if (conversation.step === "payment") {
      if (isBackCommand(command)) {
        const reset = totalSlices(state) >= 2
          ? { ...state, sauceStep: "mode" as const, sauceMode: undefined, sauceSelections: undefined }
          : { ...state, sauceStep: "pick" as const, sauceMode: "uniform" as const };
        await save("sauce", { ...reset, previousStep: "name" });
        return await finish(renderStep("sauce", reset));
      }
      const payment = parseOption(body, state.payments || []);
      if (!payment) return await finish(optionsMessage("Como deseja pagar?", state.payments || [], true));
      const next = { ...state, payment, previousStep: "payment" };
      await save("pickup_method", next);
      return await finish(pickupMethodPrompt(next));
    }

    if (conversation.step === "pickup_method") {
      if (isBackCommand(command)) {
        if ((state.payments || []).length > 1) return await goBack("payment", state);
        const reset = totalSlices(state) >= 2
          ? { ...state, sauceStep: "mode" as const, sauceMode: undefined, sauceSelections: undefined }
          : { ...state, sauceStep: "pick" as const, sauceMode: "uniform" as const };
        await save("sauce", { ...reset, previousStep: "name" });
        return await finish(renderStep("sauce", reset));
      }
      if (command !== "1" && command !== "2") return await finish(pickupMethodPrompt(state));
      const catalog = await loadCatalog();
      const minimum = earliestPickup(state.selections || [], catalog);
      const pickupOptions = minimum ? pickupTimeOptions(minimum) : [];
      if (!pickupOptions.length)
        return await handoff(
          "festival",
          `Não consegui montar um horário de retirada (a retirada é das ${PICKUP_OPENING} às ${PICKUP_CLOSING}).`,
        );
      const pickupMethod: "customer" | "driver" = command === "2" ? "driver" : "customer";
      await save("pickup_time", { ...state, pickupMethod, pickupOptions, previousStep: "pickup_method" });
      return await finish(
        (pickupMethod === "driver" ? `${driverAddressMessage(state.name || "seu nome")}\n\n` : "") +
          pickupTimesMessage(pickupOptions),
      );
    }

    if (conversation.step === "pickup_time") {
      if (isBackCommand(command)) return await goBack("pickup_method", state);
      const pickupOptions = state.pickupOptions || [];
      const selected = parseOption(body, pickupOptions.map((time) => ({ code: time, label: time })));
      if (!selected) return await finish(pickupTimesMessage(pickupOptions));
      const next = { ...state, pickupTime: selected.code, previousStep: "pickup_time" };
      await save("confirm", next);
      return await finish(summaryMessage(next));
    }

    if (conversation.step === "confirm") {
      if (isBackCommand(command) || command === "2") {
        const catalog = await loadCatalog();
        const minimum = earliestPickup(state.selections || [], catalog);
        const pickupOptions = minimum ? pickupTimeOptions(minimum) : [];
        if (!pickupOptions.length)
          return await handoff("festival", "O horário que você tinha escolhido não está mais disponível.");
        await save("pickup_time", { ...state, pickupOptions, previousStep: "pickup_method" });
        return await finish(pickupTimesMessage(pickupOptions));
      }
      if (command === "3" || command === "cancelar") {
        await clear();
        return await showMainMenu();
      }
      if (command !== "1" && command !== "sim" && command !== "confirmar")
        return await finish(summaryMessage(state));
      const catalog = await loadCatalog();
      const selections = state.selections || [];
      const freshById = new Map(catalog.flavors.map((item) => [item.id, item]));
      if (selections.some((item) => !freshById.has(item.id) || item.quantity > (freshById.get(item.id)?.free || 0))) {
        await clear();
        return await startOrder();
      }
      const perSliceByFlavor = new Map<string, SauceChoice[]>();
      if (state.sauceMode === "per_slice")
        for (const entry of state.sauceSelections || []) {
          const list = perSliceByFlavor.get(entry.flavorId) || [];
          list.push(entry);
          perSliceByFlavor.set(entry.flavorId, list);
        }
      const requestedItems = selections.map((item) => {
        const perSlice = perSliceByFlavor.get(item.id) || null;
        return {
          flavor_id: item.id,
          quantity: item.quantity,
          sauces: Array.from({ length: item.quantity }, (_, index) => {
            const chosen = perSlice?.find((entry) => entry.unitNumber === index + 1);
            return {
              unit_number: index + 1,
              sauce_id: (chosen ? chosen.code : state.sauce?.code) || null,
            };
          }),
        };
      });
      const { data, error } = await admin.rpc("server_submit_whatsapp_order", {
        requested_operation_key: state.operationKey,
        requested_customer_name: state.name,
        requested_customer_phone: phone,
        requested_items: requestedItems,
        requested_payment_method: state.payment?.code,
        requested_pickup_time: state.pickupTime,
        requested_pickup_method: state.pickupMethod,
      });
      if (error) return await finish(cleanProviderError(error.message));
      if (!data?.accepted) return await finish(cleanProviderError(String(data?.message || "pedido recusado")));
      await save("completed", { operationKey: state.operationKey });
      return await finish([
        `Pedido *${data.order_number}* registrado com sucesso! 🎉`,
        `Total: ${Number(data.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        `Retirada: ${state.pickupTime}${state.pickupMethod === "driver" ? " (entregador de aplicativo)" : ""}`,
        "",
        pixMessage(),
        "",
        "A Adoce confirmará a disponibilidade e o pagamento por aqui.",
        "",
        "1. Fazer outro pedido",
        "2. Falar com a equipe da Adoce",
      ].join("\n"));
    }

    return await showMainMenu();
  } catch (error) {
    console.error("whatsapp order bot failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return await finish("Não consegui continuar o atendimento automático agora. A equipe da Adoce continuará por aqui assim que estiver disponível.", 503);
  }
};

export const config = { path: "/api/twilio/whatsapp/order", timeout: 20 };
