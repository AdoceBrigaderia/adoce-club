import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const docsDir = path.join(root, 'Documentacao');
const files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md')).sort();
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const inline = value => escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const output = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => { if (paragraph.length) { output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
  const flushList = () => { if (list.length) { output.push(`<ul>${list.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`); list = []; } };
  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const item = line.match(/^[-*]\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); }
    else if (item) { flushParagraph(); list.push(item[1]); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else paragraph.push(line.trim());
  }
  flushParagraph(); flushList();
  return output.join('\n');
}

const docs = files.map((file, index) => {
  const source = fs.readFileSync(path.join(docsDir, file), 'utf8');
  const title = source.match(/^#\s+(.+)$/m)?.[1] ?? file.replace('.md', '');
  return { file, title, source, id: `doc-${index}`, html: markdownToHtml(source) };
});

const navigation = docs.map(doc => `<a href="#${doc.id}"><span>${doc.file.match(/^\d+/)?.[0] ?? '•'}</span>${escapeHtml(doc.title)}</a>`).join('');
const articles = docs.map(doc => `<article id="${doc.id}" class="doc-card" data-search="${escapeHtml(`${doc.title} ${doc.source}`.toLowerCase())}"><div class="doc-label">${escapeHtml(doc.file)}</div>${doc.html}</article>`).join('\n');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#64231e">
  <title>Adoce Club · Portal da Documentação</title>
  <style>
    .back-panel{position:fixed;z-index:80;right:18px;top:18px;min-height:46px;padding:12px 20px;border:1px solid #fff8;border-radius:24px;color:#fff;background:linear-gradient(#f25499,#df2676);box-shadow:0 6px 15px #42141155;text-decoration:none;font-weight:700}
    :root{font-family:"Segoe UI",Arial,sans-serif;color:#57221d;background:#fff8f4;--brown:#64231e;--pink:#e92f80;--cream:#fff7ed;--gold:#d59b3d;--line:#e4b4a8}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(135deg,rgba(255,247,243,.92),rgba(255,228,237,.84)),radial-gradient(circle at 12% 8%,#fff 0 2px,transparent 3px);background-size:auto,36px 36px}.portal-header{position:relative;overflow:hidden;padding:38px 28px 34px;color:#fff;background:linear-gradient(135deg,#57201c,#7b2e2a);box-shadow:0 7px 25px #42141138}.portal-header:before,.portal-header:after{content:"";position:absolute;width:75%;height:90px;border:2px solid rgba(230,178,85,.45);border-width:2px 0 0;border-radius:50%;transform:rotate(-7deg)}.portal-header:before{right:-15%;top:30px}.portal-header:after{right:-5%;top:65px}.header-inner{position:relative;z-index:2;max-width:1180px;margin:auto;display:flex;align-items:center;gap:20px}.portal-mark{width:74px;height:74px;display:grid;place-items:center;border-radius:50%;color:var(--brown);background:linear-gradient(#fff5e9,#ffdce8);border:3px solid #fff8;box-shadow:0 8px 20px #200a0838;font-family:Georgia,serif;font-weight:700;font-size:24px}.portal-header h1{margin:0;font-family:Georgia,serif;font-style:italic;font-size:40px}.portal-header p{margin:5px 0 0;color:#ffe7ed}.menu-toggle{display:none;margin-left:auto;width:46px;height:46px;border:1px solid #ffffff55;border-radius:12px;color:white;background:#ffffff18;font-size:23px}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);max-width:1380px;margin:auto}.sidebar{position:sticky;top:0;height:100vh;padding:24px 20px;overflow:auto;color:white;background:linear-gradient(180deg,#64231e,#4c1715)}.sidebar label{display:block;margin-bottom:6px;color:#ffdce7;font-size:12px;font-weight:700}.search-wrap{position:relative}.search-wrap input{width:100%;padding:12px 38px 12px 13px;border:1px solid #e4ad65;border-radius:11px;background:#fffaf4;color:var(--brown);outline:none;box-shadow:0 0 0 3px #fff2}.search-wrap span{position:absolute;right:12px;top:10px;color:var(--pink)}.sidebar nav{margin-top:18px}.sidebar nav a{display:flex;align-items:center;gap:9px;padding:9px 8px;border-bottom:1px solid #ffffff16;color:#fff7f2;text-decoration:none;font-size:12px;line-height:1.25}.sidebar nav a:hover,.sidebar nav a.active{border-radius:8px;color:#fff;background:#ffffff12}.sidebar nav a span{width:24px;color:#f3be68;font-weight:700}.sidebar-footer{margin-top:24px;padding:13px;border:1px solid #ffffff25;border-radius:12px;color:#f8dfe6;font-size:11px}.content{min-width:0;padding:28px 34px 70px}.cover{position:relative;overflow:hidden;padding:38px;margin-bottom:22px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(145deg,rgba(255,250,241,.96),rgba(255,230,235,.92));box-shadow:0 12px 30px #5f211a18,inset 0 0 0 4px #fff7}.cover:after{content:"✦  ♡  ✧";position:absolute;right:32px;top:25px;color:var(--gold);font-size:23px}.cover .eyebrow{color:var(--pink);font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:11px}.cover h2{max-width:700px;margin:9px 0;font-family:Georgia,serif;font-size:36px;color:var(--brown)}.cover p{max-width:760px;line-height:1.65}.quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-top:22px}.quick-grid a{min-height:100px;padding:15px;border:1px solid #e5b9ae;border-radius:15px;color:var(--brown);background:#fffaf4;text-decoration:none;box-shadow:0 5px 12px #60241e10}.quick-grid b{display:block;margin-bottom:6px;color:var(--pink)}.quick-grid span{font-size:12px;line-height:1.4}.overview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}.overview-card{padding:18px;border:1px solid var(--line);border-radius:17px;background:var(--cream);box-shadow:0 7px 18px #57211c12}.overview-card h3{margin:0 0 8px;font-family:Georgia,serif;color:var(--brown)}.overview-card p{margin:0;font-size:13px;line-height:1.55}.docs-title{display:flex;align-items:center;gap:11px;margin:30px 0 14px;font-family:Georgia,serif;color:var(--brown)}.docs-title:before,.docs-title:after{content:"";height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--gold),transparent)}.doc-card{scroll-margin-top:18px;margin-bottom:16px;padding:27px 30px;border:1px solid var(--line);border-radius:19px;background:rgba(255,250,244,.94);box-shadow:0 8px 20px #57211c12,inset 0 0 0 3px #fff8;transition:.2s}.doc-card.match{border-color:#e84a8c;box-shadow:0 9px 25px #e43a811e,inset 0 0 0 3px #fff8}.doc-card[hidden]{display:none}.doc-label{color:var(--pink);font-weight:800;font-size:11px}.doc-card h1,.doc-card h2,.doc-card h3{font-family:Georgia,serif;color:var(--brown)}.doc-card h1{font-size:29px;margin:8px 0 16px}.doc-card h2{font-size:21px;margin-top:24px}.doc-card p,.doc-card li{line-height:1.65}.doc-card code{padding:2px 6px;border-radius:5px;background:#fff0e8;color:#8a2b4f}.doc-card li{margin:6px 0}.no-results{display:none;padding:35px;text-align:center;border:1px dashed #d69d91;border-radius:17px;background:#fff7f1}.no-results.show{display:block}.portal-footer{padding:24px;text-align:center;color:#784139;font-size:12px}.top-button{position:fixed;right:22px;bottom:22px;width:46px;height:46px;border:1px solid #c91e68;border-radius:50%;color:#fff;background:linear-gradient(#f25499,#df2676);box-shadow:0 6px 15px #d52a7560}.menu-overlay{display:none}@media(max-width:980px){.quick-grid{grid-template-columns:repeat(2,1fr)}.overview-grid{grid-template-columns:1fr}.layout{grid-template-columns:260px 1fr}.content{padding:22px}}@media(max-width:720px){.portal-header{padding:22px 16px}.portal-mark{width:58px;height:58px;font-size:19px}.portal-header h1{font-size:29px}.portal-header p{font-size:12px}.menu-toggle{display:block}.layout{display:block}.sidebar{position:fixed;z-index:50;left:0;top:0;width:min(86vw,320px);height:100vh;transform:translateX(-105%);transition:.25s;box-shadow:10px 0 30px #280d0b4a}.sidebar.open{transform:translateX(0)}.menu-overlay{position:fixed;z-index:40;inset:0;background:#2f0e0b66}.menu-overlay.show{display:block}.content{padding:16px}.cover{padding:27px 20px}.cover h2{font-size:29px}.quick-grid{grid-template-columns:1fr 1fr}.quick-grid a{min-height:90px;padding:12px}.doc-card{padding:22px 19px}.doc-card h1{font-size:25px}.top-button{right:14px;bottom:14px}}
    @media(max-width:720px){.back-panel{top:auto;right:auto;left:14px;bottom:14px;padding:10px 15px;font-size:12px}}
  </style>
</head>
<body id="topo">
  <a class="back-panel" href="/admin">Voltar ao painel</a>
  <header class="portal-header"><div class="header-inner"><div class="portal-mark">AC</div><div><h1>Adoce Club</h1><p>Portal offline da documentação</p></div><button id="menuToggle" class="menu-toggle" aria-label="Abrir menu" aria-expanded="false">☰</button></div></header>
  <div id="menuOverlay" class="menu-overlay"></div>
  <div class="layout">
    <aside id="sidebar" class="sidebar"><label for="search">Buscar na documentação</label><div class="search-wrap"><input id="search" type="search" placeholder="Ex.: fidelidade, caixa, testes"><span>⌕</span></div><nav aria-label="Índice da documentação">${navigation}</nav><div class="sidebar-footer">Documentação local e privada.<br>Funciona sem internet.</div></aside>
    <main class="content">
      <section class="cover"><div class="eyebrow">Documentação oficial · MVP</div><h2>O guia completo do Adoce Club</h2><p>Regras, fluxos, arquitetura e operação da experiência digital de fidelidade da Adoce Brigaderia, organizada para consulta offline.</p><div class="quick-grid"><a href="#doc-0"><b>Visão Geral</b><span>Conheça o produto e seus objetivos.</span></a><a href="#doc-8"><b>Modelo do Banco</b><span>Estrutura preparada para Supabase.</span></a><a href="#doc-10"><b>Como testar</b><span>Instalação e validação local.</span></a><a href="#doc-12"><b>Roadmap</b><span>Fases atuais e evolução planejada.</span></a></div></section>
      <section class="overview-grid" aria-label="Estado e referências"><article class="overview-card"><h3>Referências Visuais</h3><p>Conceitos aprovados, cartão físico, logo original e análise comparativa estão em <code>referencias/</code> e nesta documentação.</p></article><article class="overview-card"><h3>Estado Atual</h3><p>PWA funcional com estado demonstrativo local, caixa, vendas, QR, fidelidade, família, indicação e relatórios.</p></article><article class="overview-card"><h3>Como testar</h3><p>Execute <code>npm run dev</code>. Para aceite técnico, use lint, build e Playwright conforme o guia local.</p></article></section>
      <h2 class="docs-title">Índice completo</h2>
      <div id="noResults" class="no-results"><b>Nenhum resultado encontrado.</b><p>Tente outra palavra ou limpe a busca.</p></div>
      <section id="documents" aria-label="Documentos do projeto">${articles}</section>
    </main>
  </div>
  <footer class="portal-footer">Adoce Club · Documentação offline privada · Adoce Brigaderia</footer>
  <button class="top-button" aria-label="Voltar ao topo" onclick="location.hash='topo'">↑</button>
  <script>
    const search=document.getElementById('search');const cards=[...document.querySelectorAll('.doc-card')];const noResults=document.getElementById('noResults');const normalize=value=>value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
    search.addEventListener('input',()=>{const term=normalize(search.value.trim());let visible=0;cards.forEach(card=>{const match=!term||normalize(card.dataset.search).includes(term);card.hidden=!match;card.classList.toggle('match',Boolean(term&&match));if(match)visible++});noResults.classList.toggle('show',visible===0)});
    const sidebar=document.getElementById('sidebar');const toggle=document.getElementById('menuToggle');const overlay=document.getElementById('menuOverlay');const setMenu=open=>{sidebar.classList.toggle('open',open);overlay.classList.toggle('show',open);toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰'};toggle.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));overlay.addEventListener('click',()=>setMenu(false));sidebar.addEventListener('click',event=>{if(event.target.closest('a')&&innerWidth<=720)setMenu(false)});
  </script>
</body>
</html>`;

for (const destination of [path.join(docsDir, 'Portal', 'index.html'), path.join(root, 'public', 'documentacao', 'index.html')]) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
}
console.log('Portal premium gerado para uso offline e para o build do PWA.');
