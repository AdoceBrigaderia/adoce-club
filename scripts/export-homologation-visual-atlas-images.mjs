import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AREAS,
  EXPECTED_TOTAL,
  checkpoints,
  validateAtlas,
} from "./generate-homologation-visual-atlas.mjs";

const WIDTH = 1080;
const HEIGHT = 1350;
const forbiddenProductionTokens = [
  "adocebrigaderia.com.br",
  "bb0c96cd-5af2-4270-a9a8-b63b9637b1f4",
  "uefwywizqhfvvijaopcn",
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function textLines(value, maxLength = 34) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function svgTextLines(lines, x, y, options = {}) {
  const {
    fontSize = 42,
    weight = 700,
    fill = "#4f2c27",
    lineHeight = Math.round(fontSize * 1.22),
    anchor = "start",
  } = options;
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-family="Inter,Arial,sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function button(x, y, width, label, primary = false) {
  const fill = primary ? "#d26680" : "#f7dfe5";
  const color = primary ? "#ffffff" : "#5b2f2a";
  return `<rect x="${x}" y="${y}" width="${width}" height="72" rx="24" fill="${fill}"/>
  <text x="${x + width / 2}" y="${y + 46}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="${color}">${escapeXml(label)}</text>`;
}

function field(x, y, width, label, value = "") {
  return `<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="700" fill="#77544d">${escapeXml(label)}</text>
  <rect x="${x}" y="${y + 16}" width="${width}" height="72" rx="18" fill="#ffffff" stroke="#dbc1c6" stroke-width="3"/>
  <text x="${x + 22}" y="${y + 62}" font-family="Inter,Arial,sans-serif" font-size="23" fill="#8c6a64">${escapeXml(value || "Toque para preencher")}</text>`;
}

function productCard(x, y, width, title, price = "R$ 16") {
  return `<rect x="${x}" y="${y}" width="${width}" height="270" rx="28" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
  <rect x="${x + 18}" y="${y + 18}" width="${width - 36}" height="132" rx="22" fill="#f7dfe5"/>
  <circle cx="${x + width / 2}" cy="${y + 84}" r="42" fill="#d26680" opacity=".22"/>
  <path d="M ${x + width / 2 - 34} ${y + 92} Q ${x + width / 2} ${y + 50} ${x + width / 2 + 34} ${y + 92} Z" fill="#8a4a45"/>
  <text x="${x + 20}" y="${y + 188}" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#4f2c27">${escapeXml(title)}</text>
  <text x="${x + 20}" y="${y + 226}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" fill="#d26680">${escapeXml(price)}</text>
  <circle cx="${x + width - 46}" cy="${y + 220}" r="24" fill="#d26680"/>
  <text x="${x + width - 46}" y="${y + 229}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="800" fill="#ffffff">+</text>`;
}

function renderAreaMock(areaId, label) {
  switch (areaId) {
    case "inicio":
      return `<rect x="90" y="430" width="900" height="310" rx="36" fill="#f7dfe5"/>
      <text x="140" y="500" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="800" fill="#8a4a45">Adoce Brigaderia</text>
      ${svgTextLines(textLines(label, 28), 140, 555, { fontSize: 48, lineHeight: 58 })}
      ${button(140, 650, 320, "Explorar", true)}
      <rect x="700" y="485" width="210" height="210" rx="105" fill="#ffffff" opacity=".72"/>
      <path d="M745 620 Q805 500 865 620 Z" fill="#8a4a45"/>
      <circle cx="805" cy="545" r="26" fill="#d26680"/>
      <rect x="90" y="780" width="280" height="180" rx="26" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <rect x="400" y="780" width="280" height="180" rx="26" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <rect x="710" y="780" width="280" height="180" rx="26" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>`;
    case "fatias":
      return `${productCard(90, 430, 280, "Chocolatudo")}
      ${productCard(400, 430, 280, "Ninho com morango")}
      ${productCard(710, 430, 280, "Red Velvet")}
      <rect x="90" y="740" width="900" height="220" rx="30" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="130" y="800" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#4f2c27">${escapeXml(label)}</text>
      <text x="130" y="850" font-family="Inter,Arial,sans-serif" font-size="22" fill="#77544d">Quantidade</text>
      ${button(130, 875, 180, "−  1  +", false)}
      ${button(640, 875, 300, "Adicionar", true)}`;
    case "cadastro":
      return `<rect x="150" y="420" width="780" height="610" rx="38" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="210" y="485" font-family="Inter,Arial,sans-serif" font-size="32" font-weight="800" fill="#4f2c27">Cadastro simples</text>
      ${field(210, 535, 660, "Nome", "Maria da Silva")}
      ${field(210, 675, 660, "WhatsApp", "(85) 99999-9999")}
      <rect x="210" y="830" width="32" height="32" rx="8" fill="#d26680"/>
      <text x="260" y="855" font-family="Inter,Arial,sans-serif" font-size="20" fill="#5b2f2a">Aceito Termos e Política de Privacidade</text>
      <rect x="210" y="885" width="32" height="32" rx="8" fill="#ffffff" stroke="#dbc1c6" stroke-width="3"/>
      <text x="260" y="910" font-family="Inter,Arial,sans-serif" font-size="20" fill="#5b2f2a">Quero receber novidades no WhatsApp</text>
      ${button(540, 945, 330, "Continuar", true)}`;
    case "clube":
      return `<rect x="110" y="420" width="860" height="430" rx="42" fill="#5b2f2a"/>
      <text x="170" y="500" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="800" fill="#f7dfe5">CLUBE ADOCE</text>
      <text x="170" y="560" font-family="Inter,Arial,sans-serif" font-size="24" fill="#ffffff">${escapeXml(label)}</text>
      <text x="170" y="650" font-family="Inter,Arial,sans-serif" font-size="70" font-weight="900" fill="#ffffff">9 / 14</text>
      <text x="170" y="700" font-family="Inter,Arial,sans-serif" font-size="22" fill="#f7dfe5">carimbos acumulados</text>
      <rect x="700" y="510" width="180" height="180" rx="24" fill="#ffffff"/>
      <path d="M730 540h40v40h-40zM810 540h40v40h-40zM730 620h40v40h-40zM790 600h60v60h-60z" fill="#4f2c27"/>
      <rect x="110" y="890" width="410" height="110" rx="26" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <rect x="560" y="890" width="410" height="110" rx="26" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="315" y="955" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#4f2c27">Histórico</text>
      <text x="765" y="955" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="800" fill="#4f2c27">Adicionar à Wallet</text>`;
    case "pede-junto":
      return `<rect x="120" y="420" width="840" height="570" rx="38" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="180" y="490" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800" fill="#4f2c27">Pede Junto</text>
      <text x="180" y="540" font-family="Inter,Arial,sans-serif" font-size="23" fill="#77544d">${escapeXml(label)}</text>
      <rect x="180" y="590" width="720" height="92" rx="22" fill="#fff9f6" stroke="#ead8d3" stroke-width="3"/>
      <circle cx="230" cy="636" r="26" fill="#d26680"/><text x="230" y="645" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" fill="#fff">R</text>
      <text x="280" y="632" font-family="Inter,Arial,sans-serif" font-size="23" font-weight="800" fill="#4f2c27">Rubens</text><text x="280" y="662" font-family="Inter,Arial,sans-serif" font-size="19" fill="#77544d">2 itens · R$ 32</text>
      <rect x="180" y="705" width="720" height="92" rx="22" fill="#fff9f6" stroke="#ead8d3" stroke-width="3"/>
      <circle cx="230" cy="751" r="26" fill="#8a4a45"/><text x="230" y="760" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" fill="#fff">B</text>
      <text x="280" y="747" font-family="Inter,Arial,sans-serif" font-size="23" font-weight="800" fill="#4f2c27">Beth</text><text x="280" y="777" font-family="Inter,Arial,sans-serif" font-size="19" fill="#77544d">1 item · R$ 16</text>
      ${button(180, 840, 340, "Compartilhar código", false)}
      ${button(560, 840, 340, "Fechar pedido", true)}`;
    case "encomendas":
      return `<rect x="130" y="420" width="820" height="610" rx="38" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="190" y="490" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800" fill="#4f2c27">Nova encomenda</text>
      <text x="190" y="540" font-family="Inter,Arial,sans-serif" font-size="23" fill="#77544d">${escapeXml(label)}</text>
      ${field(190, 590, 300, "Data", "31/07/2026")}
      ${field(530, 590, 300, "Horário", "18:30")}
      ${field(190, 730, 640, "Produto", "Torta Chocolatudo")}
      ${field(190, 870, 640, "Observações", "Mensagem e decoração")}
      ${button(530, 990, 300, "Revisar", true)}`;
    case "operacao":
      return `<rect x="70" y="400" width="940" height="640" rx="36" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="120" y="470" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800" fill="#4f2c27">Central da Operação</text>
      <text x="120" y="515" font-family="Inter,Arial,sans-serif" font-size="22" fill="#77544d">${escapeXml(label)}</text>
      ${productCard(110, 560, 250, "Chocolatudo")}
      ${productCard(385, 560, 250, "Ferrero")}
      ${productCard(660, 560, 250, "Morango")}
      <rect x="110" y="860" width="800" height="120" rx="28" fill="#5b2f2a"/>
      <text x="150" y="920" font-family="Inter,Arial,sans-serif" font-size="26" font-weight="800" fill="#ffffff">3 itens · R$ 48</text>
      <rect x="650" y="882" width="230" height="76" rx="22" fill="#d26680"/>
      <text x="765" y="930" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="23" font-weight="900" fill="#ffffff">Concluir venda</text>`;
    case "atendimento":
      return `<rect x="150" y="420" width="780" height="610" rx="38" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
      <text x="210" y="490" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800" fill="#4f2c27">Atendimento Adoce</text>
      <text x="210" y="540" font-family="Inter,Arial,sans-serif" font-size="23" fill="#77544d">${escapeXml(label)}</text>
      ${field(210, 590, 660, "Assunto", "Selecione uma opção")}
      ${field(210, 730, 660, "Mensagem", "Conte como podemos ajudar")}
      <rect x="210" y="875" width="660" height="80" rx="22" fill="#f2fbf5" stroke="#8ab69a" stroke-width="3"/>
      <text x="250" y="925" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700" fill="#3d7250">Atendimento por WhatsApp disponível</text>
      ${button(540, 985, 330, "Enviar solicitação", true)}`;
    default:
      return "";
  }
}

function renderSvg(point, index, logoDataUri) {
  const area = AREAS.find(({ id }) => id === point.areaId);
  if (!area) throw new Error(`Área ausente para ${point.id}.`);
  const title = textLines(point.label, 32);
  const areaNumber = AREAS.findIndex(({ id }) => id === point.areaId) + 1;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(point.id)} — ${escapeXml(point.label)}</title>
  <desc id="desc">Representação visual conceitual do Portal Adoce para homologação. Produção não alterada.</desc>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fff9f6"/>
  <rect x="0" y="0" width="${WIDTH}" height="150" fill="#ffffff"/>
  <image href="${logoDataUri}" x="58" y="32" width="88" height="88" preserveAspectRatio="xMidYMid meet"/>
  <text x="170" y="75" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="900" fill="#4f2c27">Portal Adoce</text>
  <text x="170" y="112" font-family="Inter,Arial,sans-serif" font-size="20" fill="#77544d">Homologação visual · produção não alterada</text>
  <rect x="820" y="40" width="200" height="64" rx="22" fill="#f7dfe5"/>
  <text x="920" y="81" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="900" fill="#5b2f2a">${String(index + 1).padStart(2, "0")} / ${EXPECTED_TOTAL}</text>
  <rect x="70" y="190" width="940" height="170" rx="32" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
  <text x="110" y="242" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" fill="#d26680">ÁREA ${areaNumber} · ${escapeXml(area.title.toUpperCase())}</text>
  ${svgTextLines(title, 110, 302, { fontSize: 40, lineHeight: 48 })}
  ${renderAreaMock(point.areaId, point.label)}
  <rect x="70" y="1110" width="940" height="150" rx="30" fill="#ffffff" stroke="#ead8d3" stroke-width="3"/>
  <text x="110" y="1165" font-family="Inter,Arial,sans-serif" font-size="21" font-weight="800" fill="#4f2c27">O que validar</text>
  <text x="110" y="1208" font-family="Inter,Arial,sans-serif" font-size="22" fill="#77544d">Clareza, poucos toques, alvo touch amplo, contraste e resposta imediata.</text>
  <text x="110" y="1244" font-family="Inter,Arial,sans-serif" font-size="18" fill="#9a7770">Representação conceitual; a validação funcional ocorrerá no preview navegável.</text>
  <text x="70" y="1315" font-family="Inter,Arial,sans-serif" font-size="18" fill="#9a7770">Checkpoint ${escapeXml(point.id)} · rota ${escapeXml(point.href)}</text>
</svg>`;
}

function renderIndex(manifest) {
  const cards = manifest.images
    .map(
      (image) => `<a class="card" href="imagens/${image.file}"><img src="imagens/${image.file}" alt="${escapeXml(image.id)} — ${escapeXml(image.label)}"><span>${escapeXml(image.id)} · ${escapeXml(image.label)}</span></a>`,
    )
    .join("\n");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>98 representações visuais — Portal Adoce</title><style>:root{font-family:Inter,system-ui,sans-serif;color:#4f2c27;background:#fff9f6}body{margin:0;padding:24px}h1{margin:0 0 8px}.note{margin:0 0 24px;color:#77544d}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.card{display:grid;gap:8px;padding:10px;border:1px solid #ead8d3;border-radius:18px;background:#fff;color:inherit;text-decoration:none}.card img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:12px;background:#f7dfe5}.card span{font-size:14px;font-weight:800}</style></head><body><h1>98 representações visuais do Portal Adoce</h1><p class="note">Homologação isolada. Arquivos SVG individuais. Produção não alterada.</p><div class="grid">${cards}</div></body></html>`;
}

