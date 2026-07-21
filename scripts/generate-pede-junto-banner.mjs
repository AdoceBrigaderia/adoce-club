import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const width = 6000;
const height = 3000;
const outputDir = path.resolve('marketing-assets/impressos-atendimento/premium-v2/pede-junto-banner');
const sourceDir = path.join(outputDir, 'sources');
await mkdir(outputDir, { recursive: true });

GlobalFonts.registerFromPath('C:/Windows/Fonts/georgiab.ttf', 'Adoce Serif Bold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'Adoce Sans Bold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf', 'Adoce Sans');

const colors = {
  cocoa: '#2a110c',
  cream: '#fff5e9',
  coral: '#ef6f68',
  blush: '#f5c9c1',
  gold: '#c89a4b',
};

function rounded(context, x, y, w, h, radius, fill, stroke, lineWidth = 0) {
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke && lineWidth) {
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
  }
}

function contain(context, image, x, y, w, h) {
  const ratio = Math.min(w / image.width, h / image.height);
  const dw = image.width * ratio;
  const dh = image.height * ratio;
  context.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function cover(context, image, x, y, w, h) {
  const ratio = Math.max(w / image.width, h / image.height);
  const dw = image.width * ratio;
  const dh = image.height * ratio;
  context.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

async function extractPackages() {
  const source = await loadImage(path.resolve('public/site/pede-junto-pacotes.png'));
  const canvas = createCanvas(source.width, source.height);
  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, source.width, source.height);
  const data = imageData.data;
  const visited = new Uint8Array(source.width * source.height);
  const queue = new Int32Array(source.width * source.height);
  let head = 0;
  let tail = 0;

  const eligible = (index) => {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return r > 188 && g > 182 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 58;
  };

  const enqueue = (index) => {
    if (!visited[index] && eligible(index)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < source.width; x += 1) {
    enqueue(x);
    enqueue((source.height - 1) * source.width + x);
  }
  for (let y = 0; y < source.height; y += 1) {
    enqueue(y * source.width);
    enqueue(y * source.width + source.width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % source.width;
    const y = Math.floor(index / source.width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < source.width) enqueue(index + 1);
    if (y > 0) enqueue(index - source.width);
    if (y + 1 < source.height) enqueue(index + source.width);
  }

  for (let index = 0; index < visited.length; index += 1) {
    if (visited[index]) data[index * 4 + 3] = 0;
  }
  context.putImageData(imageData, 0, 0);
  const buffer = await canvas.encode('png');
  const filename = path.join(sourceDir, 'pede-junto-pacotes-recorte.png');
  await writeFile(filename, buffer);
  return loadImage(buffer);
}

const background = await loadImage(path.join(sourceDir, 'fundo-pede-junto.png'));
const logo = await loadImage(path.resolve('public/wallet/brand/logo-transparent.png'));
const packages = await extractPackages();
const qrTarget = 'https://www.adocebrigaderia.com.br/#pede-junto';
const qrDataUrl = await QRCode.toDataURL(qrTarget, {
  errorCorrectionLevel: 'H',
  margin: 3,
  width: 1000,
  color: { dark: colors.cocoa, light: '#ffffff' },
});
const qr = await loadImage(qrDataUrl);

const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';
cover(context, background, 0, 0, width, height);

// Painel de leitura sobre a área chocolate.
rounded(context, 185, 165, 2750, 2010, 90, 'rgba(32, 10, 7, .88)', 'rgba(215, 164, 85, .7)', 6);
contain(context, logo, 255, 225, 390, 390);
context.fillStyle = colors.blush;
context.font = "82px 'Adoce Sans Bold'";
context.letterSpacing = '12px';
context.fillText('PEDE JUNTO ADOCE', 700, 365);

context.fillStyle = colors.cream;
context.font = "205px 'Adoce Serif Bold'";
context.fillText('Cada um escolhe.', 300, 720);
context.fillText('Cada um paga o seu.', 300, 955);
context.fillStyle = colors.coral;
context.font = "150px 'Adoce Serif Bold'";
context.fillText('Todo mundo recebe junto.', 300, 1180);

rounded(context, 300, 1320, 2400, 360, 60, colors.cream, colors.gold, 7);
context.fillStyle = colors.cocoa;
context.font = "92px 'Adoce Sans Bold'";
context.fillText('5 FATIAS NO MESMO ENDEREÇO', 405, 1450);
context.fillStyle = colors.coral;
context.font = "142px 'Adoce Serif Bold'";
context.fillText('ENTREGA GRÁTIS.', 405, 1620);

context.fillStyle = colors.cream;
context.font = "61px 'Adoce Sans'";
context.fillText('Chegou em cinco? O grupo continua aberto.', 320, 1815);
context.fillStyle = colors.blush;
context.font = "67px 'Adoce Sans Bold'";
context.fillText('Quanto mais gente, mais doce fica.', 320, 1910);

// Progresso 1–5 e infinito.
for (let index = 0; index < 5; index += 1) {
  const x = 420 + index * 275;
  context.beginPath();
  context.arc(x, 2075, 88, 0, Math.PI * 2);
  context.fillStyle = index === 4 ? colors.coral : '#6c362b';
  context.fill();
  context.strokeStyle = index === 4 ? colors.cream : '#a56a58';
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = colors.cream;
  context.textAlign = 'center';
  context.font = "70px 'Adoce Serif Bold'";
  context.fillText(String(index + 1), x, 2100);
}
context.fillStyle = colors.coral;
context.font = "165px 'Adoce Serif Bold'";
context.fillText('∞', 1885, 2120);
context.textAlign = 'left';

// Pacotes reais, resultado visual das pessoas reunidas.
context.save();
context.shadowColor = 'rgba(44, 15, 8, .3)';
context.shadowBlur = 45;
context.shadowOffsetY = 30;
contain(context, packages, 2920, 810, 2500, 2040);
context.restore();

// Convite e QR em posição alta, visível mesmo com pessoas diante do banner.
rounded(context, 4880, 155, 910, 890, 90, 'rgba(255, 247, 237, .96)', colors.gold, 8);
context.fillStyle = colors.cocoa;
context.textAlign = 'center';
context.font = "62px 'Adoce Sans Bold'";
context.fillText('ABRA SEU GRUPO', 5335, 275);
context.drawImage(qr, 5040, 330, 590, 590);
context.fillStyle = '#78564b';
context.font = "38px 'Adoce Sans'";
context.fillText('Aponte a câmera', 5335, 990);

rounded(context, 3330, 2390, 2420, 345, 62, 'rgba(42, 17, 12, .92)', colors.gold, 6);
context.fillStyle = colors.cream;
context.font = "62px 'Adoce Sans Bold'";
context.fillText('NO TRABALHO  •  NO CONDOMÍNIO', 4540, 2515);
context.fillText('NA FACULDADE  •  NA CLÍNICA', 4540, 2610);
context.fillStyle = colors.blush;
context.font = "43px 'Adoce Sans'";
context.fillText('adocebrigaderia.com.br/#pede-junto', 4540, 2690);
context.textAlign = 'left';

const pngName = path.join(outputDir, 'banner-pede-junto-adoce-200x100.png');
const jpgName = path.join(outputDir, 'banner-pede-junto-adoce-200x100.jpg');
await writeFile(pngName, await canvas.encode('png'));
await writeFile(jpgName, await canvas.encode('jpeg', 96));
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
  files: [path.basename(pngName), path.basename(jpgName)],
  pixels: `${width}x${height}`,
  suggestedPrintSize: '200x100 cm',
  qrTarget,
  qrCrop: [5025, 315, 620, 620],
}, null, 2)}\n`);

console.log(`Banner Pede Junto gerado em ${outputDir}`);
