// Alarme de pedidos da Adoce — entrega por Web Push.
//
// Em 07/08/2026 a cliente Juliana Sousa pediu duas fatias pelo site as 12h40 e
// ninguem soube. Ela ligou as 18h, chateada, e os dois sabores ja haviam
// acabado. O pedido estava no banco o tempo todo.
//
// A causa: o unico aviso que existia dependia do proprio cliente tocar em
// "enviar" no WhatsApp depois de ja ter concluido o pedido. Links wa.me abrem a
// conversa com o texto pronto, mas NAO enviam. E a fila de alertas, que registra
// tudo desde 22/07, nunca teve quem a lesse.
//
// O site ja tinha tudo pronto: o service worker escuta "push", a tela da
// Operacao pede permissao e guarda a inscricao, o gatilho do banco cria o
// alerta a cada pedido. Faltava so quem envia. E esta funcao.
//
// A execucao automatica por minuto foi desativada para evitar consumo recorrente
// de computacao da Netlify. A funcao permanece disponivel para acionamento
// manual ate a entrega ser migrada para um fluxo orientado a evento.

import webpush from "web-push";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const CHAVE_PUBLICA = process.env.VITE_WEB_PUSH_PUBLIC_KEY || "";
const CHAVE_PRIVADA = process.env.WEB_PUSH_PRIVATE_KEY || "";
const ASSUNTO = process.env.WEB_PUSH_SUBJECT || "mailto:rubens@adocebrigaderia.com.br";

const LOTE = 20;

// Alerta mais velho que isto nao vale mais a pena tocar o celular de ninguem.
// Sem esta trava, a primeira execucao dispararia os 117 avisos represados de
// uma vez so.
const VALIDADE_HORAS = 24;

type Alerta = {
  id: string;
  event_type: string;
  priority: string;
  title: string;
  message: string;
  action_url: string;
  push_attempts: number;
  created_at: string;
};

type Inscricao = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

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

function marcar(id: string, campos: Record<string, unknown>) {
  return supa(`operation_notifications?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(campos),
  });
}

export default async function handler() {
  const inicio = Date.now();
  let entregues = 0;
  let falhas = 0;
  let vencidos = 0;

  try {
    if (!CHAVE_PUBLICA || !CHAVE_PRIVADA) {
      throw new Error("Faltam as chaves VAPID: VITE_WEB_PUSH_PUBLIC_KEY e WEB_PUSH_PRIVATE_KEY.");
    }
    webpush.setVapidDetails(ASSUNTO, CHAVE_PUBLICA, CHAVE_PRIVADA);

    const [alertas, inscricoes] = (await Promise.all([
      supa(
        `operation_notifications?push_status=eq.pending` +
        `&select=id,event_type,priority,title,message,action_url,push_attempts,created_at` +
        `&order=created_at.asc&limit=${LOTE}`,
      ),
      supa(`operation_push_subscriptions?active=is.true&select=id,endpoint,p256dh,auth`),
    ])) as [Alerta[], Inscricao[]];

    // Sem ninguem inscrito nao ha o que enviar. Os alertas continuam pendentes
    // de proposito: assim que o Rubens ativar no celular, os recentes chegam.
    if (!inscricoes?.length) {
      return new Response(
        JSON.stringify({ entregues: 0, aviso: "Nenhum aparelho inscrito ainda." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const limite = Date.now() - VALIDADE_HORAS * 3600_000;

    for (const alerta of alertas || []) {
      if (new Date(alerta.created_at).getTime() < limite) {
        vencidos += 1;
        await marcar(alerta.id, {
          push_status: "not_applicable",
          push_dispatched_at: new Date().toISOString(),
          push_last_error: `Alerta com mais de ${VALIDADE_HORAS}h; visivel apenas na Operacao.`,
        });
        continue;
      }

      const corpo = JSON.stringify({
        title: alerta.title,
        body: alerta.message || "Abra a Operação Adoce para conferir.",
        url: alerta.action_url || "#operacao",
        tag: `adoce-${alerta.event_type}`,
        urgent: alerta.priority === "urgent",
      });

      // Um aparelho que falha nao pode impedir os outros de receber.
      const entregas = await Promise.allSettled(
        inscricoes.map((i) =>
          webpush.sendNotification(
            { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
            corpo,
            { TTL: 3600, urgency: alerta.priority === "urgent" ? "high" : "normal" },
          ),
        ),
      );

      // Inscricao que o navegador descartou (404/410) nunca mais volta.
      // Desativar evita tentar para sempre.
      await Promise.all(
        entregas.map((resultado, indice) => {
          if (resultado.status !== "rejected") return undefined;
          const status = (resultado.reason as { statusCode?: number })?.statusCode;
          if (status !== 404 && status !== 410) return undefined;
          return supa(`operation_push_subscriptions?id=eq.${inscricoes[indice].id}`, {
            method: "PATCH",
            body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
          }).catch(() => undefined);
        }),
      );

      const chegou = entregas.some((e) => e.status === "fulfilled");
      const agora = new Date().toISOString();

      if (chegou) {
        entregues += 1;
        await marcar(alerta.id, {
          push_status: "sent",
          push_dispatched_at: agora,
          push_attempts: alerta.push_attempts + 1,
          push_last_error: null,
        });
      } else {
        falhas += 1;
        const motivo = entregas[0] as PromiseRejectedResult | undefined;
        const texto = motivo ? String(motivo.reason).slice(0, 500) : "Nenhum aparelho recebeu.";
        // Depois de cinco tentativas paramos: o alerta continua na Operacao.
        const desistir = alerta.push_attempts + 1 >= 5;
        await marcar(alerta.id, {
          push_status: desistir ? "failed" : "pending",
          push_attempts: alerta.push_attempts + 1,
          push_last_error: texto,
          ...(desistir ? { push_dispatched_at: agora } : {}),
        });
      }
    }

    return new Response(
      JSON.stringify({ entregues, falhas, vencidos, aparelhos: inscricoes.length, ms: Date.now() - inicio }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (erro) {
    return new Response(
      JSON.stringify({ erro: erro instanceof Error ? erro.message : String(erro) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
