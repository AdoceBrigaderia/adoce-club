import twilio from "twilio";
import { env, hmacHex, normalizeBrazilPhone, serviceClient } from "./_shared/whatsapp-auth";
import { downloadAndStoreTwilioMedia } from "./_shared/whatsapp-media";
import {
  catalogMessage,
  emptyFestivalMenuMessage,
  isFullName,
  mainMenuMessage,
  normalizeCommand,
  optionsMessage,
  orderSummary,
  parseOption,
  pickupTimeOptions,
  pickupTimesMessage,
  quantityMessage,
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
type OrderState = {
  operationKey?: string;
  flavors?: CatalogFlavor[];
  selections?: BotSelection[];
  name?: string;
  sauces?: BotOption[];
  sauce?: BotOption;
  payments?: BotOption[];
  payment?: BotOption;
  pickupMethod?: "customer" | "driver";
  pickupTime?: string;
  pickupOptions?: string[];
  menuMode?: boolean;
  emptyCatalog?: boolean;
  department?: SupportDepartment;
  supportThreadId?: string;
  pendingFlavorId?: string;
};
type SupportDepartment = "festival" | "quote";
type FunctionContext = { waitUntil?: (promise: Promise<unknown>) => void };

const MAX_WEBHOOK_BYTES = 32768;
const CONVERSATION_TTL_HOURS = 24;
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
  const required: string[] = [localClock()];
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
  return required.sort().at(-1) || null;
};

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
    const expires = nextConversation
      ? new Date(Date.now() + CONVERSATION_TTL_HOURS * 60 * 60 * 1000).toISOString()
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
    const handoff = async (department: SupportDepartment) => {
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
      return await finish(department === "festival"
        ? "Certo. Encaminhei sua conversa para a equipe do Festival de Fatias. Pode escrever sua dúvida por aqui."
        : "Certo. Encaminhei sua conversa para a equipe de orçamentos. Pode contar por aqui o que você deseja.");
    };
    const startOrder = async () => {
      const catalog = await loadCatalog();
      const flavors = catalog.flavors.slice(0, 20);
      if (!flavors.length) {
        await save("choose_items", { emptyCatalog: true });
        return await finish(emptyFestivalMenuMessage());
      }
      await save("choose_items", { flavors, selections: [] });
      return await finish(catalogMessage(flavors));
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
      const flavors = state.flavors || [];
      const selections = state.selections || [];
      if (state.pendingFlavorId) {
        const flavor = flavors.find((item) => item.id === state.pendingFlavorId);
        if (!flavor) return await startOrder();
        const selectedQuantity = selections.find((item) => item.id === flavor.id)?.quantity || 0;
        const totalQuantity = selections.reduce((sum, item) => sum + item.quantity, 0);
        const maximum = Math.min(10, flavor.free - selectedQuantity, 30 - totalQuantity);
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

      const choice = Number(command);
      if (!Number.isInteger(choice)) return await finish(catalogMessage(flavors, selections));
      if (choice >= 1 && choice <= flavors.length) {
        const flavor = flavors[choice - 1];
        const selectedQuantity = selections.find((item) => item.id === flavor.id)?.quantity || 0;
        const totalQuantity = selections.reduce((sum, item) => sum + item.quantity, 0);
        const maximum = Math.min(10, flavor.free - selectedQuantity, 30 - totalQuantity);
        if (maximum < 1) return await finish(`Esse sabor já atingiu o limite disponível.\n\n${catalogMessage(flavors, selections)}`);
        await save("choose_items", { ...state, pendingFlavorId: flavor.id });
        return await finish(quantityMessage(flavor, maximum));
      }
      if (choice === flavors.length + 1) {
        if (!selections.length) return await finish(`Escolha pelo menos um sabor antes de continuar.\n\n${catalogMessage(flavors, selections)}`);
        await save("name", { ...state, operationKey: state.operationKey || crypto.randomUUID() });
        return await finish("Agora digite seu *nome e sobrenome* para identificar o pedido.");
      }
      if (choice === flavors.length + 2) {
        await clear();
        return await showMainMenu();
      }
      if (choice === flavors.length + 3) return await handoff("festival");
      return await finish(catalogMessage(flavors, selections));
    }

    if (conversation.step === "name") {
      if (!isFullName(body)) return await finish("Digite seu nome e sobrenome. Exemplo: *Maria da Silva*.");
      const catalog = await loadCatalog();
      const sauces = [...catalog.sauces, { code: "", label: "Sem calda" }];
      const next = { ...state, name: body.trim(), sauces, payments: catalog.payment_methods };
      if (sauces.length) {
        await save("sauce", next);
        return await finish(optionsMessage("Escolha uma calda para todas as fatias:", sauces));
      }
      if (!catalog.payment_methods.length) return await handoff("festival");
      await save("payment", { ...next, sauce: { code: "", label: "Sem calda" } });
      return await finish(optionsMessage("Como deseja pagar?", catalog.payment_methods));
    }

    if (conversation.step === "sauce") {
      const sauce = parseOption(body, state.sauces || []);
      if (!sauce) return await finish(optionsMessage("Escolha uma calda para todas as fatias:", state.sauces || []));
      const payments = state.payments || [];
      if (!payments.length) return await handoff("festival");
      await save("payment", { ...state, sauce });
      return await finish(optionsMessage("Como deseja pagar?", payments));
    }

    if (conversation.step === "payment") {
      const payment = parseOption(body, state.payments || []);
      if (!payment) return await finish(optionsMessage("Escolha a forma de pagamento:", state.payments || []));
      await save("pickup_method", { ...state, payment });
      return await finish(optionsMessage("Quem fará a retirada?", [
        { code: "customer", label: "Eu mesma(o)" },
        { code: "driver", label: "Entregador de aplicativo" },
      ]));
    }

    if (conversation.step === "pickup_method") {
      if (command !== "1" && command !== "2")
        return await finish(optionsMessage("Quem fará a retirada?", [
          { code: "customer", label: "Eu mesma(o)" },
          { code: "driver", label: "Entregador de aplicativo" },
        ]));
      const catalog = await loadCatalog();
      const minimum = earliestPickup(state.selections || [], catalog);
      const pickupOptions = minimum ? pickupTimeOptions(minimum) : [];
      if (!pickupOptions.length) return await handoff("festival");
      await save("pickup_time", {
        ...state,
        pickupMethod: command === "2" ? "driver" : "customer",
        pickupOptions,
      });
      return await finish(pickupTimesMessage(pickupOptions));
    }

    if (conversation.step === "pickup_time") {
      const pickupOptions = state.pickupOptions || [];
      const selected = parseOption(body, pickupOptions.map((time) => ({ code: time, label: time })));
      if (!selected) return await finish(pickupTimesMessage(pickupOptions));
      const next = { ...state, pickupTime: selected.code };
      await save("confirm", next);
      return await finish(orderSummary({
        name: next.name || "Cliente",
        selections: next.selections || [],
        sauceLabel: next.sauce?.label || "Sem calda",
        paymentLabel: next.payment?.label || "A combinar",
        pickupMethod: next.pickupMethod || "customer",
        pickupTime: selected.code,
      }));
    }

    if (conversation.step === "confirm") {
      if (command === "2") {
        const catalog = await loadCatalog();
        const minimum = earliestPickup(state.selections || [], catalog);
        const pickupOptions = minimum ? pickupTimeOptions(minimum) : [];
        if (!pickupOptions.length) return await handoff("festival");
        await save("pickup_time", { ...state, pickupOptions });
        return await finish(pickupTimesMessage(pickupOptions));
      }
      if (command === "3" || command === "cancelar") {
        await clear();
        return await showMainMenu();
      }
      if (command !== "1" && command !== "sim" && command !== "confirmar")
        return await finish(orderSummary({
          name: state.name || "Cliente",
          selections: state.selections || [],
          sauceLabel: state.sauce?.label || "Sem calda",
          paymentLabel: state.payment?.label || "A combinar",
          pickupMethod: state.pickupMethod || "customer",
          pickupTime: state.pickupTime || "",
        }));
      const catalog = await loadCatalog();
      const selections = state.selections || [];
      const freshById = new Map(catalog.flavors.map((item) => [item.id, item]));
      if (selections.some((item) => !freshById.has(item.id) || item.quantity > (freshById.get(item.id)?.free || 0))) {
        await clear();
        return await startOrder();
      }
      const requestedItems = selections.map((item) => ({
        flavor_id: item.id,
        quantity: item.quantity,
        sauces: Array.from({ length: item.quantity }, (_, index) => ({
          unit_number: index + 1,
          sauce_id: state.sauce?.code || null,
        })),
      }));
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
        `Retirada: ${state.pickupTime}`,
        "",
        "A Adoce confirmará a disponibilidade e o pagamento por aqui. Nenhuma cobrança acontece antes dessa confirmação.",
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
