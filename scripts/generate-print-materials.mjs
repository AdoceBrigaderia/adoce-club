import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "marketing-assets", "impressos-atendimento");
await mkdir(outDir, { recursive: true });

GlobalFonts.registerFromPath("C:/Windows/Fonts/georgia.ttf", "Adoce Serif");
GlobalFonts.registerFromPath("C:/Windows/Fonts/georgiab.ttf", "Adoce Serif Bold");
GlobalFonts.registerFromPath("C:/Windows/Fonts/segoeui.ttf", "Adoce Sans");
GlobalFonts.registerFromPath("C:/Windows/Fonts/segoeuib.ttf", "Adoce Sans Bold");

const C = {
  chocolate: "#32140d",
  cocoa: "#5f2c1d",
  cream: "#fff8ef",
  paper: "#fffdf9",
  blush: "#f7ded9",
  pink: "#f4b8b5",
  coral: "#f26862",
  gold: "#d5a761",
  muted: "#805e52",
  green: "#567861",
};

const assets = {
  logo: await loadImage(path.join(root, "public", "wallet", "brand", "logo-transparent.png")),
  cake: await loadImage(path.join(root, "public", "site", "hero-cake.webp")),
  sweets: await loadImage(path.join(root, "public", "adoce-hoje", "docinhos-tradicionais.webp")),
  premium: await loadImage(path.join(root, "public", "adoce-hoje", "docinhos-premium.webp")),
  school: await loadImage(path.join(root, "public", "adoce-hoje", "adoce-na-escola.webp")),
  event: await loadImage(path.join(root, "public", "adoce-hoje", "tabuleiro-doces.webp")),
};

function rounded(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function cover(ctx, img, x, y, w, h, radius = 0) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.save();
  if (radius) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip(); }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function contain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 20) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return lines.slice(0, maxLines).length * lineHeight;
}

function centeredWrap(ctx, text, centerX, y, maxWidth, lineHeight, maxLines = 20) {
  const old = ctx.textAlign;
  ctx.textAlign = "center";
  const height = wrap(ctx, text, centerX, y, maxWidth, lineHeight, maxLines);
  ctx.textAlign = old;
  return height;
}

function heart(ctx, x, y, size, fill = C.coral) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(12, 21);
  ctx.bezierCurveTo(10, 19, 2, 14, 2, 8);
  ctx.bezierCurveTo(2, 3, 8, 1, 12, 6);
  ctx.bezierCurveTo(16, 1, 22, 3, 22, 8);
  ctx.bezierCurveTo(22, 14, 14, 19, 12, 21);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function sparkle(ctx, x, y, size, fill = C.coral) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * .16, -size * .16, size, 0);
  ctx.quadraticCurveTo(size * .16, size * .16, 0, size);
  ctx.quadraticCurveTo(-size * .16, size * .16, -size, 0);
  ctx.quadraticCurveTo(-size * .16, -size * .16, 0, -size);
  ctx.fill();
  ctx.restore();
}

async function qrImage(url, dark = C.chocolate) {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 3,
    width: 1000,
    color: { dark, light: "#ffffff" },
  });
  return loadImage(dataUrl);
}

function drawQrCard(ctx, qr, x, y, size, label, url, dark = false) {
  const card = dark ? C.chocolate : C.paper;
  const primary = dark ? C.paper : C.chocolate;
  rounded(ctx, x, y, size + 250, size + 330, 56, card, dark ? "#6f4034" : "#ecd7c8", 4);
  rounded(ctx, x + 125, y + 70, size, size, 34, "#ffffff");
  ctx.drawImage(qr, x + 155, y + 100, size - 60, size - 60);
  ctx.fillStyle = primary;
  ctx.font = "52px 'Adoce Sans Bold'";
  ctx.textAlign = "center";
  ctx.fillText(label, x + (size + 250) / 2, y + size + 175);
  ctx.fillStyle = dark ? "#efd7cb" : C.muted;
  ctx.font = "34px 'Adoce Sans'";
  ctx.fillText(url, x + (size + 250) / 2, y + size + 245);
  ctx.textAlign = "left";
}

