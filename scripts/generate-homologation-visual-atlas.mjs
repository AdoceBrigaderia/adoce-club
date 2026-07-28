import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AREAS = [
  {
    id: "inicio",
    title: "Início e identidade",
    href: "/#inicio",
    items: [
      "Splash e abertura",
      "Página inicial",
      "Destaques principais",
      "Quem somos",
      "Nossas lojas",
      "Depoimentos",
      "Novidades e conteúdos",
      "Promoções e campanhas",
      "Menu principal",
      "Rodapé e canais oficiais",
      "Busca e descoberta",
      "Ícones, acessibilidade e navegação",
    ],
  },
  {
    id: "fatias",
    title: "Fatias de hoje",
    href: "/#adoce-hoje",
    items: [
      "Lista de sabores disponíveis",
      "Detalhes da fatia",
      "Preço e descrição",
      "Disponível ou esgotado",
      "Seleção de quantidade",
      "Adicionar ao pedido",
      "Personalizações e caldas",
      "Resumo do pedido",
      "Agendamento de retirada",
      "Retirada na loja",
      "Favoritos",
      "Mais vendidos",
    ],
  },
  {
    id: "cadastro",
    title: "Cadastro simplificado",
    href: "/#cadastro",
    items: [
      "Boas-vindas",
      "Campo nome",
      "Campo WhatsApp",
      "Aceite agrupado de termos e privacidade",
      "Marketing opcional desmarcado",
      "Resumo antes de concluir",
      "Confirmação via WhatsApp",
      "Código OTP",
      "Validação e expiração do código",
      "Cadastro concluído",
      "Alternativa manual e contingência",
      "Erros e validação acessível",
    ],
  },
  {
    id: "clube",
    title: "Clube e cartão digital",
    href: "/#clube",
    items: [
      "Cartão digital",
      "Saldo de carimbos",
      "Progresso até a cortesia",
      "QR pessoal",
      "Google Wallet",
      "Apple Wallet futuro",
      "Histórico de carimbos",
      "Regras do clube",
      "Benefícios disponíveis",
      "Compartilhar cartão",
      "Detalhes do cliente",
      "Notificações do clube",
    ],
  },
  {
    id: "pede-junto",
    title: "Pede Junto",
    href: "/#pede-junto",
    items: [
      "Criar ou entrar no grupo",
      "Código do grupo",
      "Compartilhar código",
      "Participantes",
      "Adicionar pedido",
      "Pedido de cada participante",
      "Resumo do grupo",
      "Editar pedido",
      "Remover item",
      "Fechar pedido",
      "Confirmar pedido consolidado",
      "Expiração e encerramento do grupo",
    ],
  },
  {
    id: "encomendas",
    title: "Encomendas",
    href: "/#encomendas",
    items: [
      "Selecionar produto",
      "Escolher data",
      "Escolher horário",
      "Selecionar quantidade",
      "Sabores e opções",
      "Observações",
      "Resumo da encomenda",
      "Confirmação",
      "Status pendente",
      "Status confirmado",
      "Comunicação por WhatsApp",
      "Histórico de encomendas",
    ],
  },
  {
    id: "operacao",
    title: "Operação",
    href: "/#operacao",
    items: [
      "Tela principal da operação",
      "Produtos em cartões grandes",
      "Detalhes do produto",
      "Carrinho e pedido",
      "Controles de quantidade",
      "Finalizar venda em um toque",
      "Formas de pagamento",
      "Confirmação de pagamento",
      "Fidelidade +1, +2 e +3",
      "Fidelidade com quantidade livre",
      "Motivos rápidos de fidelidade",
      "Clientes presentes",
      "Check-in NFC e QR",
      "Abertura de caixa",
      "Suprimento, sangria e despesas",
      "Fechamento e correção de caixa",
      "Contingência e lançamento posterior",
      "Permissões, relatórios e rastreabilidade",
    ],
  },
  {
    id: "atendimento",
    title: "Atendimento",
    href: "/#fale-com-a-adoce",
    items: [
      "Central de atendimento",
      "Fale conosco",
      "Assuntos disponíveis",
      "Formulário de contato",
      "Acompanhamento de solicitação",
      "Protocolo e número",
      "Atendimento pelo WhatsApp",
      "Mensagem de indisponibilidade",
    ],
  },
];

