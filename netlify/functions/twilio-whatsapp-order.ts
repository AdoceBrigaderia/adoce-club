import twilio from "twilio";
import {whatsappHours,ordersClosedMessage,supportClosedMessage} from "./_shared/whatsapp-business-hours";
import { env, hmacHex, normalizeBrazilPhone, serviceClient } from "./_shared/whatsapp-auth";
import { downloadAndStoreTwilioMedia } from "./_shared/whatsapp-media";
import {
  catalogMessage,
  deliveryNoticeMessage,
  emptyFestivalMenuMessage,
  isFullName,
  mainMenuMessage,
  MAX_SLICES_PER_FLAVOR,
  normalizeCommand,
  optionsMessage,
  orderSummary,
  parseOption,
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
    const count=Number(form.get("NumMedia")||"0");
    if(!Number.isInteger(count)||count<1||count>10)throw Error("media_count");
    for(let index=0;index<count;index+=1){
    const sourceType=form.get(`MediaContentType${index}`)||"";
    const stored = await downloadAndStoreTwilioMedia(
      admin,
      form.get(`MediaUrl${index}`)||"",
      sourceType,
      env("TWILIO_ACCOUNT_SID") || "",
      authToken,
      `inbound/${threadId}`,
      `${messageSid}-${index}.${sourceType.split("/").at(-1) || "bin"}`,
    );
    const { error } = await admin.rpc("server_store_whatsapp_inbound_media", {
      requested_thread_id:threadId,requested_sid:`${messageSid}-media${index}`,requested_body:body || `Mídia recebida (${stored.kind})`,
      requested_kind:stored.kind,requested_path:stored.storagePath,requested_type:stored.contentType,
      requested_filename:stored.filename,requested_size:stored.sizeBytes,requested_bucket:"whatsapp-support-media",
    });
    if (error) throw new Error(`media_store:${error.code}`);
    }
  };

  const { data: prepared, error: prepareError } = await admin.rpc("server_prepare_whatsapp_order_message", {
    requested_message_sid: messageSid,
    requested_phone_hmac: phoneHash,
  });
  if (prepareError) return responseXml(twiml(), 503);
  if (prepared?.process === false) return responseXml(String(prepared.response_xml || twiml()));

  const observed=await admin.rpc("server_observe_whatsapp_message",{
    requested_phone_hmac:phoneHash,requested_phone_last4:phone.slice(-4),requested_message_sid:messageSid,requested_body:body,
  });
  if(observed.error || !observed.data?.id) return responseXml(twiml(),503);
  const observedThread=observed.data as {id:string;automation_mode:"bot"|"human"};
  let requestedHandoff=false;

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
    const { data: recordedXml, error } = await admin.rpc("server_finish_observed_whatsapp_message", {
      requested_message_sid: messageSid,
      requested_phone_hmac: phoneHash,
      requested_phone_last4: phone.slice(-4),
      requested_response_xml: xml,
      requested_step: nextConversation?.step || null,
      requested_state: nextConversation?.state || null,
      requested_expires_at: expires,
      requested_clear: clearBeforeFinish,
      requested_body:message,
      requested_handoff:requestedHandoff,
    });
    if (error || typeof recordedXml!=="string") return responseXml(twiml(),503);
    return responseXml(recordedXml, status);
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
      const hours=whatsappHours();
      return await finish([mainMenuMessage(),!hours.orders?ordersClosedMessage:"",!hours.support?supportClosedMessage:""].filter(Boolean).join("\n\n"));
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
      requestedHandoff=true;
      await save("handoff", { department, supportThreadId: String(threadId) });
      const notification = notifySupport(department, String(threadId));
      if (context?.waitUntil) context.waitUntil(notification);
      else void notification;
      const base = department === "festival"
        ? "Certo. Encaminhei sua conversa para a equipe do Festival de Fatias. Pode escrever sua dúvida por aqui."
        : "Certo. Encaminhei sua conversa para a equipe de orçamentos. Pode contar por aqui o que você deseja.";
      return await finish([note,base,!whatsappHours().support?supportClosedMessage:""].filter(Boolean).join("\n\n"));
    };
    const startOrder = async () => {
      if(!whatsappHours().orders) return await finish(ordersClosedMessage);
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

    const summaryMessage = (state: OrderState) => {
      const base = orderSummary({
        name: state.name || "Cliente",
        selections: state.selections || [],
        sauceLabel: describeSauce(state),
        paymentLabel: state.payment?.label || "A combinar",
      });
      const extras: string[] = [deliveryNoticeMessage(totalSlices(state))];
      extras.push("Aguarde a confirmação da separação pela equipe antes de pagar. Depois enviaremos a chave Pix e as orientações por aqui.");
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
        case "confirm":
          return summaryMessage(state);
        default:
          return mainMenuMessage();
      }
    };

    // Depois da calda: Pix é a única forma, então pula a pergunta e vai direto
    // para a confirmação (o cliente não escolhe horário nem quem retira).
    const afterSauce = async (state: OrderState, from: string) => {
      const payments = state.payments || [];
      if (!payments.length) return await handoff("festival");
      if (payments.length === 1) {
        const next = { ...state, payment: payments[0], previousStep: from };
        await save("confirm", next);
        return await finish(summaryMessage(next));
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
    const receiptOrderNumber = body.match(/\bFAT-\d{8}-[A-Z0-9]+\b/i)?.[0].toUpperCase() || null;
    if (receiptOrderNumber && !hasMedia) {
      const linked=await admin.rpc("server_link_order_receipts", {
        requested_phone:phone,requested_phone_hmac:phoneHash,requested_order_number:receiptOrderNumber,
      });
      if(linked.error) throw new Error("receipt_link");
      if(linked.data?.linked>0) return await finish(`O primeiro comprovante pendente foi vinculado ao pedido ${receiptOrderNumber}. A equipe vai conferir o pagamento.${linked.data.pending>0?" Ainda há outro comprovante pendente: envie o número do pedido correspondente ao próximo arquivo, na ordem em que você enviou.":""}`);
    }
    // Aceita comprovantes inclusive apos concluir a conversa e durante atendimento humano.
    const inSupport=observedThread.automation_mode === "human" || conversation?.step === "handoff";
    const receiptContext=!inSupport || Boolean(receiptOrderNumber) || /comprovante|paguei|pagamento|\bpix\b/i.test(body);
    if (hasMedia && receiptContext && (mediaContentType.startsWith("image/") || mediaContentType === "application/pdf")) {
      let receiptResult: {order_number?:string;candidates?:string[]} = {};
      const count=Number(form.get("NumMedia") || "0");
      if(!Number.isInteger(count) || count<1 || count>10) return responseXml(twiml("Envie até 10 arquivos por mensagem."),400);
      for(let index=0;index<count;index+=1) {
        const type=form.get(`MediaContentType${index}`) || "";
        if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(type))
          return await finish("Envie o comprovante como imagem JPG, PNG, WebP ou PDF.");
      }
      for(let index=0;index<count;index+=1) {
        const type=form.get(`MediaContentType${index}`) || "";
        const stored=await downloadAndStoreTwilioMedia(admin,form.get(`MediaUrl${index}`) || "",type,
          env("TWILIO_ACCOUNT_SID") || "",authToken,"receipts",`${messageSid}-${index}`,"order-payment-receipts");
        const saved=await admin.rpc("server_save_order_receipt",{
          requested_phone:phone,requested_phone_hmac:phoneHash,requested_order_number:receiptOrderNumber,
          requested_message_sid:index===0?messageSid:`${messageSid}-${index}`,
          requested_storage_path:stored.storagePath,requested_content_type:stored.contentType,requested_size_bytes:stored.sizeBytes,
        });
        if(saved.error) throw new Error("receipt_save");
        const logged=await admin.rpc("server_store_whatsapp_inbound_media",{
          requested_thread_id:observedThread.id,requested_sid:`${messageSid}-file${index}`,requested_body:body || "Comprovante recebido; aguardando conferência da equipe.",
          requested_kind:stored.kind,requested_path:stored.storagePath,requested_type:stored.contentType,
          requested_filename:stored.filename,requested_size:stored.sizeBytes,requested_bucket:"order-payment-receipts",
        });
        if(logged.error) throw new Error("receipt_history");
        receiptResult=saved.data || {};
      }
      if(receiptResult.order_number) return await finish(`Comprovante guardado no pedido ${receiptResult.order_number}. A equipe da Adoce vai conferir o pagamento.`);
      return await finish(`Guardei o anexo. Para vincular o primeiro comprovante pendente ao pedido correto, envie o número completo do pedido (FAT-...). Se enviou mais de um arquivo em mensagens diferentes, identifique cada pedido na mesma ordem dos envios.${receiptResult.candidates?.length ? `\nSeus pedidos: ${receiptResult.candidates.join(", ")}` : ""} O pagamento ainda será conferido pela equipe.`);
    }
    if (inSupport) {
      await storeInboundMedia(observedThread.id);
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
    if (hasMedia && conversation && conversation.step !== "handoff") {
      await storeInboundMedia(observedThread.id);
      return await finish(
        "Recebi seu anexo, mas para continuar o pedido preciso que você responda com o número da opção. Se quiser falar com uma pessoa, digite *atendente*.",
      );
    }
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

    if(!whatsappHours().orders) return await finish(ordersClosedMessage);
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
      await save("confirm", next);
      return await finish(summaryMessage(next));
    }

    if (conversation.step === "confirm") {
      if (isBackCommand(command)) {
        const reset = totalSlices(state) >= 2
          ? { ...state, sauceStep: "mode" as const, sauceMode: undefined, sauceSelections: undefined }
          : { ...state, sauceStep: "pick" as const, sauceMode: "uniform" as const };
        await save("sauce", { ...reset, previousStep: "name" });
        return await finish(renderStep("sauce", reset));
      }
      if (command === "2" || command === "3" || command === "cancelar") {
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
      });
      if (error) return await finish(cleanProviderError(error.message));
      if (!data?.accepted) return await finish(cleanProviderError(String(data?.message || "pedido recusado")));
      await save("completed", { operationKey: state.operationKey });
      return await finish([
        `Pedido *${data.order_number}* registrado com sucesso! 🎉`,
        `Total: ${Number(data.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        "",
        deliveryNoticeMessage(totalSlices(state)),
        "",
        "Recebemos seu pedido de reserva. Quando as fatias estiverem disponíveis, a equipe fará a separação. Aguarde a confirmação da separação e as instruções de pagamento por aqui antes de pagar.",
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
    if(hasMedia) return responseXml(twiml("Não consegui guardar seu anexo agora. Por favor, envie novamente em instantes. O pagamento ainda não foi confirmado."),503);
    return await finish("Não consegui continuar o atendimento automático agora. A equipe da Adoce continuará por aqui assim que estiver disponível.", 503);
  }
};

export const config = { path: "/api/twilio/whatsapp/order", timeout: 20 };