async function savePng(canvas, filename) {
  await writeFile(path.join(outDir, filename), await canvas.encode("png"));
}

async function saveJpeg(canvas, filename) {
  await writeFile(path.join(outDir, filename), await canvas.encode("jpeg", 94));
}

function a4() { return createCanvas(2480, 3508); }

const siteUrl = "https://www.adocebrigaderia.com.br/";
const clubUrl = "https://www.adocebrigaderia.com.br/#clube";
const siteQr = await qrImage(siteUrl);
const clubQr = await qrImage(clubUrl);

// SITE — OPÇÃO A: acolhedora e direta.
{
  const canvas = a4(); const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = C.blush; ctx.beginPath(); ctx.arc(2150, 390, 660, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fde9df"; ctx.beginPath(); ctx.arc(260, 1900, 520, 0, Math.PI * 2); ctx.fill();
  contain(ctx, assets.logo, 100, 95, 300, 300);
  ctx.fillStyle = C.coral; ctx.font = "34px 'Adoce Sans Bold'"; ctx.letterSpacing = "5px";
  ctx.fillText("TUDO DA ADOCE EM UM SÓ LUGAR", 455, 205);
  ctx.fillStyle = C.chocolate; ctx.font = "142px 'Adoce Serif Bold'";
  wrap(ctx, "Seu próximo doce começa aqui.", 115, 545, 2200, 142, 3);
  ctx.fillStyle = C.muted; ctx.font = "48px 'Adoce Sans'";
  wrap(ctx, "Antes de escolher, veja sabores, encomendas e experiências feitas para adoçar o seu momento.", 120, 935, 1420, 70, 3);
  rounded(ctx, 1320, 850, 1010, 920, 220, C.pink);
  contain(ctx, assets.cake, 1305, 760, 1050, 1030);
  const benefits = [
    ["01", "Veja as fatias e sabores do dia"],
    ["02", "Escolha tortas, docinhos e festas"],
    ["03", "Conheça o Clube e fale com a gente"],
  ];
  benefits.forEach(([num, label], index) => {
    const y = 1800 + index * 210;
    rounded(ctx, 115, y, 1160, 160, 34, C.paper, "#ead5c6", 3);
    ctx.fillStyle = C.coral; ctx.font = "44px 'Adoce Sans Bold'"; ctx.fillText(num, 170, y + 95);
    ctx.fillStyle = C.chocolate; ctx.font = "43px 'Adoce Sans Bold'"; ctx.fillText(label, 305, y + 95);
  });
  drawQrCard(ctx, siteQr, 1320, 1835, 720, "Aponte a câmera e descubra", "adocebrigaderia.com.br");
  ctx.fillStyle = C.chocolate; ctx.font = "34px 'Adoce Sans Bold'"; ctx.textAlign = "center";
  ctx.fillText("ADOCE BRIGADERIA · FEITO COM CARINHO EM FORTALEZA", 1240, 3405); ctx.textAlign = "left";
  sparkle(ctx, 2200, 450, 45); heart(ctx, 108, 3050, 42, C.pink);
  await savePng(canvas, "a4-site-opcao-a.png");
}

// SITE — OPÇÃO B: impacto e desejo.
{
  const canvas = a4(); const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.chocolate; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#23100b"; ctx.fillRect(0, 0, canvas.width, 1180);
  contain(ctx, assets.logo, 95, 85, 290, 290);
  ctx.fillStyle = C.coral; ctx.font = "36px 'Adoce Sans Bold'"; ctx.fillText("ADOCEBRIGADERIA.COM.BR", 450, 200);
  ctx.fillStyle = C.paper; ctx.font = "126px 'Adoce Serif Bold'";
  wrap(ctx, "A vontade começa antes da primeira mordida.", 110, 555, 1500, 132, 4);
  ctx.fillStyle = "#ead5cb"; ctx.font = "46px 'Adoce Sans'";
  wrap(ctx, "Entre no site, escolha com calma e descubra tudo o que a Adoce pode preparar para você.", 120, 1050, 1380, 65, 3);
  rounded(ctx, 1540, 250, 820, 930, 90, C.blush);
  contain(ctx, assets.cake, 1470, 330, 960, 820);
  cover(ctx, assets.sweets, 0, 1290, 1240, 915, 0);
  cover(ctx, assets.premium, 1240, 1290, 1240, 915, 0);
  ctx.fillStyle = "rgba(50,20,13,.22)"; ctx.fillRect(0, 1290, 2480, 915);
  rounded(ctx, 100, 2320, 1000, 850, 52, "#4a2016", "#744536", 3);
  ctx.fillStyle = C.paper; ctx.font = "66px 'Adoce Serif Bold'";
  wrap(ctx, "No site você encontra:", 170, 2460, 820, 80, 2);
  const lines = ["Sabores e valores do dia", "Encomendas e comemorações", "Clube Adoce e novidades"];
  ctx.font = "40px 'Adoce Sans Bold'";
  lines.forEach((line, i) => { heart(ctx, 175, 2635 + i * 135, 34); ctx.fillText(line, 245, 2670 + i * 135); });
  drawQrCard(ctx, siteQr, 1280, 2260, 760, "Abra o site agora", "adocebrigaderia.com.br", true);
  ctx.fillStyle = "#d9bbaa"; ctx.font = "30px 'Adoce Sans'"; ctx.textAlign = "center";
  ctx.fillText("Fotos reais · informações atualizadas · contato direto", 1240, 3430); ctx.textAlign = "left";
  await savePng(canvas, "a4-site-opcao-b.png");
}

// CLUBE — OPÇÃO A: benefício explicado com leveza.
{
  const canvas = a4(); const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, 2480, 3508);
  ctx.fillStyle = C.blush; ctx.beginPath(); ctx.arc(1240, 200, 1120, 0, Math.PI * 2); ctx.fill();
  contain(ctx, assets.logo, 970, 80, 540, 540);
  ctx.fillStyle = C.coral; ctx.font = "38px 'Adoce Sans Bold'"; ctx.textAlign = "center";
  ctx.fillText("FAÇA PARTE DO CLUBE ADOCE", 1240, 690);
  ctx.fillStyle = C.chocolate; ctx.font = "130px 'Adoce Serif Bold'";
  centeredWrap(ctx, "A cada fatia, um carinho de volta.", 1240, 920, 2100, 138, 3);
  ctx.fillStyle = C.muted; ctx.font = "49px 'Adoce Sans'";
  centeredWrap(ctx, "Compre sua fatia, receba um carimbo e acompanhe tudo pelo celular.", 1240, 1325, 1850, 70, 3);
  rounded(ctx, 135, 1600, 2210, 530, 56, C.paper, "#ead3c5", 4);
  ctx.fillStyle = C.chocolate; ctx.font = "46px 'Adoce Sans Bold'"; ctx.textAlign = "center";
  ctx.fillText("1 FATIA = 1 CARIMBO", 1240, 1730);
  for (let i = 0; i < 14; i++) {
    const x = 350 + (i % 7) * 300;
    const y = 1870 + Math.floor(i / 7) * 150;
    ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? C.coral : C.cream; ctx.fill();
    ctx.strokeStyle = i === 0 ? C.coral : "#dfc3b2"; ctx.lineWidth = 4; ctx.stroke();
    heart(ctx, x - 19, y - 20, 38, i === 0 ? "#ffffff" : "#c99f8c");
  }
  rounded(ctx, 155, 2210, 870, 430, 48, C.chocolate);
  ctx.fillStyle = C.paper; ctx.font = "86px 'Adoce Serif Bold'"; ctx.textAlign = "center";
  ctx.fillText("14 carimbos", 590, 2360);
  ctx.fillStyle = C.pink; ctx.font = "44px 'Adoce Sans Bold'"; ctx.fillText("= 1 FATIA GRÁTIS", 590, 2460);
  ctx.fillStyle = "#e9d5cb"; ctx.font = "31px 'Adoce Sans'"; ctx.fillText("Sua conquista fica guardada.", 590, 2540);
  drawQrCard(ctx, clubQr, 1170, 2200, 720, "Entre para o Clube", "adocebrigaderia.com.br/#clube");
  ctx.fillStyle = C.chocolate; ctx.font = "34px 'Adoce Sans Bold'"; ctx.textAlign = "center";
  ctx.fillText("É GRATUITO · LEVA MENOS DE UM MINUTO", 1240, 3385); ctx.textAlign = "left";
  await savePng(canvas, "a4-clube-opcao-a.png");
}

