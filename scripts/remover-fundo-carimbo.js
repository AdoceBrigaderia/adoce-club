import sharp from 'sharp';
const src='public/assets/carimbo-fatia-source.png',out='public/assets/carimbo-fatia.png';
const image=sharp(src).ensureAlpha();
const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2];const green=g>90&&g>r*1.22&&g>b*1.15;const edge=Math.max(0,Math.min(1,(g-Math.max(r,b)-15)/90));if(green)data[i+3]=Math.round(255*(1-edge));}
await sharp(data,{raw:info}).trim({background:{r:0,g:0,b:0,alpha:0}}).resize(256,256,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(out);
console.log(`Carimbo criado em ${out}`);
