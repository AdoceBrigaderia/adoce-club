import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "launch-dist");
fs.mkdirSync(out, { recursive: true });
const data = (file, mime) => "data:" + mime + ";base64," + fs.readFileSync(path.join(root, file)).toString("base64");
const logo = data("public/wallet/brand/logo-transparent.png", "image/png");
const cake = data("fatia-principal.jpg", "image/jpeg");

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
    :root{--cream:#fff8f2;--paper:#fffdfb;--soft:#f7e6dd;--pink:#ce7075;--coral:#e96756;--brown:#3b2018;--muted:#765b51;--line:#ead5c9;--green:#4d765f;--gold:#c99545;--shadow:0 24px 70px rgba(59,32,24,.13);font-family:Inter,"Segoe UI",Arial,sans-serif;color:var(--brown);background:var(--cream)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:320px;background:var(--cream);line-height:1.6}a{color:inherit}a:focus-visible{outline:3px solid rgba(206,112,117,.45);outline-offset:4px}.top{height:88px;display:flex;align-items:center;justify-content:space-between;max-width:1240px;margin:auto;padding:0 28px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none}.brand img{width:58px;height:58px;object-fit:contain}.brand strong{display:block;font:600 23px Georgia,serif}.brand span{display:block;color:var(--pink);font-size:10px;letter-spacing:.16em;text-transform:uppercase}.top nav{display:flex;gap:28px}.top nav a{text-decoration:none;font-size:13px;font-weight:700}.hero{max-width:1240px;min-height:660px;margin:0 auto 50px;border:1px solid var(--line);border-radius:32px;overflow:hidden;background:linear-gradient(135deg,var(--paper),var(--soft));box-shadow:var(--shadow);display:grid;grid-template-columns:1.05fr .95fr}.hero-copy{padding:76px 54px 64px;display:flex;flex-direction:column;justify-content:center}.hero h1{font:500 clamp(52px,6vw,84px)/.98 Georgia,serif;letter-spacing:-.055em;margin:0 0 26px}.hero h1 span{color:var(--pink)}.hero-copy>p{font-size:20px;color:var(--muted);max-width:590px;margin:0}.availability{margin-top:38px;padding:20px 0;border-top:1px solid var(--gold);display:grid;grid-template-columns:auto 1fr;gap:13px;align-items:start;max-width:560px}.availability i{width:11px;height:11px;background:var(--gold);border-radius:50%;margin-top:7px}.availability strong{display:block}.availability small{display:block;color:var(--muted);margin-top:3px;line-height:1.5}.hero-photo{position:relative;min-height:660px;overflow:hidden;border-left:1px solid var(--gold)}.hero-photo img{width:100%;height:100%;object-fit:cover;object-position:center}.hero-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,253,251,.2),transparent 30%);pointer-events:none}.intro,.features,.today,.notice{max-width:1120px;margin-left:auto;margin-right:auto}.intro{padding:90px 28px;display:grid;grid-template-columns:.8fr 1.2fr;gap:100px;align-items:start}.section-title{font:500 clamp(36px,4.2vw,58px)/1.08 Georgia,serif;letter-spacing:-.04em;margin:0}.intro-copy{font-size:19px;color:var(--muted)}.intro-copy p{margin:0 0 22px}.features{padding:20px 28px 100px}.feature{display:grid;grid-template-columns:90px 1fr 1fr;gap:26px;padding:40px 0;border-top:1px solid var(--line);align-items:start}.feature b{font:500 30px Georgia,serif;color:var(--pink)}.feature h3{font:500 30px Georgia,serif;margin:0}.feature p{color:var(--muted);margin:3px 0 0;max-width:520px}.today-wrap{background:var(--brown);color:#fff6f0;margin-top:20px}.today{padding:90px 28px;display:grid;grid-template-columns:1fr 1fr;gap:90px}.today .section-title{color:white}.today p{color:#dec7be;font-size:18px;margin:0 0 20px}.today-list{display:grid}.today-list span{padding:16px 0;border-bottom:1px solid rgba(255,255,255,.14);display:flex;justify-content:space-between;gap:20px}.today-list span:after{content:"em construção";color:#e8aaa9;font-size:11px;text-transform:uppercase;letter-spacing:.1em}.notice{padding:100px 28px;text-align:center}.notice-inner{border:1px solid var(--line);background:var(--paper);border-radius:26px;padding:54px;box-shadow:var(--shadow)}.notice h2{font:500 clamp(36px,4vw,54px)/1.05 Georgia,serif;margin:0 0 18px}.notice p{max-width:720px;margin:0 auto;color:var(--muted);font-size:18px}.notice strong{color:var(--brown)}footer{border-top:1px solid var(--line);max-width:1240px;margin:auto;padding:34px 28px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:12px}footer .brand img{width:45px;height:45px}@media(max-width:860px){.top nav{display:none}.hero{margin:0 16px 36px;grid-template-columns:1fr;min-height:0}.hero-copy{padding:54px 34px}.hero-photo{min-height:430px;border-left:0;border-top:1px solid var(--gold)}.intro{grid-template-columns:1fr;gap:28px;padding:72px 24px}.feature{grid-template-columns:56px 1fr}.feature p{grid-column:2}.today{grid-template-columns:1fr;gap:34px;padding:72px 24px}}@media(max-width:520px){.top{height:76px;padding:0 18px}.brand img{width:48px;height:48px}.hero{border-radius:24px;margin:0 10px 28px}.hero-copy{padding:44px 24px}.hero h1{font-size:50px}.hero-copy>p{font-size:17px}.hero-photo{min-height:340px}.intro{padding:58px 20px}.features{padding:10px 20px 72px}.feature{grid-template-columns:44px 1fr;padding:30px 0;gap:14px}.feature b{font-size:23px}.feature h3{font-size:25px}.today{padding:62px 20px}.notice{padding:68px 14px}.notice-inner{padding:38px 22px}.notice p{font-size:16px}footer{padding:26px 20px;align-items:flex-start;gap:20px;flex-direction:column}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <header class="top">
    <a class="brand" href="#inicio" aria-label="Clube Adoce, início"><img src="${logo}" alt="Adoce Brigaderia"><div><strong>Clube Adoce</strong><span>Em construção</span></div></a>
    <nav aria-label="Navegação principal"><a href="#clube">O Clube</a><a href="#experiencia">A experiência</a><a href="#status">Status</a></nav>
  </header>
  <main id="inicio">
    <section class="hero">
      <div class="hero-copy">
        <h1>O Clube Adoce <span>está chegando.</span></h1>
        <p>Uma experiência digital que começa na carteira e continua todos os dias — criada para aproximar ainda mais você da Adoce.</p>
        <div class="availability"><i aria-hidden="true"></i><div><strong>Estamos construindo a experiência completa.</strong><small>Cadastro, carimbos e resgates ainda não estão disponíveis neste site.</small></div></div>
      </div>
      <div class="hero-photo"><img src="${cake}" alt="Fatia artesanal da Adoce com chocolate e morango"></div>
    </section>
    <section class="intro" id="clube">
      <h2 class="section-title">Mais que um cartão fidelidade.</h2>
      <div class="intro-copy"><p>O Clube Adoce será o nosso espaço digital para reunir carinho, recompensas e as informações que fazem diferença na sua visita.</p><p>Você poderá acompanhar seus cartões, guardar prêmios para usar quando quiser e descobrir o que está acontecendo na Adoce naquele dia.</p></div>
    </section>
    <section class="features" id="experiencia">
      <div class="feature"><b>01</b><h3>Na sua carteira</h3><p>Apple Wallet e Google Wallet serão a forma principal de levar o Clube Adoce com você, com acesso rápido ao cartão e às recompensas.</p></div>
      <div class="feature"><b>02</b><h3>Feito para compartilhar</h3><p>Casais, famílias, amigos e outras formações poderão somar compras no mesmo cartão, sem dividir senha ou perder o histórico de cada pessoa.</p></div>
      <div class="feature"><b>03</b><h3>Prêmios no seu tempo</h3><p>Ao completar 14 carimbos, o prêmio ficará guardado. Você continuará juntando normalmente até decidir o melhor momento para aproveitar.</p></div>
      <div class="feature"><b>04</b><h3>Espalhe Doçura</h3><p>Indicações confirmadas na primeira compra darão um carimbo para o novo cliente e outro para quem indicou, em uma jornada exclusiva de indicações.</p></div>
    </section>
    <div class="today-wrap" id="status">
      <section class="today"><h2 class="section-title">Adoce Hoje, sempre perto.</h2><div><p>O Clube também será o lugar para consultar informações úteis antes de sair de casa.</p><div class="today-list"><span>Sabores disponíveis no dia</span><span>Atendimento presencial</span><span>Pedidos online e encomendas</span><span>Promoções e novidades</span></div></div></section>
    </div>
    <section class="notice"><div class="notice-inner"><h2>Uma novidade de verdade precisa nascer bem feita.</h2><p>Por isso, esta página apresenta o que estamos construindo, mas <strong>ainda não realiza cadastro, lançamento de carimbos ou resgate de prêmios</strong>. Quando o Clube Adoce estiver pronto para uso, divulgaremos a abertura pelos canais oficiais da Adoce.</p></div></section>
  </main>
  <footer><a class="brand" href="#inicio"><img src="${logo}" alt=""><div><strong>Clube Adoce</strong><span>Adoce Brigaderia</span></div></a><span>© 2026 Adoce Brigaderia · adocebrigaderia.com.br</span></footer>
</body>
</html>`;

fs.writeFileSync(path.join(out, "index.html"), html, "utf8");
fs.writeFileSync(path.join(out, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n", "utf8");
fs.writeFileSync(path.join(out, "_redirects"), "https://adocebrigaderia.com.br/* https://www.adocebrigaderia.com.br/:splat 301!\n", "utf8");
console.log("Página oficial de apresentação gerada.");