const EXPECTED_TOTAL = 98;
const forbiddenProductionTokens = [
  "adocebrigaderia.com.br",
  "bb0c96cd-5af2-4270-a9a8-b63b9637b1f4",
  "uefwywizqhfvvijaopcn",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function checkpoints() {
  return AREAS.flatMap((area, areaIndex) =>
    area.items.map((label, itemIndex) => ({
      id: `${areaIndex + 1}.${itemIndex + 1}`,
      areaId: area.id,
      areaTitle: area.title,
      href: area.href,
      label,
    })),
  );
}

function validateAtlas() {
  const points = checkpoints();
  const ids = new Set(points.map(({ id }) => id));
  const labels = new Set(points.map(({ areaTitle, label }) => `${areaTitle}:${label}`));

  if (AREAS.length !== 8) throw new Error(`Esperadas 8 áreas, recebidas ${AREAS.length}.`);
  if (points.length !== EXPECTED_TOTAL) {
    throw new Error(`Esperados ${EXPECTED_TOTAL} pontos, recebidos ${points.length}.`);
  }
  if (ids.size !== points.length) throw new Error("Existem identificadores duplicados.");
  if (labels.size !== points.length) throw new Error("Existem checkpoints duplicados.");
  if (AREAS.some(({ href }) => !href.startsWith("/#"))) {
    throw new Error("Todas as rotas devem permanecer internas ao preview.");
  }
  return points;
}

function renderArea(area, areaIndex) {
  const cards = area.items
    .map((label, itemIndex) => {
      const id = `${areaIndex + 1}.${itemIndex + 1}`;
      return `<article class="checkpoint" data-checkpoint="${id}">
        <div class="checkpoint-title"><span>${id}</span><strong>${escapeHtml(label)}</strong></div>
        <div class="checkpoint-actions" role="group" aria-label="Resultado de ${escapeHtml(label)}">
          <button type="button" data-status="approved">Aprovado</button>
          <button type="button" data-status="adjust">Ajustar</button>
        </div>
        <label>Observação<textarea maxlength="500" data-note placeholder="Descreva o ajuste necessário."></textarea></label>
      </article>`;
    })
    .join("\n");

  return `<section class="area" id="area-${escapeHtml(area.id)}">
    <header><div><span>Área ${areaIndex + 1}</span><h2>${escapeHtml(area.title)}</h2></div><a href="${escapeHtml(area.href)}">Abrir tela principal</a></header>
    <p>${area.items.length} pontos de validação</p>
    <div class="checkpoint-grid">${cards}</div>
  </section>`;
}

function renderHtml() {
  const points = validateAtlas();
  const areasHtml = AREAS.map(renderArea).join("\n");
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Validação visual — 98 pontos | Portal Adoce</title>
  <style>
    :root{font-family:Inter,system-ui,sans-serif;color:#4f2c27;background:#fff9f6;line-height:1.45}
    *{box-sizing:border-box} body{margin:0} button,textarea{font:inherit}
    .top{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem clamp(1rem,4vw,3rem);border-bottom:1px solid #e7cdd2;background:rgba(255,249,246,.97);backdrop-filter:blur(12px)}
    .brand{display:flex;align-items:center;gap:.8rem}.brand img{width:58px;height:58px;object-fit:contain}.brand h1{margin:0;font-size:clamp(1rem,3vw,1.5rem)}.brand p{margin:.15rem 0 0;color:#77544d;font-size:.82rem}
    .summary{display:grid;grid-template-columns:repeat(4,minmax(74px,1fr));gap:.45rem;min-width:min(430px,52vw)}.summary span{display:grid;padding:.45rem;border:1px solid #ead8d3;border-radius:12px;background:#fff;text-align:center;font-size:.68rem}.summary strong{font-size:1rem}
    main{display:grid;gap:1.2rem;padding:1rem clamp(1rem,4vw,3rem) 7rem}.intro{padding:1rem;border:1px solid #ead8d3;border-radius:18px;background:#fff}.intro p{margin:.3rem 0}.intro strong{color:#c64f70}
    .area{padding:1rem;border:1px solid #ead8d3;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(79,44,39,.06)}.area>header{display:flex;align-items:center;justify-content:space-between;gap:1rem}.area h2{margin:.1rem 0;font-size:1.15rem}.area header span,.area>p{color:#77544d;font-size:.76rem}.area header a{min-height:44px;padding:.65rem .8rem;border-radius:12px;background:#f7dfe5;color:#5b2f2a;font-weight:700;text-decoration:none}.checkpoint-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem;margin-top:.8rem}
    .checkpoint{display:grid;gap:.55rem;padding:.7rem;border:1px solid #ead8d3;border-radius:14px;background:#fffaf8}.checkpoint.is-approved{border-color:#6fa783;background:#f2fbf5}.checkpoint.is-adjust{border-color:#d09a60;background:#fff8ee}.checkpoint-title{display:flex;align-items:flex-start;gap:.5rem;min-height:42px}.checkpoint-title span{flex:0 0 auto;padding:.15rem .35rem;border-radius:8px;background:#f7dfe5;font-size:.68rem;font-weight:800}.checkpoint-title strong{font-size:.78rem}.checkpoint-actions{display:grid;grid-template-columns:1fr 1fr;gap:.35rem}.checkpoint button{min-height:42px;border:1px solid #dbc1c6;border-radius:10px;background:#fff;color:#5b2f2a;font-size:.72rem;font-weight:800}.checkpoint button[aria-pressed="true"]{background:#5b2f2a;color:#fff}.checkpoint label{display:grid;gap:.25rem;color:#77544d;font-size:.68rem;font-weight:700}.checkpoint textarea{width:100%;min-height:64px;padding:.5rem;border:1px solid #dbc1c6;border-radius:10px;background:#fff;resize:vertical;font-size:.72rem}
    .actions{position:fixed;right:1rem;bottom:1rem;z-index:6;display:flex;gap:.5rem;padding:.55rem;border:1px solid #dbc1c6;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 14px 38px rgba(79,44,39,.18)}.actions button{min-height:48px;padding:.7rem .9rem;border:0;border-radius:12px;background:#d26680;color:#fff;font-weight:800}.actions button.secondary{background:#f7dfe5;color:#5b2f2a}
    @media(max-width:900px){.top{align-items:flex-start;flex-direction:column}.summary{width:100%;min-width:0}.checkpoint-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:560px){.checkpoint-grid{grid-template-columns:1fr}.summary{grid-template-columns:repeat(2,1fr)}.area>header{align-items:stretch;flex-direction:column}.area header a{text-align:center}.actions{left:1rem;right:1rem}.actions button{flex:1}}
  </style>
</head>
<body>
  <header class="top"><div class="brand"><img src="/site/logo.webp" alt="Logo oficial da Adoce Brigaderia"><div><h1>Validação visual — 98 pontos</h1><p>Homologação isolada · mobile e tablet · produção não alterada</p></div></div><div class="summary" aria-live="polite"><span><strong id="reviewed">0</strong>revisados</span><span><strong id="approved">0</strong>aprovados</span><span><strong id="adjust">0</strong>ajustes</span><span><strong>${points.length}</strong>total</span></div></header>
  <main><section class="intro"><p><strong>Objetivo:</strong> revisar cada detalhe das oito áreas sem depender de integrações externas.</p><p>O progresso fica somente nesta aba. Nenhum dado de cliente, credencial ou transação é armazenado.</p></section>${areasHtml}</main>
  <div class="actions"><button type="button" id="copy">Copiar relatório</button><button type="button" class="secondary" id="reset">Reiniciar</button></div>
  <script>
    (()=>{const key='adoce:visual-atlas-98:v1';const cards=[...document.querySelectorAll('[data-checkpoint]')];let state={};try{state=JSON.parse(sessionStorage.getItem(key)||'{}')||{}}catch{state={}};
    const updateSummary=()=>{const values=Object.values(state);const approved=values.filter(v=>v?.status==='approved').length;const adjust=values.filter(v=>v?.status==='adjust').length;document.getElementById('reviewed').textContent=String(approved+adjust);document.getElementById('approved').textContent=String(approved);document.getElementById('adjust').textContent=String(adjust)};
    const persist=()=>{sessionStorage.setItem(key,JSON.stringify(state));updateSummary()};
    cards.forEach(card=>{const id=card.dataset.checkpoint;const note=card.querySelector('[data-note]');const buttons=[...card.querySelectorAll('[data-status]')];const paint=()=>{const current=state[id]||{};card.classList.toggle('is-approved',current.status==='approved');card.classList.toggle('is-adjust',current.status==='adjust');buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.status===current.status)));note.value=current.note||''};buttons.forEach(button=>button.addEventListener('click',()=>{state[id]={...(state[id]||{}),status:button.dataset.status};persist();paint()}));note.addEventListener('input',()=>{state[id]={...(state[id]||{}),note:note.value.slice(0,500)};persist()});paint()});
    document.getElementById('reset').addEventListener('click',()=>{state={};persist();cards.forEach(card=>{card.classList.remove('is-approved','is-adjust');card.querySelector('[data-note]').value='';card.querySelectorAll('[data-status]').forEach(button=>button.setAttribute('aria-pressed','false'))})});
    document.getElementById('copy').addEventListener('click',async()=>{const lines=['# Validação visual — 98 pontos','','- URL: '+location.href,'- Viewport: '+innerWidth+'x'+innerHeight+' @'+devicePixelRatio.toFixed(2)+'x','- Produção: não alterada','','## Resultados'];cards.forEach(card=>{const id=card.dataset.checkpoint;const title=card.querySelector('strong').textContent.trim();const current=state[id]||{};const status=current.status==='approved'?'Aprovado':current.status==='adjust'?'Ajustar':'Pendente';lines.push('- '+id+' '+title+': '+status);if(current.note)lines.push('  - Observação: '+current.note.replace(/\s+/g,' ').trim())});const report=lines.join('\n')+'\n';try{await navigator.clipboard.writeText(report);document.getElementById('copy').textContent='Relatório copiado'}catch{document.getElementById('copy').textContent='Cópia indisponível'}});updateSummary()})();
  </script>
</body>
</html>`;

  for (const token of forbiddenProductionTokens) {
    if (html.includes(token)) throw new Error(`Token produtivo proibido encontrado: ${token}`);
  }
  return html;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    const points = validateAtlas();
    const html = renderHtml();
    if (!html.includes("Validação visual — 98 pontos")) throw new Error("Título ausente.");
    console.log(`ok: ${AREAS.length} áreas e ${points.length} pontos validados`);
    return;
  }

  const outIndex = args.indexOf("--out");
  const output = resolve(outIndex >= 0 ? args[outIndex + 1] : "dist/validacao-visual-98.html");
  if (!output) throw new Error("Informe um caminho após --out.");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderHtml(), "utf8");
  console.log(`Atlas visual gerado em ${output}`);
}

const executedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) await main();

export { AREAS, EXPECTED_TOTAL, checkpoints, renderHtml, validateAtlas };
