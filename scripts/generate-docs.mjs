import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");
const manifest = JSON.parse(fs.readFileSync(path.join(docsDir, "documentation-manifest.json"), "utf8"));
const esc = (s = "") => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const inline = (s) => esc(s)
  .replace(new RegExp("\\*\\*([^*]+)\\*\\*", "g"), "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function parse(raw) {
  const front = raw.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
  const meta = {};
  if (front) for (const line of front[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: front ? raw.slice(front[0].length) : raw };
}

function markdown(source, prefix) {
  const lines = source.replace(/^# .+\r?\n/, "").split(/\r?\n/);
  const out = [];
  let i = 0;
  const row = (s) => s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{2,4})\s+(.+)$/);
    if (h) {
      const id = prefix + "-" + slug(h[2]);
      out.push("<h" + h[1].length + ' id="' + id + '">' + inline(h[2]) + '<a class="anchor" href="#' + id + '">#</a></h' + h[1].length + ">");
      i++; continue;
    }
    if (line.startsWith("> ")) {
      const q = [];
      while (i < lines.length && lines[i].startsWith("> ")) q.push(lines[i++].slice(2));
      out.push("<blockquote>" + q.map(inline).join("<br>") + "</blockquote>");
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
      const head = row(line); i += 2; const body = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.push(row(lines[i++]));
      out.push('<div class="table"><table><thead><tr>' + head.map((c) => "<th>" + inline(c) + "</th>").join("") +
        "</tr></thead><tbody>" + body.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    const ul = line.match(/^\s*-\s+(.+)$/), ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol", re = ul ? /^\s*-\s+(.+)$/ : /^\s*\d+\.\s+(.+)$/, items = [];
      while (i < lines.length) { const m = lines[i].match(re); if (!m) break; items.push("<li>" + inline(m[1]) + "</li>"); i++; }
      out.push("<" + tag + ">" + items.join("") + "</" + tag + ">"); continue;
    }
    const p = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{2,4})\s+/.test(lines[i]) && !lines[i].startsWith("> ") && !/^\s*(-|\d+\.)\s+/.test(lines[i]) && !lines[i].includes("|")) p.push(lines[i++].trim());
    out.push("<p>" + inline(p.join(" ")) + "</p>");
  }
  return out.join("\n");
}

function data(filename, mime) {
  const p = path.join(root, filename);
  return fs.existsSync(p) ? "data:" + mime + ";base64," + fs.readFileSync(p).toString("base64") : "";
}

const docs = manifest.files.map((file, index) => {
  const parsed = parse(fs.readFileSync(path.join(docsDir, file), "utf8"));
  const id = "capitulo-" + (index + 1) + "-" + slug(parsed.meta.title || file);
  return { file, id, index, ...parsed, html: markdown(parsed.body, id) };
});
const logo = data("public/wallet/brand/logo-transparent.png", "image/png");
const cake = data("fatia-principal.jpg", "image/jpeg");
const nav = docs.map((d) => `<a class="nav-link" href="#${d.id}"><span>${String(d.index + 1).padStart(2, "0")}</span>${esc(d.meta.title)}</a>`).join("");
const toc = docs.map((d) => `<a href="#${d.id}"><strong>${esc(d.meta.title)}</strong><span>${esc(d.meta.description)}</span></a>`).join("");
const articles = docs.map((d) => `<article class="doc" id="${d.id}"><header><b>${String(d.index + 1).padStart(2, "0")}</b><div><small>${esc(d.meta.status)}</small><h1>${esc(d.meta.title)}</h1><p>${esc(d.meta.description)}</p></div></header><div class="prose">${d.html}</div></article>`).join("");
const sources = docs.map((d) => "<code>" + esc(d.file) + "</code>").join(" · ");