// CLUBE — OPÇÃO B: mais sofisticada e emocional.
{
  const canvas = a4(); const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.chocolate; ctx.fillRect(0, 0, 2480, 3508);
  ctx.fillStyle = "#492016"; ctx.beginPath(); ctx.arc(2190, 230, 740, 0, Math.PI * 2); ctx.fill();
  contain(ctx, assets.logo, 95, 85, 300, 300);
  ctx.fillStyle = C.coral; ctx.font = "36px 'Adoce Sans Bold'"; ctx.fillText("CLUBE ADOCE", 450, 220);
  ctx.fillStyle = C.paper; ctx.font = "132px 'Adoce Serif Bold'";
  wrap(ctx, "Você já escolhe a fatia. Agora ela também conta.", 115, 610, 2050, 140, 4);
  ctx.fillStyle = "#e8d2c7"; ctx.font = "48px 'Adoce Sans'";
  wrap(ctx, "Cada fatia comprada vira um carimbo. Complete 14 e ganhe uma fatia grátis.", 125, 1160, 1780, 70, 3);
  rounded(ctx, 115, 1430, 2250, 890, 62, C.cream, "#795044", 4);
  ctx.fillStyle = C.coral; ctx.font = "35px 'Adoce Sans Bold'"; ctx.fillText("SEU CARTÃO, SEM PAPEL E SEM ESQUECER", 220, 1555);
  ctx.fillStyle = C.chocolate; ctx.font = "82px 'Adoce Serif Bold'";
  wrap(ctx, "A doçura fica guardada no seu celular.", 220, 1740, 1230, 92, 3);
  for (let i = 0; i < 14; i++) {
    const x = 260 + (i % 7) * 190;
    const y = 2040 + Math.floor(i / 7) * 120;
    ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.strokeStyle = "#d4ad99"; ctx.lineWidth = 3; ctx.stroke();
    heart(ctx, x - 14, y - 15, 29, "#d4ad99");
  }
  contain(ctx, assets.cake, 1440, 1510, 850, 740);
  drawQrCard(ctx, clubQr, 100, 2430, 700, "Aponte e faça parte", "adocebrigaderia.com.br/#clube", true);
  ctx.fillStyle = C.paper; ctx.font = "66px 'Adoce Serif Bold'";
  wrap(ctx, "Seu próximo carimbo pode começar hoje.", 1170, 2650, 1100, 78, 3);
  ctx.fillStyle = C.pink; ctx.font = "37px 'Adoce Sans Bold'";
  wrap(ctx, "Cadastro gratuito · cartão digital · recompensa no seu tempo", 1170, 2940, 1050, 54, 3);
  ctx.fillStyle = "#d9bbaa"; ctx.font = "31px 'Adoce Sans'"; ctx.textAlign = "center";
  ctx.fillText("ADOCE BRIGADERIA · ESPALHE DOÇURA", 1240, 3415); ctx.textAlign = "left";
  await savePng(canvas, "a4-clube-opcao-b.png");
}

