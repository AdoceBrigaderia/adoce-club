import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from '@zxing/library';
import path from 'node:path';

const outputDir = path.resolve('marketing-assets/impressos-atendimento');

const checks = [
  {
    file: 'a4-site-opcao-a.png',
    crop: [1450, 1910, 710, 710],
    expected: 'https://www.adocebrigaderia.com.br/',
  },
  {
    file: 'a4-site-opcao-b.png',
    crop: [1410, 2335, 750, 750],
    expected: 'https://www.adocebrigaderia.com.br/',
  },
  {
    file: 'a4-clube-opcao-a.png',
    crop: [1300, 2275, 710, 710],
    expected: 'https://www.adocebrigaderia.com.br/#clube',
  },
  {
    file: 'a4-clube-opcao-b.png',
    crop: [230, 2505, 690, 690],
    expected: 'https://www.adocebrigaderia.com.br/#clube',
  },
];

for (const check of checks) {
  const image = await loadImage(path.join(outputDir, check.file));
  const [x, y, width, height] = check.crop;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const grayscale = new Uint8ClampedArray(width * height);
  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    grayscale[index] = Math.round(
      pixels.data[offset] * 0.299
      + pixels.data[offset + 1] * 0.587
      + pixels.data[offset + 2] * 0.114,
    );
  }
  const luminance = new RGBLuminanceSource(grayscale, width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
  const result = new QRCodeReader().decode(bitmap).getText();

  if (result !== check.expected) {
    throw new Error(`${check.file}: QR inesperado: ${result}`);
  }

  console.log(`${check.file}: QR OK -> ${result}`);
}
