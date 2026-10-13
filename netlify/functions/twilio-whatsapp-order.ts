import { downloadAndStoreTwilioMedia } from "./_shared/whatsapp-media";
import twilio from "twilio";
import { env, hmacHex, normalizeBrazilPhone, serviceClient } from "./_shared/whatsapp-auth";
import {
  catalogMessage,
  isFullName,
  normalizeCommand,
  optionsMessage,
  orderSummary,
  parseItemSelection,
  parseOption,
  parsePickupTime,
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
};
type Conversation = { step: string; state: OrderState } | null;
type OrderState = {
  operationKey?: string;
  flavors?: CatalogFlavor[];
  selections?: BotSelection[];
  name?: string;
  sauces?: BotOption[];
  sauce?: BotOption;
  pickupMethod?: "customer" | "driver";
  pickupTime?: string;
};

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
  if (/quantidade escolhida|dispon[iÃ­]vel|estoque|pronta/i.test(message))
    return "A disponibilidade mudou enquanto montÃ¡vamos o pedido. Envie *MENU* para conferir os sabores atualizados.";
  if (/hor[aÃ¡]rio|retirada|passou/i.test(message))
    return "Esse horÃ¡rio de retirada nÃ£o estÃ¡ mais disponÃ­vel. Envie *MENU* e monte novamente.";
  if (/muitas tentativas/i.test(message))
    return "Recebemos muitas tentativas em pouco tempo. Aguarde alguns minutos e envie *MENU*.";
  return "NÃ£o consegui registrar o pedido agora. Envie *MENU* para tentar novamente ou *ATENDENTE*.";
};

