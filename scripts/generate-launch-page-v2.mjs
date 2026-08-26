import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "launch-dist");
fs.mkdirSync(out, { recursive: true });
const data = (file, mime) => "data:" + mime + ";base64," + fs.readFileSync(path.join(root, file)).toString("base64");
const logo = data("public/wallet/brand/logo-transparent.png", "image/png");
const cake = data("fatia-conceito.png", "image/png");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#3b2018">
  <meta name="description" content="O Clube Adoce está chegando: carteira digital, fidelidade compartilhada, indicações e todas as novidades da Adoce em um só lugar.">
  <meta property="og:title" content="Clube Adoce — Em breve">
  <meta property="og:description" content="Uma experiência digital que começa na carteira e continua todos os dias.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://adocebrigaderia.com.br/">
  <title>Clube Adoce — Em breve</title>
  <style>
    :root{--cream:#fffaf5;--paper:#fffdfb;--soft:#f9eee7;--pink:#ce7075;--coral:#ed6658;--brown:#3b2018;--brown2:#25120e;--muted:#745b52;--line:#ead8ce;--green:#4d765f;--gold:#c99b4b;--shadow:0 20px 55px rgba(59,32,24,.1);font-family:Inter,"Segoe UI",Arial,sans-serif;color:var(--brown);background:var(--cream)}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:92px}body{margin:0;min-width:320px;background:var(--cream);line-height:1.55}a{color:inherit}button{font:inherit}a:focus-visible,button:focus-visible{outline:3px solid rgba(237,102,88,.42);outline-offset:3px}.overlay{display:none}.sidebar{position:fixed;inset:0 auto 0 0;width:264px;background:linear-gradient(155deg,var(--brown),var(--brown2) 76%);color:#fff;padding:25px 18px;z-index:30;display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:12px;padding:0 8px 25px;text-decoration:none}.brand img{width:58px;height:58px;object-fit:contain}.brand strong{display:block;font:600 23px Georgia,serif}.brand small{display:block;color:#e2c9bf;letter-spacing:.17em;text-transform:uppercase;font-size:9px;margin-top:2px}.nav{display:grid;gap:3px}.nav a{display:grid;grid-template-columns:28px 1fr;align-items:center;padding:11px 12px;border-radius:11px;text-decoration:none;color:#f2e4de;font-size:13px;transition:.2s}.nav a span{font-size:9px;opacity:.56;letter-spacing:.08em}.nav a:hover,.nav a.active{background:rgba(255,255,255,.1);color:#fff;transform:translateX(2px)}.side-status{margin-top:auto;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);border-radius:15px;padding:17px}.side-status b{display:block;font-family:Georgia,serif}.side-status p{color:#dec8be;font-size:12px;margin:7px 0 14px}.side-status a{display:block;background:var(--coral);color:#fff;text-decoration:none;border-radius:9px;padding:10px 12px;text-align:center;font-size:12px;font-weight:700}.shell{margin-left:264px}.topbar{height:72px;position:sticky;top:0;z-index:20;background:var(--brown2);color:#f7ebe5;display:flex;align-items:center;padding:0 38px;gap:20px}.top-message{height:40px;min-width:390px;border:1px solid rgba(255,255,255,.18);border-radius:999px;display:flex;align-items:center;padding:0 17px;font-size:12px;color:#dcc8c0}.top-message:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--gold);margin-right:10px}.topbar>span{margin-left:auto;font-size:11px;letter-spacing:.05em;color:#d8c0b7}.mobile-brand,.menu{display:none}.main{max-width:1050px;margin:0 auto;padding:48px 44px 78px}.hero h1{font:500 clamp(44px,5vw,66px)/1.03 Georgia,serif;letter-spacing:-.045em;margin:0 0 14px;max-width:850px}.hero>p{font-size:18px;color:var(--muted);margin:0 0 30px;max-width:720px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:16px;background:var(--paper);overflow:hidden;box-shadow:0 10px 35px rgba(59,32,24,.05)}.metric{padding:20px 21px;border-right:1px solid var(--line);display:grid;grid-template-columns:44px 1fr;gap:13px;align-items:center}.metric:last-child{border-right:0}.metric b{width:44px;height:44px;border-radius:50%;background:#fcebe6;color:var(--coral);display:grid;place-items:center;font:600 18px Georgia,serif}.metric:nth-child(3) b{background:#e8f0e9;color:var(--green)}.metric span{display:block;color:var(--muted);font-size:11px}.metric strong{display:block;font:600 20px Georgia,serif;margin-top:2px}.intro{display:grid;grid-template-columns:1fr 360px;gap:44px;align-items:center;padding:62px 0 55px;border-bottom:1px solid var(--line)}.intro h2,.section-title{font:500 31px/1.12 Georgia,serif;margin:0 0 14px}.intro p{color:var(--muted);margin:0 0 17px}.intro ul{padding-left:20px;margin:24px 0 0}.intro li{margin:8px 0;padding-left:5px}.intro li::marker{color:var(--coral)}.photo{height:250px;border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:var(--shadow);position:relative}.photo img{width:100%;height:100%;object-fit:cover}.photo:after{content:"";position:absolute;inset:0;border:8px solid rgba(255,255,255,.28);border-radius:17px;pointer-events:none}.section{padding:52px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:24px}.section-head p{max-width:500px;color:var(--muted);margin:0;font-size:13px}.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.flow-item{border:1px solid var(--line);background:var(--paper);border-radius:13px;padding:17px;min-height:145px}.flow-item:last-child{border-color:#b8cfb9;background:#f8fcf7}.flow-item b{display:block;color:var(--coral);font:600 24px Georgia,serif;margin-bottom:12px}.flow-item:last-child b{color:var(--green)}.flow-item strong{display:block;font-size:13px}.flow-item p{font-size:11px;color:var(--muted);margin:5px 0 0}.features{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--paper)}.feature{display:grid;grid-template-columns:1fr 1.4fr 110px;gap:20px;align-items:center;padding:16px 19px;border-bottom:1px solid var(--line)}.feature:last-child{border:0}.feature strong{font-family:Georgia,serif}.feature p{font-size:12px;color:var(--muted);margin:0}.feature span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--coral);text-align:right}.honesty{margin-top:50px;border:1px solid #f2c9bd;background:linear-gradient(90deg,#fff0ea,#fffaf5);border-radius:14px;padding:22px 24px;display:grid;grid-template-columns:1fr auto;gap:30px;align-items:center}.honesty strong{display:block;font-family:Georgia,serif;font-size:18px}.honesty p{margin:4px 0 0;color:var(--muted);font-size:12px;max-width:700px}.honesty a{background:var(--coral);color:#fff;text-decoration:none;border-radius:9px;padding:11px 18px;font-size:12px;font-weight:700;white-space:nowrap}.footer{padding:28px 0 0;color:var(--muted);font-size:11px;display:flex;justify-content:space-between}.footer a{color:var(--brown);text-decoration:none;font-weight:700}@media(max-width:920px){.sidebar{transform:translateX(-100%);transition:transform .25s;width:min(310px,85vw)}body.open .sidebar{transform:none}.overlay{position:fixed;inset:0;background:rgba(20,8,5,.52);z-index:29}body.open .overlay{display:block}.shell{margin:0}.topbar{padding:0 18px}.top-message,.topbar>span{display:none}.mobile-brand{display:flex;align-items:center;gap:9px;text-decoration:none}.mobile-brand img{width:45px;height:45px;object-fit:contain}.mobile-brand strong{font:600 20px Georgia,serif}.menu{display:block;margin-left:auto;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;border-radius:9px;padding:8px 12px;font-size:12px}.main{padding:38px 22px 64px}.intro{grid-template-columns:1fr 320px;gap:26px}.flow{grid-template-columns:1fr 1fr}}@media(max-width:650px){html{scroll-padding-top:78px}.topbar{height:64px}.main{padding:29px 14px 50px}.hero h1{font-size:40px}.hero>p{font-size:15px}.metrics{grid-template-columns:1fr}.metric{border-right:0;border-bottom:1px solid var(--line);padding:16px 18px}.metric:last-child{border-bottom:0}.intro{grid-template-columns:1fr;padding:45px 0}.photo{height:250px;order:-1}.section{padding:43px 0}.section-head{display:block}.section-head p{margin-top:10px}.flow{grid-template-columns:1fr}.flow-item{min-height:0}.feature{grid-template-columns:1fr auto;gap:7px 14px}.feature p{grid-column:1/3}.honesty{grid-template-columns:1fr;margin-top:40px}.honesty a{text-align:center}.footer{display:grid;gap:7px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  </style>
</head>
<body>
  <div class="overlay" aria-hidden="true"></div>
  <aside class="sidebar" aria-label="Navegação principal">
    <a class="brand" href="#inicio"><img src="${logo}" alt="Adoce Brigaderia"><div><strong>Clube Adoce</strong><small>Em construção</small></div></a>
    <nav class="nav">
      <a class="active" href="#inicio"><span>01</span>Visão geral</a>
      <a href="#clube"><span>02</span>O Clube</a>
      <a href="#carteira"><span>03</span>Carteira digital</a>
      <a href="#grupo"><span>04</span>Cartão em Grupo</a>
      <a href="#indicacoes"><span>05</span>Espalhe Doçura</a>
      <a href="#hoje"><span>06</span>Adoce Hoje</a>
    </nav>
    <div class="side-status"><b>Estamos preparando tudo.</b><p>O Clube Adoce ainda não recebe cadastros, carimbos ou resgates.</p><a href="#andamento">Ver o que vem por aí</a></div>
  </aside>
  <div class="shell">
    <header class="topbar">
      <a class="mobile-brand" href="#inicio"><img src="${logo}" alt=""><strong>Clube Adoce</strong></a>
      <div class="top-message">Uma novidade está sendo preparada com carinho.</div>
      <span>adocebrigaderia.com.br</span>
      <button class="menu" type="button" aria-label="Abrir menu">Menu</button>
    </header>
    <main class="main" id="inicio">
      <section class="hero">
        <h1>Clube Adoce — uma experiência para continuar todos os dias.</h1>
        <p>Mais que um cartão fidelidade: um novo jeito de acompanhar recompensas, dividir conquistas e ficar perto da Adoce.</p>
        <div class="metrics" aria-label="Pilares do Clube Adoce">
          <div class="metric"><b>01</b><div><span>Começa na</span><strong>Carteira digital</strong></div></div>
          <div class="metric"><b>14</b><div><span>A cada ciclo</span><strong>Uma fatia-prêmio</strong></div></div>
          <div class="metric"><b>∞</b><div><span>Sem pressa</span><strong>Prêmios acumuláveis</strong></div></div>
        </div>
      </section>
      <section class="intro" id="clube">
        <div><h2>O que é o Clube Adoce?</h2><p>Será o nosso espaço digital de relacionamento com você. O cartão ficará fácil de acessar, os prêmios poderão ser guardados e as novidades da loja estarão reunidas em um só lugar.</p><ul><li>Progresso claro e histórico permanente.</li><li>Experiência pensada para pessoas e grupos.</li><li>Informações úteis antes de visitar a Adoce.</li></ul></div>
        <div class="photo"><img src="${cake}" alt="Fatia de bolo de chocolate do conceito visual do Clube Adoce"></div>
      </section>
      <section class="section" id="indicacoes">
        <div class="section-head"><h2 class="section-title">Como funcionará o Espalhe Doçura</h2><p>Uma indicação será celebrada quando o novo cliente realizar sua primeira compra elegível.</p></div>
        <div class="flow">
          <div class="flow-item"><b>1</b><strong>Compartilhar</strong><p>O cliente envia seu código pessoal.</p></div>
          <div class="flow-item"><b>2</b><strong>Novo cadastro</strong><p>O amigo entra para o Clube Adoce.</p></div>
          <div class="flow-item"><b>3</b><strong>Primeira compra</strong><p>O código é confirmado no atendimento.</p></div>
          <div class="flow-item"><b>4</b><strong>Carimbo para os dois</strong><p>Cada pessoa recebe seu benefício.</p></div>
        </div>
      </section>
      <section class="section" id="andamento">
        <div class="section-head"><h2 class="section-title">O que estamos construindo</h2><p>Cada parte será liberada somente quando estiver funcionando de verdade.</p></div>
        <div class="features">
          <div class="feature" id="carteira"><strong>Carteira digital</strong><p>Apple Wallet e Google Wallet como acesso principal ao cartão.</p><span>Em construção</span></div>
          <div class="feature" id="grupo"><strong>Cartão em Grupo</strong><p>Casais, famílias e amigos acumulando juntos com acessos individuais.</p><span>Em construção</span></div>
          <div class="feature"><strong>Prêmios no seu tempo</strong><p>Recompensas guardadas sem bloquear o próximo ciclo de carimbos.</p><span>Em construção</span></div>
          <div class="feature" id="hoje"><strong>Adoce Hoje</strong><p>Sabores disponíveis, funcionamento, pedidos, encomendas e promoções.</p><span>Em construção</span></div>
        </div>
      </section>
      <section class="honesty"><div><strong>Esta é uma apresentação do que vem por aí.</strong><p>Cadastro, lançamento de carimbos e resgate de prêmios ainda não estão disponíveis. A abertura oficial será divulgada pelos canais da Adoce.</p></div><a href="#inicio">Conhecer o Clube</a></section>
      <footer class="footer"><span>© 2026 Adoce Brigaderia</span><a href="#inicio">Clube Adoce · Em construção</a></footer>
    </main>
  </div>
  <script>
    const body=document.body,menu=document.querySelector(".menu"),overlay=document.querySelector(".overlay"),links=[...document.querySelectorAll(".nav a")];
    const close=()=>body.classList.remove("open");
    menu.addEventListener("click",()=>body.classList.toggle("open"));
    overlay.addEventListener("click",close);
    links.forEach(link=>link.addEventListener("click",close));
    const sections=[...document.querySelectorAll("main [id]")];
    const observer=new IntersectionObserver(entries=>{const current=entries.find(entry=>entry.isIntersecting);if(!current)return;links.forEach(link=>link.classList.toggle("active",link.hash==="#"+current.target.id))},{rootMargin:"-20% 0px -70% 0px"});
    sections.forEach(section=>observer.observe(section));
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(out, "index.html"), html, "utf8");
fs.writeFileSync(path.join(out, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n", "utf8");
fs.writeFileSync(path.join(out, "_redirects"), "https://adocebrigaderia.com.br/* https://www.adocebrigaderia.com.br/:splat 301!\n", "utf8");
console.log("Nova apresentação do Clube Adoce gerada localmente.");
