import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('marketing-assets/impressos-atendimento/premium-v2/pede-junto-banner');
const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
const image = await loadImage(path.join(outputDir, manifest.files[0]));
const [x, y, width, height] = manifest.qrCrop;
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
if (decoded !== manifest.qrTarget) throw new Error(`Esperado ${manifest.qrTarget}, recebido ${decoded}`);
console.log(`QR OK -> ${decoded}`);
