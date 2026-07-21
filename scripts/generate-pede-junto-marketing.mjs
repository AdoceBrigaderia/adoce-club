import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "marketing-assets", "pede-junto-adoce");
await mkdir(out, { recursive: true });

const palette = { cream: "#fff7ee", pink: "#f7b8bd", coral: "#ef6660", red: "#d94748", brown: "#35140e", caramel: "#b96b35", white: "#ffffff", muted: "#805b50", green: "#3f7755" };
const logo = await loadImage(path.join(root, "public", "site", "logo.webp"));
const hero = await loadImage(path.join(root, "public", "adoce-hoje", "trufado-ninho-morango.webp"));
const packages = await loadImage(path.join(root, "public", "site", "pede-junto-pacotes.webp"));
const places = {
  trabalho: await loadImage(path.join(root, "public", "site", "pede-junto-trabalho.webp")),
  condominio: await loadImage(path.join(root, "public", "site", "pede-junto-condominio.webp")),
  faculdade: await loadImage(path.join(root, "public", "site", "pede-junto-faculdade.webp")),
  clinica: await loadImage(path.join(root, "public", "site", "pede-junto-clinica.webp")),
};

function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fillRounded(ctx, x, y, w, h, r, color) { rounded(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
function cover(ctx, image, x, y, w, h, radius = 0) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale, sh = h / scale, sx = (image.width - sw) / 2, sy = (image.height - sh) / 2;
  ctx.save(); if (radius) { rounded(ctx, x, y, w, h, radius); ctx.clip(); }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h); ctx.restore();
}
function contain(ctx, image, x, y, w, h) {
  const scale = Math.min(w / image.width, h / image.height); const dw = image.width * scale, dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
function brand(ctx, x, y, dark = false) { ctx.drawImage(logo, x, y, 76, 76); ctx.fillStyle = dark ? palette.white : palette.brown; ctx.font = "700 27px Georgia"; ctx.fillText("Adoce Brigaderia", x + 92, y + 47); }
function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const words = text.split(/\s+/); const lines = []; let line = "";
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight)); return Math.min(lines.length, maxLines) * lineHeight;
}
function kicker(ctx, text, x, y, color = palette.coral) { ctx.fillStyle = color; ctx.font = "800 22px Arial"; ctx.letterSpacing = "4px"; ctx.fillText(text.toUpperCase(), x, y); ctx.letterSpacing = "0px"; }
function button(ctx, text, x, y, w) { fillRounded(ctx, x, y, w, 72, 36, palette.coral); ctx.fillStyle = palette.white; ctx.font = "700 24px Arial"; ctx.textAlign = "center"; ctx.fillText(text, x + w / 2, y + 46); ctx.textAlign = "left"; }
async function save(canvas, name) { await writeFile(path.join(out, name), canvas.toBuffer("image/jpeg", 92)); }

async function feedSlide(name, draw) { const c = createCanvas(1080, 1350); const ctx = c.getContext("2d"); ctx.fillStyle = palette.cream; ctx.fillRect(0, 0, c.width, c.height); await draw(ctx); await save(c, name); }

await feedSlide("feed-01-novo-pede-junto.jpg", async (ctx) => {
  cover(ctx, hero, 0, 0, 1080, 590); const grad = ctx.createLinearGradient(0, 250, 0, 610); grad.addColorStop(0, "rgba(53,20,14,0)"); grad.addColorStop(1, palette.brown); ctx.fillStyle = grad; ctx.fillRect(0, 220, 1080, 390);
  brand(ctx, 70, 55, true); kicker(ctx, "A compra em grupo evoluiu", 72, 675); ctx.fillStyle = palette.brown; ctx.font = "600 83px Georgia"; wrap(ctx, "Agora é Pede Junto Adoce.", 70, 790, 940, 88, 3); ctx.fillStyle = palette.muted; ctx.font = "400 31px Arial"; wrap(ctx, "Mais simples, mais justo e muito mais gostoso de compartilhar.", 72, 1070, 820, 43, 3); button(ctx, "Conheça a novidade", 70, 1210, 350);
});

