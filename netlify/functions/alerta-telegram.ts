// Rede de seguranca dos avisos da Adoce — entrega por Telegram.
//
// O Web Push (alerta-pedidos.ts) e o canal oficial. Este aqui existe porque um
// aviso perdido custou uma cliente: em 07/08/2026 a Juliana pediu duas fatias
// as 12h40, ninguem soube, e as 18h os dois sabores tinham acabado.
//
// Dois canais independentes, lendo filas diferentes: se um falhar, o outro
// avisa. Este le outbox_events, que guarda o pedido inteiro — sabores, caldas,
// total — e por isso a mensagem daqui e mais completa que a do push.
//
// Nada disto chega ao cliente. E so para o Rubens e a Beth.
//
// Roda a cada minuto pelo agendador do Netlify.

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHATS = (process.env.TELEGRAM_CHAT_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  // Enquanto o valor de exemplo continuar no Netlify, nao ha destinatario real.
  .filter((s) => !s.startsWith("COLE-AQUI"));

const TOPICOS = ["instant_order.created", "service_request.created"];
const LOTE = 20;

type Evento = {
  id: string;
  topic: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const dinheiro = (v: unknown) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const horaFortaleza = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

async function supa(caminho: string, init?: RequestInit) {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!resposta.ok) throw new Error(`Supabase ${resposta.status}: ${await resposta.text()}`);
  return resposta.status === 204 ? null : resposta.json();
}

async function avisar(texto: string) {
  // Um destinatario que falha nao pode impedir os outros de receber.
  const entregas = await Promise.allSettled(
    TELEGRAM_CHATS.map((chat) =>
      fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text: texto,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
      }),
    ),
  );
  const falhou = entregas.filter((e) => e.status === "rejected");
  if (falhou.length === entregas.length) {
    throw new Error(`Nenhum destinatario recebeu: ${(falhou[0] as PromiseRejectedResult).reason}`);
  }
}

async function textoDePedido(evento: Evento) {
  const numero = String(evento.payload.order_number || "");
  const pedidos = (await supa(
    `instant_orders?order_number=eq.${encodeURIComponent(numero)}` +
    `&select=id,customer_name,customer_phone,total,status,customer_notes,created_at`,
  )) as Array<Record<string, string>>;
  const p = pedidos?.[0];
  if (!p) return null;

  const itens = (await supa(
    `instant_order_items?order_id=eq.${p.id}&select=flavor_name,quantity,is_reward,` +
    `instant_order_item_sauces(sauce_name)`,
  )) as Array<{
    flavor_name: string; quantity: number; is_reward: boolean;
    instant_order_item_sauces?: Array<{ sauce_name: string | null }>;
  }>;

  const linhas = (itens || []).map((i) => {
    const caldas = (i.instant_order_item_sauces || [])
      .map((s) => s.sauce_name || "sem calda");
    const calda = caldas.length ? ` · ${[...new Set(caldas)].join(", ")}` : "";
    return `• ${i.quantity}× ${i.flavor_name}${calda}${i.is_reward ? " 🎁 presente" : ""}`;
  });

  const telefone = String(p.customer_phone || "").replace(/\D/g, "");

  return [
    `🍰 <b>Pedido novo</b> — ${numero}`,
    ``,
    `<b>${p.customer_name}</b>`,
    linhas.join("\n"),
    ``,
    `Total: <b>${dinheiro(p.total)}</b>`,
    p.customer_notes ? `Observação: <i>${p.customer_notes}</i>` : "",
    `Feito às ${horaFortaleza(p.created_at)}`,
    ``,
    `<a href="https://wa.me/${telefone}">Responder no WhatsApp</a>`,
  ].filter(Boolean).join("\n");
}

async function textoDeSolicitacao(evento: Evento) {
  const id = evento.aggregate_id;
  if (!id) return null;
  const linhas = (await supa(
    `service_requests?id=eq.${id}&select=request_number,customer_name,customer_phone,` +
    `quantity,desired_start,service_location,selections,customer_notes,created_at`,
  )) as Array<Record<string, unknown>>;
  const s = linhas?.[0];
  if (!s) return null;

  const preferencias = (s.selections as { preferences?: string } | null)?.preferences || "";
  const telefone = String(s.customer_phone || "").replace(/\D/g, "");

  return [
    `📋 <b>Orçamento novo</b> — ${s.request_number}`,
    ``,
    `<b>${s.customer_name}</b>`,
    `${s.quantity} unidade(s)`,
    preferencias ? `<i>${preferencias}</i>` : "",
    ``,
    `Para: ${horaFortaleza(String(s.desired_start))}`,
    s.service_location ? `Local: ${s.service_location}` : "",
    s.customer_notes ? `Observação: <i>${s.customer_notes}</i>` : "",
    ``,
    `<a href="https://wa.me/${telefone}">Responder no WhatsApp</a>`,
  ].filter(Boolean).join("\n");
}

export default async function handler() {
  const inicio = Date.now();
  let entregues = 0;
  let falhas = 0;

  try {
    // Sem bot configurado nao ha erro a reportar: e so um canal ainda desligado.
    // Os eventos continuam pendentes e chegam quando o token entrar.
    if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.startsWith("COLE-AQUI") || !TELEGRAM_CHATS.length) {
      return new Response(
        JSON.stringify({ entregues: 0, aviso: "Telegram ainda nao configurado." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const filtroTopico = TOPICOS.map((t) => `"${t}"`).join(",");
    const eventos = (await supa(
      `outbox_events?status=eq.pending&topic=in.(${filtroTopico})` +
      `&select=id,topic,aggregate_id,payload,created_at&order=created_at.asc&limit=${LOTE}`,
    )) as Evento[];

    for (const evento of eventos || []) {
      try {
        const texto = evento.topic === "instant_order.created"
          ? await textoDePedido(evento)
          : await textoDeSolicitacao(evento);

        if (!texto) {
          // Registro sumiu ou foi apagado: nao adianta reprocessar para sempre.
          // O enum outbox_status aceita apenas pending, processing, completed e failed.
          await supa(`outbox_events?id=eq.${evento.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "failed", processed_at: new Date().toISOString(),
              last_error: "Registro de origem nao encontrado",
            }),
          });
          continue;
        }

        await avisar(texto);
        await supa(`outbox_events?id=eq.${evento.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "completed", processed_at: new Date().toISOString() }),
        });
        entregues += 1;
      } catch (erro) {
        falhas += 1;
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        // Continua pendente de proposito: preferimos avisar atrasado a nao avisar.
        await supa(`outbox_events?id=eq.${evento.id}`, {
          method: "PATCH",
          body: JSON.stringify({ last_error: mensagem.slice(0, 500) }),
        }).catch(() => undefined);
      }
    }

    return new Response(
      JSON.stringify({ entregues, falhas, ms: Date.now() - inicio }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (erro) {
    return new Response(
      JSON.stringify({ erro: erro instanceof Error ? erro.message : String(erro) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Mesmo padrao de meta-catalog-reconcile.ts, que ja roda agendada.
export const config = { schedule: "* * * * *" };

