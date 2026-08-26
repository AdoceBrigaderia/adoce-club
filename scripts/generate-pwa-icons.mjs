import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = process.cwd();
const logo = await loadImage(join(root, "public", "site", "logo.webp"));

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.beginPath();
  ctx.moveTo(16, 28);
  ctx.bezierCurveTo(13, 23, 3, 17, 3, 9);
  ctx.bezierCurveTo(3, 1, 13, -1, 16, 6);
  ctx.bezierCurveTo(19, -1, 29, 1, 29, 9);
  ctx.bezierCurveTo(29, 17, 19, 23, 16, 28);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawCheck(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.52);
  ctx.lineTo(size * 0.42, size * 0.74);
  ctx.lineTo(size * 0.82, size * 0.28);
  ctx.stroke();
  ctx.restore();
}

async function generate(kind, size, fileName) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const padding = size * 0.055;
  roundedRect(ctx, padding, padding, size - padding * 2, size - padding * 2, size * 0.22);
  const gradient = ctx.createRadialGradient(size * 0.36, size * 0.25, 0, size / 2, size / 2, size * 0.72);
  if (kind === "clube") {
    gradient.addColorStop(0, "#fffaf4");
    gradient.addColorStop(0.58, "#f9d3cc");
    gradient.addColorStop(1, "#ee8d86");
  } else {
    gradient.addColorStop(0, "#4b2118");
    gradient.addColorStop(0.62, "#26100b");
    gradient.addColorStop(1, "#120705");
  }
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.save();
  roundedRect(ctx, padding, padding, size - padding * 2, size - padding * 2, size * 0.22);
  ctx.clip();
  ctx.save();
  ctx.globalAlpha = kind === "clube" ? 0.18 : 0.12;
  ctx.strokeStyle = kind === "clube" ? "#ffffff" : "#f7b0a8";
  ctx.lineWidth = Math.max(2, size * 0.012);
  ctx.beginPath();
  ctx.arc(size * 0.12, size * 0.1, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.9, size * 0.88, size * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const logoSize = kind === "clube" ? size * 0.69 : size * 0.64;
  ctx.save();
  ctx.shadowColor = "rgba(35, 10, 5, 0.24)";
  ctx.shadowBlur = size * 0.05;
  ctx.shadowOffsetY = size * 0.018;
  ctx.drawImage(logo, (size - logoSize) / 2, (size - logoSize) / 2 - size * 0.025, logoSize, logoSize);
  ctx.restore();
  const badgeSize = size * 0.225;
  const badgeX = size * 0.69;
  const badgeY = size * 0.68;
  ctx.save();
  ctx.shadowColor = "rgba(35, 10, 5, 0.28)";
  ctx.shadowBlur = size * 0.025;
  ctx.fillStyle = kind === "clube" ? "#f0645f" : "#4f7b64";
  ctx.beginPath();
  ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.012);
  ctx.strokeStyle = "#fff8f0";
  ctx.stroke();
  ctx.restore();
  if (kind === "clube") drawHeart(ctx, badgeX + badgeSize * 0.19, badgeY + badgeSize * 0.2, badgeSize * 0.62, "#ffffff");
  else drawCheck(ctx, badgeX + badgeSize * 0.14, badgeY + badgeSize * 0.12, badgeSize * 0.72);
  ctx.restore();
  const outputDirectory = join(root, "public", "pwa", kind);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, fileName), await canvas.encode("png"));
}

for (const kind of ["clube", "operacao"]) {
  await generate(kind, 192, "icon-192.png");
  await generate(kind, 512, "icon-512.png");
  await generate(kind, 180, "apple-touch-icon.png");
}

console.log("Ícones PWA do Clube Adoce e Adoce Operação gerados.");
