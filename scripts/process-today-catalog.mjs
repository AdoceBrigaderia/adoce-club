import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "public", "adoce-hoje");
await mkdir(outputDir, { recursive: true });

const jobs = [
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_14 (3).png",
    target: "chocolatudo-trufado-morangos.webp",
    crop: [280, 470, 650, 650],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_14 (5).png",
    target: "brigadeiro-castanha.webp",
    crop: [320, 470, 610, 650],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_15 (6).png",
    target: "trufado-ninho-morango.webp",
    crop: [220, 520, 700, 600],
  },
];

for (const job of jobs) {
  const image = await loadImage(job.source);
  const canvas = createCanvas(960, 720);
  const context = canvas.getContext("2d");
  context.fillStyle = "#f8ddd2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, ...job.crop, 0, 0, canvas.width, canvas.height);
  await writeFile(resolve(outputDir, job.target), await canvas.encode("webp", 82));
}
