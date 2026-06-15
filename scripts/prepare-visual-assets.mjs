import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('public/assets');
const graphics = ['branding', 'buttons', 'cards', 'decor', 'icons', 'stamps'];

function isCheckerPixel(r, g, b) {
  return Math.min(r, g, b) > 222 && Math.max(r, g, b) - Math.min(r, g, b) < 13;
}

async function removeConnectedCheckerboard(file) {
  const image = sharp(file).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = index => {
    if (seen[index]) return;
    const offset = index * channels;
    if (!isCheckerPixel(data[offset], data[offset + 1], data[offset + 2])) return;
    seen[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    data[index * channels + 3] = 0;
    if (x) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  const temporary = `${file}.clean.png`;
  await sharp(data, { raw: info }).png().toFile(temporary);
  await rm(file);
  await rename(temporary, file);
}

for (const folder of graphics) {
  const dir = path.join(root, folder);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.png') && !entry.name.endsWith('.clean.png') && entry.name !== 'stamp-fatia-chocolate-alt.png') {
      await removeConnectedCheckerboard(path.join(dir, entry.name));
    }
  }
}

const splitDir = path.join(root, 'icons', 'split');
await mkdir(splitDir, { recursive: true });
const client = [
  ['icon-home.png', 0, 0], ['icon-card.png', 1, 0], ['icon-family.png', 2, 0],
  ['icon-referral.png', 3, 0], ['icon-profile.png', 4, 0], ['icon-qr.png', 0, 1],
  ['icon-location.png', 1, 1], ['icon-notifications.png', 2, 1], ['icon-orders.png', 3, 1],
  ['icon-more.png', 4, 1],
];
const gestor = [
  ['icon-cash.png', 0, 0], ['icon-sales.png', 1, 0], ['icon-reports.png', 2, 0],
  ['icon-settings.png', 3, 0], ['icon-expense.png', 0, 1], ['icon-payment-link.png', 1, 1],
  ['icon-delivery.png', 2, 1], ['icon-terminal.png', 3, 1], ['icon-documentation.png', 0, 2],
  ['icon-reservation.png', 1, 2], ['icon-award.png', 2, 2], ['icon-store.png', 3, 2],
];
async function splitBoard(source, columns, rows, items) {
  const metadata = await sharp(source).metadata();
  const cellWidth = Math.floor(metadata.width / columns);
  const cellHeight = Math.floor(metadata.height / rows);
  for (const [name, column, row] of items) {
    const left = column * cellWidth;
    const top = row * cellHeight;
    const width = Math.min(cellWidth, metadata.width - left);
    const height = Math.min(Math.round(cellHeight * .88), metadata.height - top);
    await sharp(source).extract({ left, top, width, height }).resize(160, 160, { fit: 'contain' }).png().toFile(path.join(splitDir, name));
  }
}
await splitBoard(path.join(root, 'icons', 'icons-cliente-menu.png'), 5, 3, client);
await splitBoard(path.join(root, 'icons', 'icons-gestor-menu.png'), 4, 3, gestor);
