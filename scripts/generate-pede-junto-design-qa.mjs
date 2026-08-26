import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";

const source = await loadImage("D:/Clube Adoce/design-references/pede-junto-adoce-final.png");
const implementation = await loadImage("D:/Clube Adoce/design-qa-pede-junto-hero-desktop-v2.png");
const canvas = createCanvas(2080, 780);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#29130e";
ctx.fillRect(0, 0, 2080, 780);
ctx.fillStyle = "#ffffff";
ctx.font = "700 24px Arial";
ctx.fillText("REFERÊNCIA APROVADA", 40, 42);
ctx.fillText("IMPLEMENTAÇÃO NO NAVEGADOR", 1060, 42);

function cover(image, x, y, width, height, cropHeight = image.height) {
  const scale = Math.max(width / image.width, height / cropHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  ctx.drawImage(image, sourceX, 0, sourceWidth, sourceHeight, x, y, width, height);
}

cover(source, 40, 70, 980, 670, 555);
cover(implementation, 1060, 70, 980, 670, implementation.height);
await writeFile("D:/Clube Adoce/design-qa-pede-junto-comparison.png", canvas.toBuffer("image/png"));