// BANNER — OPÇÃO A: claro, artesanal e acolhedor. 120 × 80 cm na proporção 3:2.
{
  const canvas = createCanvas(6000, 4000); const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, 6000, 4000);
  ctx.fillStyle = C.blush; ctx.beginPath(); ctx.arc(5350, 450, 1350, 0, Math.PI * 2); ctx.fill();
  contain(ctx, assets.logo, 260, 240, 780, 780);
  ctx.fillStyle = C.coral; ctx.font = "76px 'Adoce Sans Bold'"; ctx.fillText("ADOCE BRIGADERIA · DESDE 2023", 1180, 510);
  ctx.fillStyle = C.chocolate; ctx.font = "280px 'Adoce Serif Bold'";
  wrap(ctx, "Mais que doces. Momentos feitos à mão.", 300, 1260, 3600, 300, 4);
  ctx.fillStyle = C.muted; ctx.font = "92px 'Adoce Sans'";
  wrap(ctx, "Da nossa produção para a sua comemoração, com cuidado em cada detalhe.", 320, 2600, 3250, 125, 3);
  rounded(ctx, 3950, 520, 1750, 2850, 320, C.pink);
  contain(ctx, assets.cake, 3600, 500, 2400, 2900);
  ctx.fillStyle = C.chocolate; ctx.fillRect(0, 3490, 6000, 510);
  ctx.fillStyle = C.paper; ctx.font = "92px 'Adoce Sans Bold'"; ctx.textAlign = "center";
  ctx.fillText("@_adocebrigaderia_   ·   adocebrigaderia.com.br", 3000, 3805); ctx.textAlign = "left";
  sparkle(ctx, 1150, 900, 70); heart(ctx, 370, 3160, 80, C.coral);
  await saveJpeg(canvas, "banner-opcao-a-120x80.jpg");
}

