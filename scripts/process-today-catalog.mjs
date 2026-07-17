import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "public", "adoce-hoje");
await mkdir(outputDir, { recursive: true });

const jobs = [
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_13 (1).png",
    target: "chocolatudo.webp",
    crop: [210, 500, 720, 620],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_14 (4).png",
    target: "ferrero-rocher.webp",
    crop: [210, 520, 720, 620],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_15 (7).png",
    target: "oreo.webp",
    crop: [190, 520, 740, 650],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/17JulRetiradas/ChatGPT Image 17 de jul. de 2026, 02_22_14 (2).png",
    target: "abacaxi-coco.webp",
    crop: [210, 450, 720, 700],
  },
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
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/pacote_adoce_fatias/maracuja_com_chocolate/maracuja_com_chocolate.png",
    target: "maracuja-chocolate.webp",
    crop: [170, 300, 790, 720],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/pacote_adoce_fatias/surpresa_de_uva/surpresa_de_uva.png",
    target: "surpresa-uva.webp",
    crop: [330, 580, 700, 620],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/pacote_adoce_fatias/chocolatudo_dark/chocolatudo_dark.png",
    target: "trufado-black-ilustrativa.webp",
    crop: [170, 420, 780, 730],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/pacote_adoce_fatias/chocolatudo/chocolatudo.png",
    target: "fatia-ilustrativa.webp",
    crop: [140, 350, 840, 760],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/pacote_adoce_fatias/abacaxi_com_coco_torta_inteira/abacaxi_com_coco_torta_inteira.png",
    target: "torta-abacaxi-coco.webp",
    crop: [390, 260, 700, 720],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/pacote_adoce_fatias/trufado_de_morango_torta_inteira/trufado_de_morango_torta_inteira.png",
    target: "torta-trufado-morango.webp",
    crop: [420, 430, 680, 630],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/ChatGPT Image 17 de jul. de 2026, 08_00_00 (5).png",
    target: "torta-chocolatudo.webp",
    crop: [70, 280, 980, 620],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/ChatGPT Image 17 de jul. de 2026, 08_44_46 (3).png",
    target: "torta-ferrero-rocher.webp",
    crop: [410, 300, 690, 720],
  },
  {
    source: "C:/Users/RubensBezerra/Documents/CATALOGO/ChatGPT Image 17 de jul. de 2026, 08_44_46 (4).png",
    target: "torta-oreo.webp",
    crop: [100, 430, 960, 700],
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