const css = `
:root{--bg:#fff8f2;--paper:#fffdfb;--soft:#f8e8df;--pink:#ce7075;--coral:#e96756;--brown:#3b2018;--dark:#24120d;--muted:#765b51;--line:#ead5c9;--green:#4d765f;--shadow:0 22px 60px rgba(59,32,24,.12);font-family:Inter,"Segoe UI",Arial,sans-serif;color:var(--brown);background:var(--bg)}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:92px}body{margin:0;min-width:320px;background:var(--bg);line-height:1.65}a{color:var(--coral)}button,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid rgba(206,112,117,.4);outline-offset:3px}.sidebar{position:fixed;inset:0 auto 0 0;width:286px;background:linear-gradient(155deg,#3b2018,#21100c 76%);color:#fff;padding:26px 20px;z-index:30;display:flex;flex-direction:column;overflow:auto}.brand{display:flex;align-items:center;gap:12px;padding:0 8px 26px}.brand img{width:58px;height:58px;object-fit:contain}.brand strong{display:block;font:600 23px Georgia,serif}.brand small{display:block;color:#dfc4ba;letter-spacing:.16em;text-transform:uppercase;font-size:9px}.nav{display:grid;gap:4px}.nav-link{color:#f6e8e2;text-decoration:none;border-radius:12px;padding:11px 12px;display:grid;grid-template-columns:28px 1fr;align-items:center;font-size:14px;transition:.2s}.nav-link span{font-size:10px;opacity:.58}.nav-link:hover,.nav-link.active{background:rgba(255,255,255,.1);transform:translateX(2px)}.note{margin-top:auto;padding:17px;border:1px solid rgba(255,255,255,.15);border-radius:15px;background:rgba(255,255,255,.06)}.note p{font-size:12px;color:#dfc4ba;margin:6px 0 0}.shell{margin-left:286px}.top{height:74px;position:sticky;top:0;z-index:20;background:rgba(255,248,242,.9);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 38px;gap:14px}.icon{width:44px;height:44px;border:1px solid var(--line);background:var(--paper);color:var(--brown);border-radius:50%;display:grid;place-items:center}.icon svg{width:19px}.menu{display:none}.search{margin-left:auto;width:min(430px,55vw);height:44px;display:flex;align-items:center;gap:10px;border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:0 15px}.search svg{width:18px}.search input{width:100%;border:0;outline:0;background:transparent;color:inherit}.content{max-width:1100px;margin:auto;padding:54px 48px 90px}.hero{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--paper),var(--soft));border:1px solid var(--line);border-radius:28px;padding:46px 48px;box-shadow:var(--shadow);min-height:340px}.hero-copy{position:relative;z-index:2;max-width:680px}.hero h1{font:500 clamp(42px,5.4vw,72px)/1.02 Georgia,serif;letter-spacing:-.045em;margin:0 0 18px}.hero p{font-size:19px;color:var(--muted)}.meta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.meta span{border-top:1px solid #c99545;padding-top:9px;font-size:12px;color:var(--muted);min-width:130px}.cake{position:absolute;right:-70px;bottom:-95px;width:410px;height:320px;object-fit:cover;border-radius:55% 0 0 0;opacity:.78;mix-blend-mode:multiply;mask-image:linear-gradient(135deg,transparent,#000 30%)}.summary{display:grid;grid-template-columns:repeat(3,1fr);margin-top:22px;border:1px solid var(--line);border-radius:20px;background:var(--paper);overflow:hidden}.summary div{padding:21px 23px;border-right:1px solid var(--line)}.summary div:last-child{border:0}.summary span{display:block;color:var(--muted);font-size:12px}.summary strong{display:block;font:600 24px Georgia,serif;margin-top:5px}.toc{margin:62px 0 84px}.toc h2{font:500 34px Georgia,serif}.toc-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line)}.toc-grid a{display:grid;gap:3px;padding:19px 12px;border-bottom:1px solid var(--line);text-decoration:none;color:var(--brown)}.toc-grid a:nth-child(odd){border-right:1px solid var(--line)}.toc-grid a:hover{background:var(--paper)}.toc-grid span{font-size:13px;color:var(--muted)}.doc{padding:76px 0;border-top:1px solid var(--line)}.doc>header{display:grid;grid-template-columns:72px 1fr;gap:22px;margin-bottom:44px}.doc>header>b{width:58px;height:58px;border-radius:50%;background:var(--brown);color:var(--paper);display:grid;place-items:center;font-family:Georgia,serif}.doc>header small{color:var(--coral);font-weight:700;text-transform:uppercase;letter-spacing:.1em}.doc>header h1{font:500 clamp(36px,4vw,52px)/1.08 Georgia,serif;letter-spacing:-.035em;margin:4px 0}.doc>header p{color:var(--muted);margin:8px 0 0}.prose{max-width:830px;margin-left:94px}.prose h2,.prose h3{font-family:Georgia,serif;line-height:1.2;scroll-margin-top:98px}.prose h2{font-size:30px;margin:54px 0 18px}.prose h3{font-size:22px;margin:36px 0 13px}.anchor{margin-left:8px;text-decoration:none;opacity:0;font:400 16px Inter,sans-serif}.prose h2:hover .anchor,.prose h3:hover .anchor{opacity:.5}.prose p{color:#563f37;margin:0 0 18px}.prose ul,.prose ol{padding-left:23px;margin:0 0 24px}.prose li{padding-left:5px;margin-bottom:7px}.prose li::marker{color:var(--coral);font-weight:700}.prose blockquote{margin:29px 0;padding:21px 24px;border-left:4px solid var(--coral);background:linear-gradient(90deg,var(--soft),transparent);border-radius:0 14px 14px 0}.prose code,.footer code{font:500 .9em ui-monospace,Consolas,monospace;background:var(--soft);padding:.16em .38em;border-radius:5px}.table{overflow:auto;margin:25px 0 34px;border:1px solid var(--line);border-radius:15px;background:var(--paper)}table{width:100%;border-collapse:collapse;min-width:580px;font-size:14px}th{background:var(--brown);color:var(--paper);text-align:left}th,td{padding:13px 15px;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:last-child td{border:0}.empty{display:none;padding:30px;text-align:center;color:var(--muted)}.footer{border-top:1px solid var(--line);padding:34px 0;color:var(--muted);font-size:12px}.hide{display:none}body.dark{--bg:#1d100d;--paper:#2a1712;--soft:#3a2119;--brown:#fff2e9;--muted:#c9aaa0;--line:#4b2d24;color:var(--brown)}body.dark .top{background:rgba(29,16,13,.9)}body.dark .prose p{color:#dfc7be}body.dark .cake{opacity:.35}@media(max-width:920px){.sidebar{transform:translateX(-100%);transition:.25s;width:min(320px,86vw)}body.open .sidebar{transform:none}.overlay{display:none;position:fixed;inset:0;background:rgba(20,8,5,.55);z-index:29}body.open .overlay{display:block}.shell{margin:0}.menu{display:grid}.top{padding:0 18px}.search{width:auto;flex:1}.content{padding:32px 20px 70px}.hero{padding:34px 28px}.cake{opacity:.22}.prose{margin-left:0}}@media(max-width:620px){.top{height:64px}.search input::placeholder{color:transparent}.content{padding:22px 14px 55px}.hero{padding:28px 21px;border-radius:21px;min-height:auto}.hero h1{font-size:40px}.hero p{font-size:16px}.summary{grid-template-columns:1fr}.summary div{border-right:0;border-bottom:1px solid var(--line);padding:17px 19px}.toc{margin:46px 0 60px}.toc-grid{grid-template-columns:1fr}.toc-grid a:nth-child(odd){border-right:0}.doc{padding:56px 2px}.doc>header{grid-template-columns:1fr}.doc>header>b{width:44px;height:44px}.doc>header h1{font-size:34px}.prose h2{font-size:26px}.footer code{display:inline-block;margin:2px}}@media print{.sidebar,.top,.overlay{display:none!important}.shell{margin:0}.content{max-width:none;padding:20px}.doc{break-before:page}.hero{box-shadow:none}.prose{max-width:none}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`;