// BANNER — OPÇÃO B: escuro, sofisticado e centrado no produto.
{
  const canvas = createCanvas(6000, 4000); const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.chocolate; ctx.fillRect(0, 0, 6000, 4000);
  ctx.fillStyle = "#1f0d09"; ctx.fillRect(0, 0, 6000, 4000);
  cover(ctx, assets.sweets, 3950, 0, 2050, 2000);
  cover(ctx, assets.premium, 3950, 2000, 2050, 2000);
  ctx.fillStyle = "rgba(31,13,9,.18)"; ctx.fillRect(3950, 0, 2050, 4000);
  contain(ctx, assets.logo, 250, 240, 830, 830);
  ctx.fillStyle = C.coral; ctx.font = "78px 'Adoce Sans Bold'"; ctx.fillText("FEITO POR NÓS. PENSADO PARA VOCÊ.", 1200, 590);
  ctx.fillStyle = C.paper; ctx.font = "285px 'Adoce Serif Bold'";
  wrap(ctx, "O amor aparece nos detalhes. O sabor fica na memória.", 300, 1370, 3350, 300, 5);
  ctx.fillStyle = "#e3cbc0"; ctx.font = "88px 'Adoce Sans'";
  wrap(ctx, "Tortas, docinhos e experiências artesanais em Fortaleza.", 320, 2920, 3300, 125, 3);
  rounded(ctx, 300, 3430, 3300, 340, 60, "#4b2117", "#754438", 4);
  ctx.fillStyle = C.paper; ctx.font = "82px 'Adoce Sans Bold'"; ctx.textAlign = "center";
  ctx.fillText("@_adocebrigaderia_  ·  adocebrigaderia.com.br", 1950, 3650); ctx.textAlign = "left";
  await saveJpeg(canvas, "banner-opcao-b-120x80.jpg");
}

const manifest = {
  createdAt: new Date().toISOString(),
  assets: [
    { file: "a4-site-opcao-a.png", size: "2480x3508", target: siteUrl },
    { file: "a4-site-opcao-b.png", size: "2480x3508", target: siteUrl },
    { file: "a4-clube-opcao-a.png", size: "2480x3508", target: clubUrl },
    { file: "a4-clube-opcao-b.png", size: "2480x3508", target: clubUrl },
    { file: "banner-opcao-a-120x80.jpg", size: "6000x4000", target: "120x80 cm" },
    { file: "banner-opcao-b-120x80.jpg", size: "6000x4000", target: "120x80 cm" },
  ],
  qr: { errorCorrectionLevel: "H", siteUrl, clubUrl },
};
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Materiais gerados em ${outDir}`);