await feedSlide("feed-02-cada-um-paga-o-seu.jpg", async (ctx) => {
  brand(ctx, 70, 55); kicker(ctx, "Sem vaquinha. Sem cobrança.", 70, 190); ctx.fillStyle = palette.brown; ctx.font = "600 82px Georgia"; wrap(ctx, "Cada um escolhe. Cada um paga o seu.", 70, 305, 930, 88, 4);
  fillRounded(ctx, 65, 675, 950, 500, 35, "#f4dfd5"); contain(ctx, packages, 90, 710, 900, 410); ctx.fillStyle = palette.coral; ctx.font = "700 30px Arial"; ctx.fillText("Todo mundo recebe junto.", 70, 1260);
});

await feedSlide("feed-03-entrega-gratis.jpg", async (ctx) => {
  ctx.fillStyle = palette.brown; ctx.fillRect(0, 0, 1080, 1350); brand(ctx, 70, 55, true); kicker(ctx, "O benefício é de verdade", 70, 200, palette.pink); ctx.fillStyle = palette.white; ctx.font = "600 86px Georgia"; wrap(ctx, "5 fatias no mesmo endereço.", 70, 330, 930, 94, 3); ctx.fillStyle = palette.pink; ctx.font = "600 104px Georgia"; wrap(ctx, "Entrega grátis.", 70, 655, 930, 110, 2);
  const xs = [80, 270, 460, 650, 840]; xs.forEach((x, i) => { fillRounded(ctx, x, 965, 150, 150, 75, i === 4 ? palette.coral : "#5d3026"); ctx.fillStyle = palette.white; ctx.font = "700 52px Georgia"; ctx.textAlign = "center"; ctx.fillText(String(i + 1), x + 75, 1060); }); ctx.textAlign = "left"; ctx.fillStyle = palette.white; ctx.font = "400 28px Arial"; ctx.fillText("Fortaleza · consulte a área de atendimento", 70, 1245);
});

await feedSlide("feed-04-grupo-sem-limite.jpg", async (ctx) => {
  brand(ctx, 70, 55); kicker(ctx, "Chegou a cinco? Continue!", 70, 190); ctx.fillStyle = palette.brown; ctx.font = "600 78px Georgia"; wrap(ctx, "A quinta libera. A décima deixa o grupo ainda melhor.", 70, 305, 930, 86, 4);
  const nums = [1,2,3,4,5,6,7,8,9,10]; nums.forEach((n,i) => { const x = 75 + (i%5)*190, y = 745 + Math.floor(i/5)*185; fillRounded(ctx,x,y,145,145,73,n>=5?palette.coral:"#f3d9cd"); ctx.fillStyle=n>=5?palette.white:palette.brown;ctx.font="700 44px Georgia";ctx.textAlign="center";ctx.fillText(String(n),x+72,y+90); }); ctx.textAlign="left"; ctx.fillStyle=palette.coral;ctx.font="700 64px Georgia";ctx.fillText("+ quantas quiser",70,1200);
});

await feedSlide("feed-05-onde-quiser.jpg", async (ctx) => {
  brand(ctx, 65, 45); kicker(ctx, "Cabe em todo lugar", 65, 175); ctx.fillStyle=palette.brown;ctx.font="600 65px Georgia";wrap(ctx,"Chame quem está no mesmo endereço.",65,275,950,72,3);
  const placeLabels={trabalho:"No trabalho",condominio:"No condomínio",faculdade:"Na faculdade",clinica:"Na clínica"}; const entries=Object.entries(places); entries.forEach(([label,image],i)=>{const x=55+(i%2)*495,y=520+Math.floor(i/2)*350;cover(ctx,image,x,y,465,250,24);ctx.fillStyle=palette.brown;ctx.font="700 27px Arial";ctx.textAlign="center";ctx.fillText(placeLabels[label],x+232,y+295);}); ctx.textAlign="left"; button(ctx,"Abra seu Pede Junto",330,1245,420);
});

async function story(name, draw) { const c=createCanvas(1080,1920);const ctx=c.getContext("2d");ctx.fillStyle=palette.cream;ctx.fillRect(0,0,1080,1920);await draw(ctx);await save(c,name); }

