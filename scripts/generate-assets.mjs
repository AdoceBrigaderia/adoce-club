import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root=resolve(process.cwd());
const dirs=["public/wallet/brand","public/wallet/photos","public/wallet/progress/v1","public/wallet/states","public/wallet/apple","public/wallet/google","public/wallet/pwa"];
await Promise.all(dirs.map(d=>mkdir(resolve(root,d),{recursive:true})));
await copyFile(resolve(root,"adoce-logo-oficial-original.jpeg"),resolve(root,"public/wallet/brand/logo-original.jpeg"));
await copyFile(resolve(root,"fatia-principal.jpg"),resolve(root,"public/wallet/photos/fatia-original.jpg"));
await copyFile(resolve(root,"fatia-principal.jpg"),resolve(root,"public/wallet/photos/fatia-hero.jpg"));
await copyFile(resolve(root,"fatia-secundaria.jpg"),resolve(root,"public/wallet/photos/fatia-secondary.jpg"));
const logo=await loadImage(await readFile(resolve(root,"adoce-logo-oficial-original.jpeg")));
const c=createCanvas(logo.width,logo.height),ctx=c.getContext("2d");ctx.drawImage(logo,0,0);const data=ctx.getImageData(0,0,c.width,c.height);
const cx=c.width/2,cy=c.height/2,inner=Math.min(c.width,c.height)*.464,outer=Math.min(c.width,c.height)*.472;
for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,d=Math.hypot(x-cx,y-cy);if(d>=outer)data.data[i+3]=0;else if(d>inner)data.data[i+3]=Math.round(data.data[i+3]*(outer-d)/(outer-inner))}
ctx.clearRect(0,0,c.width,c.height);ctx.putImageData(data,0,0);await writeFile(resolve(root,"public/wallet/brand/logo-transparent.png"),c.toBuffer("image/png"));
for(let count=0;count<=14;count++){const canvas=createCanvas(1120,180),x=canvas.getContext("2d");x.fillStyle="#FFF8F2";x.fillRect(0,0,1120,180);for(let i=0;i<14;i++){const cx=48+i*79,cy=90;x.beginPath();x.arc(cx,cy,30,0,Math.PI*2);x.fillStyle=i<count?"#CE7075":"#FFF8F2";x.fill();x.strokeStyle=i<count?"#CE7075":"#D4A34E";x.lineWidth=3;x.setLineDash(i<count?[]:[7,6]);x.stroke();x.setLineDash([]);x.fillStyle=i<count?"#FFF8F2":"#D4A34E";x.font="30px serif";x.textAlign="center";x.textBaseline="middle";x.fillText("♥",cx,cy+2)}await writeFile(resolve(root,`public/wallet/progress/v1/progress-${String(count).padStart(2,"0")}.png`),canvas.toBuffer("image/png"))}
console.log("Ativos tratados e 15 estados de progresso gerados.");