async function generateImages({ outputDirectory, logoPath }) {
  const points = validateAtlas();
  if (points.length !== EXPECTED_TOTAL) throw new Error("Quantidade de pontos inválida.");
  const logoBuffer = await readFile(logoPath);
  const logoDataUri = `data:image/webp;base64,${logoBuffer.toString("base64")}`;
  const imagesDirectory = join(outputDirectory, "imagens");
  await mkdir(imagesDirectory, { recursive: true });

  const images = [];
  for (const [index, point] of points.entries()) {
    const file = `${String(index + 1).padStart(3, "0")}-${point.id.replace(".", "-")}-${slugify(point.areaTitle)}-${slugify(point.label)}.svg`;
    const svg = renderSvg(point, index, logoDataUri);
    for (const token of forbiddenProductionTokens) {
      if (svg.includes(token)) throw new Error(`Token produtivo proibido encontrado: ${token}`);
    }
    await writeFile(join(imagesDirectory, file), svg, "utf8");
    images.push({
      order: index + 1,
      id: point.id,
      areaId: point.areaId,
      areaTitle: point.areaTitle,
      label: point.label,
      href: point.href,
      file,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || "local",
    productionChanged: false,
    totalAreas: AREAS.length,
    totalImages: images.length,
    format: "svg",
    dimensions: { width: WIDTH, height: HEIGHT },
    images,
  };
  await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(outputDirectory, "index.html"), renderIndex(manifest), "utf8");
  await writeFile(
    join(outputDirectory, "LEIA-ME.txt"),
    [
      "Portal Adoce — 98 representações visuais separadas",
      "",
      "- Formato: SVG individual",
      `- Dimensão: ${WIDTH}x${HEIGHT}`,
      "- Uso: revisão conceitual de UX e identidade em homologação",
      "- Produção: não alterada",
      "- Nenhum dado de cliente, credencial ou integração externa foi utilizado",
      "",
      "Abra index.html para navegar por todas as imagens ou acesse a pasta imagens.",
      "",
    ].join("\n"),
    "utf8",
  );
  return manifest;
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out-dir");
  const logoIndex = args.indexOf("--logo");
  const outputDirectory = resolve(outIndex >= 0 ? args[outIndex + 1] : "artifacts/atlas-visual/imagens-separadas");
  const logoPath = resolve(logoIndex >= 0 ? args[logoIndex + 1] : "public/site/logo.webp");

  if (args.includes("--check")) {
    const points = checkpoints();
    if (AREAS.length !== 8 || points.length !== EXPECTED_TOTAL) {
      throw new Error(`Atlas inválido: ${AREAS.length} áreas e ${points.length} pontos.`);
    }
    const sample = renderSvg(points[0], 0, "data:image/webp;base64,AA==");
    if (!sample.includes("produção não alterada")) throw new Error("Proteção de produção ausente.");
    if (!sample.includes("Representação conceitual")) throw new Error("Aviso conceitual ausente.");
    console.log(`ok: exportador validado para ${points.length} imagens`);
    return;
  }

  const manifest = await generateImages({ outputDirectory, logoPath });
  console.log(`Imagens geradas: ${manifest.totalImages} em ${outputDirectory}`);
}

const executedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) await main();

export { HEIGHT, WIDTH, generateImages, renderIndex, renderSvg, slugify };
