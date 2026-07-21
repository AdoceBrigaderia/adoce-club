import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('marketing-assets/impressos-atendimento/premium-v2/finais-a4');
const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));

for (const item of manifest) {
  const image = await loadImage(path.join(outputDir, item.file));
  const [x, y, width, height] = item.qrCrop;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const grayscale = new Uint8ClampedArray(width * height);
  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    grayscale[index] = Math.round(rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114);
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(grayscale, width, height)));
  const decoded = new QRCodeReader().decode(bitmap).getText();
  if (decoded !== item.target) throw new Error(`${item.file}: esperado ${item.target}, recebido ${decoded}`);
  console.log(`${item.file}: QR OK -> ${decoded}`);
}
