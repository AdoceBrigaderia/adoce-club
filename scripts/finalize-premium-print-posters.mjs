import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceDir = path.resolve('marketing-assets/impressos-atendimento/premium-v2/sources');
const outputDir = path.resolve('marketing-assets/impressos-atendimento/premium-v2/finais-a4');
await mkdir(outputDir, { recursive: true });

GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'Adoce Sans Bold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/georgiab.ttf', 'Adoce Serif Bold');

const width = 2480;
const height = 3508;
const sourceWidth = 1024;
const sourceHeight = 1536;
const scale = width / sourceWidth;
const sourceRenderedHeight = sourceHeight * scale;
const offsetY = (height - sourceRenderedHeight) / 2;

const siteUrl = 'https://www.adocebrigaderia.com.br/';
const clubUrl = 'https://www.adocebrigaderia.com.br/#clube';

function sx(value) { return value * scale; }
function sy(value) { return value * scale + offsetY; }

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

async function createQr(url, size) {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 3,
    width: size,
    color: { dark: '#2b120d', light: '#ffffff' },
  });
  return loadImage(dataUrl);
}

const posters = [
  { source: 'site-campanha-a.png', output: 'a4-site-campanha-premium-a.png', target: siteUrl, qr: [704, 1012, 238] },
  { source: 'site-campanha-b.png', output: 'a4-site-campanha-premium-b.png', target: siteUrl, qr: [606, 1162, 264] },
  { source: 'site-campanha-c.png', output: 'a4-site-campanha-premium-c.png', target: siteUrl, qr: [120, 1160, 258] },
  { source: 'clube-campanha-a.png', output: 'a4-clube-cartao-premium-a.png', target: clubUrl, qr: [657, 1224, 180], cardFix: 'a' },
  { source: 'clube-campanha-b.png', output: 'a4-clube-cartao-premium-b.png', target: clubUrl, qr: [707, 1260, 198], cardFix: 'b' },
  { source: 'clube-campanha-c.png', output: 'a4-clube-cartao-premium-c.png', target: clubUrl, qr: [786, 1150, 174] },
];

const manifest = [];

for (const poster of posters) {
  const source = await loadImage(path.join(sourceDir, poster.source));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, offsetY, width, sourceRenderedHeight);

  if (poster.cardFix === 'a') {
    const x = sx(666); const y = sy(1020); const w = sx(224); const h = sx(94);
    context.save();
    context.translate(x + w / 2, y + h / 2);
    context.rotate(-0.035);
    rounded(context, -w / 2, -h / 2, w, h, sx(14), '#ef746d', '#c69748', sx(2));
    context.fillStyle = '#fff7ed';
    context.textAlign = 'center';
    context.font = `${sx(21)}px 'Adoce Sans Bold'`;
    context.fillText('14 CARIMBOS', 0, -sx(6));
    context.font = `${sx(17)}px 'Adoce Sans Bold'`;
    context.fillText('= 1 FATIA GRÁTIS', 0, sx(22));
    context.restore();
  }

  if (poster.cardFix === 'b') {
    const x = sx(844); const y = sy(806); const radius = sx(66);
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = '#ef746d';
    context.fill();
    context.strokeStyle = '#c69748';
    context.lineWidth = sx(3);
    context.stroke();
    context.fillStyle = '#fff7ed';
    context.textAlign = 'center';
    context.font = `${sx(30)}px 'Adoce Serif Bold'`;
    context.fillText('14', x, y - sx(4));
    context.font = `${sx(13)}px 'Adoce Sans Bold'`;
    context.fillText('CARIMBOS', x, y + sx(23));
    context.restore();
  }

  const [qrXSource, qrYSource, qrSizeSource] = poster.qr;
  const qrX = sx(qrXSource);
  const qrY = sy(qrYSource);
  const qrSize = sx(qrSizeSource);
  const padding = sx(7);
  rounded(context, qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2, sx(8), '#ffffff');
  const qr = await createQr(poster.target, Math.round(qrSize));
  context.drawImage(qr, qrX, qrY, qrSize, qrSize);

  await writeFile(path.join(outputDir, poster.output), await canvas.encode('png'));
  manifest.push({
    file: poster.output,
    size: `${width}x${height}`,
    target: poster.target,
    qrCrop: [Math.round(qrX - padding), Math.round(qrY - padding), Math.round(qrSize + padding * 2), Math.round(qrSize + padding * 2)],
  });
}

await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Seis cartazes finais gerados em ${outputDir}`);