export default async (request: Request) => {
  if (request.method !== "POST") return responseXml(twiml("MÃ©todo nÃ£o permitido."), 405);
  if (env("WHATSAPP_ORDER_BOT_ENABLED") !== "true")
    return responseXml(twiml("O pedido automÃ¡tico estÃ¡ temporariamente indisponÃ­vel. Digite ATENDENTE."), 503);

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
  const phone = normalizeBrazilPhone(from.replace(/^whatsapp:/, ""));
  const normalizedExpected = expectedTo.startsWith("whatsapp:") ? expectedTo : `whatsapp:${expectedTo}`;
  if (!phone || to !== normalizedExpected || !/^[A-Za-z0-9]{8,80}$/.test(messageSid))
    return responseXml(twiml(), 400);

  const admin = serviceClient();
  if (!admin) return responseXml(twiml(), 503);
  const phoneHash = await hmacHex(hmacSecret, `phone:${phone}`);


  const mediaUrl = form.get("MediaUrl0") || "";
  const mediaContentType = form.get("MediaContentType0") || "";
  const hasMedia = Number(form.get("NumMedia") || "0") > 0 && Boolean(mediaUrl);
  if (hasMedia) {
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


    try {
      const { data: prepared, error: prepareError } = await admin.rpc("server_prepare_whatsapp_order_message", {
        requested_message_sid: messageSid, requested_phone_hmac: phoneHash,
      });
      if (prepareError || !prepared?.allowed) return responseXml(twiml(), 503);
      if (prepared.process === false) return responseXml(String(prepared.response_xml || twiml()));
      const observed = await admin.rpc("server_observe_whatsapp_message", {
        requested_phone_hmac: phoneHash, requested_phone_last4: phone.slice(-4), requested_message_sid: messageSid, requested_body: body,
      });
      if (observed.error || !observed.data?.id) return responseXml(twiml(), 503);
      const observedThread = observed.data as { id: string; automation_mode: "bot" | "human" };
      const conversation = prepared.conversation as Conversation;
      const finish = async (message: string) => {
        const { data: xml, error } = await admin.rpc("server_finish_observed_whatsapp_message", {
          requested_message_sid: messageSid, requested_phone_hmac: phoneHash, requested_phone_last4: phone.slice(-4),
          requested_response_xml: twiml(message), requested_step: null, requested_state: null, requested_expires_at: null,
          requested_clear: false, requested_body: message, requested_handoff: false,
        });
        return responseXml(typeof xml === "string" && !error ? xml : twiml(), error ? 503 : 200);
      };
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

      await storeInboundMedia(observedThread.id);
      return await finish("");
    } catch { return responseXml(twiml(), 503); }
  }

  const { data: claim, error: claimError } = await admin.rpc("server_begin_whatsapp_order_message", {
    requested_message_sid: messageSid,
    requested_phone_hmac: phoneHash,
  });
  if (claimError) return responseXml(twiml(), 503);
  if (claim?.process === false) return responseXml(String(claim.response_xml || twiml()));

  const finish = async (message: string, status = 200) => {
    const xml = twiml(message);
    const { error } = await admin.rpc("server_complete_whatsapp_order_message", {
      requested_message_sid: messageSid,
      requested_phone_hmac: phoneHash,
      requested_response_xml: xml,
    });
    if (error) console.error("whatsapp order completion failed", error.code);
    return responseXml(xml, status);
  };
  const save = async (step: string, state: OrderState) => {
    const expires = new Date(Date.now() + CONVERSATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error } = await admin.rpc("server_save_whatsapp_order_conversation", {
      requested_phone_hmac: phoneHash,
      requested_phone_last4: phone.slice(-4),
      requested_step: step,
      requested_state: state,
      requested_expires_at: expires,
    });
    if (error) throw new Error(`conversation:${error.code || "save"}`);
  };
  const clear = async () => {
    const { error } = await admin.rpc("server_clear_whatsapp_order_conversation", {
      requested_phone_hmac: phoneHash,
    });
    if (error) throw new Error(`conversation:${error.code || "clear"}`);
  };
  const loadCatalog = async () => {
    const { data, error } = await admin.rpc("server_get_whatsapp_order_catalog");
    if (error || !data) throw new Error(`catalog:${error?.code || "empty"}`);
    return data as Catalog;
  };

  try {
    const { data: limit, error: limitError } = await admin.rpc("consume_public_endpoint_rate_limit_bff", {
      requested_bucket: "whatsapp-order:inbound",
      requested_subject_hash: phoneHash,
      requested_window_seconds: 3600,
      requested_max_requests: 80,
    });
    if (limitError) return await finish("O atendimento automÃ¡tico estÃ¡ indisponÃ­vel. Digite *ATENDENTE*.", 503);
    if (limit?.allowed !== true)
      return await finish("Recebemos muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente.");

    const command = normalizeCommand(body);
    if (command === "cancelar" || command === "sair") {
      await clear();
      return await finish("Pedido cancelado. Quando quiser recomeÃ§ar, envie *MENU*.");
    }
    if (command === "atendente" || command === "humano") {
      await save("handoff", {});
      return await finish("Certo. Vou pausar a automaÃ§Ã£o. A equipe da Adoce continuarÃ¡ por aqui assim que estiver disponÃ­vel.");
    }

    const startMenu = async (name: string) => {
      const catalog = await loadCatalog();
      const flavors = catalog.flavors.slice(0, 20);
      if (!flavors.length) {
        await save("handoff", {});
        return await finish("NÃ£o hÃ¡ fatias disponÃ­veis para pedido automÃ¡tico agora. Digite *ATENDENTE* para falar com a Adoce.");
      }
      await save("choose_items", { flavors, name });
      return await finish(catalogMessage(flavors));
    };

    const startConversation = async () => {
      const catalog = await loadCatalog();
      const specialFlavors = catalog.flavors.filter((flavor) => flavor.price !== 16);
      const priceIntroduction = specialFlavors.length
        ? `As fatias tradicionais custam R$ 16,00. ${specialFlavors.map((flavor) => `${flavor.name} custa ${Number(flavor.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join("; ")}.`
        : "Cada fatia custa R$ 16,00.";
      await save("name", {});
      return await finish(`Oi! Que bom ter você por aqui 🍰\n\nJá conhece as fatias da Adoce? ${priceIntroduction}\n\nNão fazemos entregas. Seu pedido pode ser retirado aqui por você ou por um motorista de aplicativo que você solicitar.\n\nPara começar, qual é seu nome e sobrenome?`);
    };

    if (command === "menu" || command === "pedido" || command === "pedir" || command === "comprar") {
      await clear();
      return await startConversation();
    }

    const { data: loaded, error: conversationError } = await admin.rpc(
      "server_get_whatsapp_order_conversation",
      { requested_phone_hmac: phoneHash },
    );
    if (conversationError) throw new Error(`conversation:${conversationError.code}`);
    const conversation = (loaded || null) as Conversation;
    if (!conversation) return await startConversation();
    if (conversation.step === "handoff")
      return await finish("A automaÃ§Ã£o estÃ¡ pausada para este atendimento. Envie *MENU* para recomeÃ§ar.");
    if (conversation.step === "completed")
      return await finish("Seu pedido anterior jÃ¡ foi registrado. Envie *MENU* para fazer outro pedido.");

    const state = conversation.state || {};
    if (conversation.step === "name") {
      if (!isFullName(body)) return await finish("Informe seu nome e sobrenome. Exemplo: *Maria da Silva*.");
      return await startMenu(body.trim());
    }
    if (conversation.step === "choose_items") {
      const flavors = state.flavors || [];
      const parsed = parseItemSelection(body, flavors);
      if ("error" in parsed) return await finish(`${parsed.error}\n\n${catalogMessage(flavors)}`);
      const next = { ...state, selections: parsed.selections, operationKey: crypto.randomUUID() };
      const catalog = await loadCatalog();
      const nextWithSauces = { ...next, sauces: catalog.sauces };
      if (catalog.sauces.length) {
        await save("sauce", nextWithSauces);
        return await finish(`${optionsMessage("Escolha uma calda para todas as fatias:", catalog.sauces)}\n${catalog.sauces.length + 1}. Sem calda`);
      }
      await save("pickup_method", { ...nextWithSauces, sauce: { code: "", label: "Sem calda" } });
      return await finish("O pagamento é por *Pix*, após a confirmação da disponibilidade.\n\nQuem fará a retirada?\n\n1. Eu mesma(o)\n2. Motorista de aplicativo que eu solicitar");
    }

    if (conversation.step === "sauce") {
      const sauces = state.sauces || [];
      const index = Number(command);
      const sauce = index === sauces.length + 1
        ? { code: "", label: "Sem calda" }
        : parseOption(body, sauces);
      if (!sauce)
        return await finish(`${optionsMessage("Escolha uma das caldas:", sauces)}\n${sauces.length + 1}. Sem calda`);
      await save("pickup_method", { ...state, sauce });
      return await finish("O pagamento é por *Pix*, após a confirmação da disponibilidade.\n\nQuem fará a retirada?\n\n1. Eu mesma(o)\n2. Motorista de aplicativo que eu solicitar");
    }

    if (conversation.step === "payment") {
      await save("pickup_method", state);
      return await finish("O pagamento é por *Pix*. Quem fará a retirada?\n\n1. Eu mesma(o)\n2. Motorista de aplicativo que eu solicitar");
    }

    if (conversation.step === "pickup_method") {
      if (command !== "1" && command !== "2")
        return await finish("Escolha pelo nÃºmero:\n\n1. Eu mesma(o)\n2. Entregador de aplicativo");
      const catalog = await loadCatalog();
      const minimum = earliestPickup(state.selections || [], catalog);
      if (!minimum) return await finish("A disponibilidade mudou. Envie *MENU* para conferir os sabores novamente.");
      await save("pickup_time", { ...state, pickupMethod: command === "2" ? "driver" : "customer" });
      return await finish(`Qual horÃ¡rio deseja retirar? Seu pedido completo fica pronto a partir das *${minimum}*.\n\nResponda no formato *HH:MM*.`);
    }

    if (conversation.step === "pickup_time") {
      const catalog = await loadCatalog();
      const minimum = earliestPickup(state.selections || [], catalog);
      const pickupTime = minimum ? parsePickupTime(body, minimum) : null;
      if (!pickupTime)
        return await finish(`Informe um horÃ¡rio vÃ¡lido a partir das *${minimum || localClock()}*, no formato *HH:MM*.`);
      const next = { ...state, pickupTime };
      await save("confirm", next);
      return await finish(orderSummary({
        name: next.name || "Cliente",
        selections: next.selections || [],
        sauceLabel: next.sauce?.label || "Sem calda",
        paymentLabel: "Pix",
        pickupMethod: next.pickupMethod || "customer",
        pickupTime,
      }));
    }

    if (conversation.step === "confirm") {
      if (command !== "sim" && command !== "confirmar")
        return await finish("Responda *SIM* para registrar o pedido ou *CANCELAR*.");
      const catalog = await loadCatalog();
      const selections = state.selections || [];
      const freshById = new Map(catalog.flavors.map((item) => [item.id, item]));
      if (selections.some((item) => !freshById.has(item.id) || item.quantity > (freshById.get(item.id)?.free || 0))) {
        await clear();
        return await finish("A disponibilidade mudou antes da confirmaÃ§Ã£o. Envie *MENU* para ver os sabores atualizados.");
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
        requested_payment_method: "pix",
        requested_pickup_time: state.pickupTime,
        requested_pickup_method: state.pickupMethod,
      });
      if (error) return await finish(cleanProviderError(error.message));
      if (!data?.accepted) return await finish(cleanProviderError(String(data?.message || "pedido recusado")));
      await save("completed", { operationKey: state.operationKey });
      return await finish([
        `Pedido *${data.order_number}* registrado com sucesso! ðŸŽ‰`,
        `Total: ${Number(data.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        `Retirada: ${state.pickupTime}`,
        "",
        "A Adoce confirmarÃ¡ a disponibilidade e o pagamento por aqui. Nenhuma cobranÃ§a acontece antes dessa confirmaÃ§Ã£o.",
      ].join("\n"));
    }

    return await startConversation();
  } catch (error) {
    console.error("whatsapp order bot failed", error instanceof Error ? error.message.split(":")[0] : "unknown");
    return await finish("NÃ£o consegui continuar agora. Envie *MENU* para tentar novamente ou *ATENDENTE*.", 503);
  }
};

export const config = { path: "/api/twilio/whatsapp/order", timeout: 20 };