await story("story-01-lancamento.jpg", async ctx=>{cover(ctx,hero,0,0,1080,950);const g=ctx.createLinearGradient(0,450,0,1000);g.addColorStop(0,"rgba(53,20,14,0)");g.addColorStop(1,palette.brown);ctx.fillStyle=g;ctx.fillRect(0,420,1080,600);brand(ctx,65,70,true);ctx.fillStyle=palette.cream;ctx.font="600 100px Georgia";wrap(ctx,"O pedido em grupo ficou melhor.",65,1150,950,110,4);ctx.fillStyle=palette.pink;ctx.font="700 55px Arial";ctx.fillText("Agora é Pede Junto Adoce.",65,1650);button(ctx,"Toque para conhecer",65,1760,430);});
await story("story-02-pagamento-individual.jpg", async ctx=>{brand(ctx,65,60);kicker(ctx,"A mudança que vocês pediram",65,220);ctx.fillStyle=palette.brown;ctx.font="600 93px Georgia";wrap(ctx,"Ninguém precisa pagar pelo grupo inteiro.",65,355,950,103,5);contain(ctx,packages,70,850,940,650);fillRounded(ctx,65,1580,950,190,30,palette.brown);ctx.fillStyle=palette.white;ctx.font="700 43px Arial";wrap(ctx,"Cada pessoa escolhe e recebe o próprio link de pagamento.",110,1660,860,55,3);});
await story("story-03-cinco-e-continua.jpg", async ctx=>{ctx.fillStyle=palette.brown;ctx.fillRect(0,0,1080,1920);brand(ctx,65,60,true);kicker(ctx,"Entrega grátis desbloqueada",65,250,palette.pink);ctx.fillStyle=palette.white;ctx.font="600 120px Georgia";wrap(ctx,"5 fatias.",65,430,900,128,2);ctx.fillStyle=palette.pink;wrap(ctx,"E o grupo continua aberto.",65,700,900,128,4);ctx.fillStyle=palette.white;ctx.font="400 38px Arial";wrap(ctx,"Pode entrar a 6ª, a 10ª e quantas mais o condomínio, trabalho, faculdade ou clínica quiser.",65,1330,930,55,6);button(ctx,"Quanto mais, melhor",65,1750,430);});
await story("story-04-como-funciona.jpg", async ctx=>{brand(ctx,65,60);kicker(ctx,"Como funciona",65,220);ctx.fillStyle=palette.brown;ctx.font="600 82px Georgia";ctx.fillText("Pede Junto em 4 passos",65,360);const steps=[["1","Abra a sala e escolha sua fatia"],["2","Compartilhe o link com a turma"],["3","Cada um escolhe e paga o seu"],["4","Com 5, a entrega é grátis"]];steps.forEach(([n,t],i)=>{const y=560+i*285;fillRounded(ctx,65,y,120,120,60,i===3?palette.coral:"#f3d9cd");ctx.fillStyle=i===3?palette.white:palette.brown;ctx.font="700 43px Georgia";ctx.textAlign="center";ctx.fillText(n,125,y+76);ctx.textAlign="left";ctx.fillStyle=palette.brown;ctx.font="700 40px Arial";wrap(ctx,t,225,y+48,760,52,3);});button(ctx,"Bora de fatia?",65,1750,360);});

const square=createCanvas(1080,1080);const sq=square.getContext("2d");sq.fillStyle=palette.cream;sq.fillRect(0,0,1080,1080);brand(sq,60,45);cover(sq,packages,525,185,500,620,30);kicker(sq,"Pede Junto Adoce",60,235);sq.fillStyle=palette.brown;sq.font="600 70px Georgia";wrap(sq,"Cada um paga o seu.",60,365,420,78,4);sq.fillStyle=palette.coral;sq.font="700 46px Arial";wrap(sq,"5 fatias = entrega grátis",60,690,420,58,3);button(sq,"Abra seu grupo",60,925,350);await save(square,"whatsapp-quadrado.jpg");

console.log(`Materiais gerados em ${out}`);
