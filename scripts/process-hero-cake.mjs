import { readFile, writeFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";

const source = new URL("../hero-cake-chroma.png", import.meta.url);
const target = new URL("../hero-cake-transparent.png", import.meta.url);
const image = await loadImage(fileURLToPath(source));
const canvas = createCanvas(image.width, image.height);
const context = canvas.getContext("2d");
context.drawImage(image, 0, 0);
const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

let minX = canvas.width;
let minY = canvas.height;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < canvas.height; y += 1) {
  for (let x = 0; x < canvas.width; x += 1) {
    const index = (y * canvas.width + x) * 4;
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const dominance = green - Math.max(red, blue);

    if (green > 35 && dominance > 8) {
      const keep = Math.max(0, Math.min(1, 1 - (dominance - 8) / 32));
      pixels.data[index + 1] = Math.min(green, Math.round((red + blue) * 0.5));
      pixels.data[index + 3] = Math.round(pixels.data[index + 3] * keep);
    }

    if (pixels.data[index + 3] > 18) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

context.putImageData(pixels, 0, 0);
const padding = 20;
const cropX = Math.max(0, minX - padding);
const cropY = Math.max(0, minY - padding);
const cropWidth = Math.min(canvas.width - cropX, maxX - minX + 1 + padding * 2);
const cropHeight = Math.min(canvas.height - cropY, maxY - minY + 1 + padding * 2);
const output = createCanvas(cropWidth, cropHeight);
output.getContext("2d").drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
await writeFile(target, output.toBuffer("image/png"));
console.log(`Hero cake processed: ${cropWidth}x${cropHeight}`);