function runtime(){
  const b=document.body,m=document.querySelector(".menu"),o=document.querySelector(".overlay"),t=document.querySelector(".theme"),q=document.querySelector("#search"),docs=[...document.querySelectorAll(".doc")],links=[...document.querySelectorAll(".nav-link")],empty=document.querySelector(".empty");
  const close=()=>b.classList.remove("open");m.onclick=()=>b.classList.toggle("open");o.onclick=close;links.forEach(a=>a.onclick=close);
  t.onclick=()=>{b.classList.toggle("dark");localStorage.setItem("adoce-doc-theme",b.classList.contains("dark")?"dark":"light")};if(localStorage.getItem("adoce-doc-theme")==="dark")b.classList.add("dark");
  q.oninput=()=>{let n=0,s=q.value.trim().toLocaleLowerCase("pt-BR");docs.forEach(d=>{let ok=!s||d.textContent.toLocaleLowerCase("pt-BR").includes(s);d.classList.toggle("hide",!ok);if(ok)n++});empty.style.display=n?"none":"block"};
  const io=new IntersectionObserver(es=>{const e=es.find(x=>x.isIntersecting);if(e)links.forEach(a=>a.classList.toggle("active",a.hash==="#"+e.target.id))},{rootMargin:"-18% 0px -68% 0px"});docs.forEach(d=>io.observe(d));
}

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#3b2018"><title>${esc(manifest.title)}</title><style>${css}</style></head><body>
<div class="overlay"></div><aside class="sidebar"><div class="brand">${logo?`<img src="${logo}" alt="Adoce">`:""}<div><strong>Clube Adoce</strong><small>Documentação</small></div></div><nav class="nav">${nav}</nav><div class="note"><strong>Material para validação</strong><p>Decisões aprovadas e recomendações estão identificadas no roadmap.</p></div></aside>
<div class="shell"><header class="top"><button class="icon menu" aria-label="Abrir menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="search" type="search" placeholder="Buscar na documentação..."></label><button class="icon theme" aria-label="Alternar tema"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg></button></header>
<main class="content"><section class="hero"><div class="hero-copy"><h1>${esc(manifest.title)}</h1><p>${esc(manifest.subtitle)}</p><div class="meta"><span>Versão ${esc(manifest.version)}</span><span>Atualizado em ${esc(manifest.updatedAt)}</span><span>Fonte oficial: Markdown</span></div></div>${cake?`<img class="cake" src="${cake}" alt="Fatia artesanal da Adoce">`:""}</section>
<section class="summary"><div><span>Progresso atual</span><strong>0 a 13 carimbos</strong></div><div><span>Prêmios disponíveis</span><strong>Acumuláveis</strong></div><div><span>Cartões completados</span><strong>Histórico permanente</strong></div></section>
<section class="toc"><h2>Índice da documentação</h2><div class="toc-grid">${toc}</div></section><div class="empty">Nenhuma seção corresponde à busca.</div>${articles}<footer class="footer"><p><strong>Clube Adoce — documentação consolidada.</strong> Gerada automaticamente a partir de ${sources}.</p><p>Arquivo autocontido para leitura offline e compartilhamento.</p></footer></main></div><script>(${runtime.toString()})();</script></body></html>`;
fs.writeFileSync(path.join(docsDir,"clube-adoce-documentacao.html"),html,"utf8");
console.log("Documentação HTML atualizada.");
