import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "launch-dist");
fs.mkdirSync(out, { recursive: true });
const assetsOut = path.join(out, "assets");
fs.rmSync(assetsOut, { recursive: true, force: true });
fs.mkdirSync(assetsOut, { recursive: true });
for (const file of fs.readdirSync(out)) {
  if (file.startsWith(".qa-")) fs.rmSync(path.join(out, file), { force: true });
}

const writeWebp = async (source, target, quality, maxWidth = Infinity) => {
  const image = await loadImage(path.join(root, source));
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  fs.writeFileSync(path.join(assetsOut, target), await canvas.encode("webp", quality));
};

await Promise.all([
  writeWebp("public/wallet/brand/logo-transparent.png", "logo.webp", 92, 256),
  writeWebp("hero-cake-transparent.png", "hero-cake.webp", 90),
  writeWebp("hero-chocolate-texture.png", "chocolate-texture.webp", 82),
]);

const logo = "/assets/logo.webp";
const cake = "/assets/hero-cake.webp";
const texture = "/assets/chocolate-texture.webp";

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#1a0c08">
  <meta name="description" content="O Clube Adoce está chegando: recompensas, cartão compartilhado, indicações e novidades da Adoce em um só lugar.">
  <meta property="og:title" content="Clube Adoce — Em breve">
  <meta property="og:description" content="Seu carinho agora também vira conquista.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://adocebrigaderia.com.br/">
  <title>Clube Adoce — Em breve</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
  <style>
    :root{--ink:#1a0c08;--chocolate:#24110b;--cream:#fff7ed;--paper:#fffaf3;--coral:#f06a5f;--coral-dark:#d9544c;--gold:#d4aa54;--muted:#a99185;--brown:#44251b;--line:#eadbce;--green:#66836c;--serif:"Cormorant Garamond",Georgia,serif;--sans:Manrope,"Segoe UI",sans-serif}
    *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:92px;overflow-x:hidden}body{margin:0;min-width:320px;background:var(--paper);color:var(--brown);font-family:var(--sans);line-height:1.55;overflow-x:hidden}body.menu-open{overflow:hidden}a{color:inherit}button{font:inherit}button,a{-webkit-tap-highlight-color:transparent}a:focus-visible,button:focus-visible{outline:3px solid var(--gold);outline-offset:4px}.material-symbols-rounded{font-variation-settings:"FILL" 0,"wght" 400,"GRAD" 0,"opsz" 24}
    .hero{position:relative;z-index:2;min-height:820px;background-color:var(--ink);overflow:visible;background-image:url("${texture}");background-size:680px;color:var(--cream);isolation:isolate}.hero:after{content:"";position:absolute;inset:auto 0 0;height:2px;background:rgba(255,247,237,.18);z-index:1}.nav-shell{position:relative;z-index:20;max-width:1320px;height:112px;margin:0 auto;padding:0 34px;display:flex;align-items:center;gap:28px}.brand{display:flex;align-items:center;gap:14px;text-decoration:none;min-width:max-content}.brand img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 10px 22px rgba(0,0,0,.18))}.brand strong{font:600 28px/1 var(--serif);letter-spacing:-.02em}.nav-links{margin-left:auto;display:flex;align-items:center;gap:38px}.nav-link{position:relative;border:0;background:none;color:#f2e8df;padding:14px 0;font-size:14px;text-decoration:none;cursor:pointer}.nav-link:after{content:"";position:absolute;left:0;right:100%;bottom:7px;height:2px;background:var(--coral);transition:right .28s ease}.nav-link:hover:after,.nav-link.active:after{right:0}.menu-wrap{position:relative}.menu-trigger{display:flex;align-items:center;gap:10px;border:1px solid rgba(255,247,237,.28);border-radius:15px;background:rgba(255,247,237,.04);color:var(--cream);padding:12px 16px;cursor:pointer;transition:background .25s,border-color .25s,transform .25s}.menu-trigger:hover,.menu-trigger[aria-expanded="true"]{background:rgba(255,247,237,.1);border-color:rgba(255,247,237,.48);transform:translateY(-2px)}.menu-trigger .material-symbols-rounded{font-size:21px}.dropdown{position:absolute;right:0;top:calc(100% + 14px);width:270px;padding:12px 18px 13px;border:1px solid rgba(255,247,237,.35);border-radius:19px;background:#2b1710;color:var(--cream);box-shadow:0 22px 55px rgba(0,0,0,.35);opacity:0;visibility:hidden;transform:translateY(-10px) scale(.98);transform-origin:top right;transition:opacity .22s,transform .22s,visibility .22s}.menu-wrap.open .dropdown{opacity:1;visibility:visible;transform:none}.dropdown a{display:flex;align-items:center;gap:13px;padding:14px 4px;border-bottom:1px solid rgba(255,247,237,.12);text-decoration:none;font-size:13px;transition:color .2s,padding-left .2s}.dropdown a:hover{color:var(--coral);padding-left:9px}.dropdown a .material-symbols-rounded{font-size:21px;color:var(--coral)}.dropdown-status{display:flex;align-items:center;gap:10px;padding:14px 4px 2px;color:#d7c5bb;font-size:11px}.dropdown-status i{width:7px;height:7px;border-radius:50%;background:var(--gold)}.mobile-toggle{display:none;margin-left:auto;border:1px solid rgba(255,247,237,.25);border-radius:12px;background:transparent;color:var(--cream);padding:10px 12px;cursor:pointer}.mobile-toggle .material-symbols-rounded{display:block}
    .hero-content{position:relative;z-index:5;max-width:1320px;margin:0 auto;padding:58px 34px 80px;display:grid;grid-template-columns:minmax(430px,.92fr) minmax(480px,1.08fr);align-items:center;min-height:708px}.eyebrow{display:flex;align-items:center;gap:11px;color:#e1cec3;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}.eyebrow i{width:42px;height:1px;background:var(--coral)}.hero-copy{position:relative;z-index:4;align-self:start;padding-top:18px}.hero h1{font:500 clamp(66px,6.4vw,102px)/.91 var(--serif);letter-spacing:-.055em;margin:25px 0 27px;max-width:690px;text-wrap:balance}.hero h1 em{font-weight:500;color:#ffe8db}.hero-lead{max-width:510px;color:#e5d5cc;font-size:17px;line-height:1.7;margin:0}.hero-actions{display:flex;align-items:center;gap:30px;margin-top:38px}.button{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:54px;border-radius:12px;padding:0 25px;text-decoration:none;font-size:13px;font-weight:700;transition:transform .25s,background .25s,box-shadow .25s}.button.primary{background:var(--coral);color:#fff;box-shadow:0 15px 35px rgba(240,106,95,.2)}.button.primary:hover{background:var(--coral-dark);transform:translateY(-3px);box-shadow:0 20px 42px rgba(240,106,95,.3)}.text-link{display:inline-flex;align-items:center;gap:9px;color:var(--cream);font-size:13px;text-decoration:none;border-bottom:1px solid var(--coral);padding:8px 0;transition:gap .2s,color .2s}.text-link:hover{gap:14px;color:#ffd7cc}.cake-stage{position:absolute;z-index:3;right:-55px;bottom:-88px;width:min(61vw,850px);height:690px;pointer-events:none;transform:translate3d(var(--cake-x,0),var(--cake-y,0),0);transition:transform .18s ease-out}.cake-stage img{position:absolute;width:100%;height:auto;right:0;bottom:0;filter:drop-shadow(0 32px 42px rgba(0,0,0,.48));user-select:none}.cake-heart{position:absolute;right:7%;top:20%;color:var(--coral);font-size:92px;transform:rotate(9deg);filter:drop-shadow(0 5px 20px rgba(240,106,95,.18))}.scroll-note{position:absolute;left:34px;bottom:26px;z-index:6;display:flex;align-items:center;gap:12px;color:#cbb5aa;font-size:9px;letter-spacing:.22em;text-transform:uppercase}.scroll-note .material-symbols-rounded{font-size:17px;color:var(--coral);animation:scrollHint 1.8s ease-in-out infinite}@keyframes scrollHint{50%{transform:translateY(6px)}}
    .story{position:relative;z-index:1;background:var(--cream);padding:125px 34px 90px}.story-grid{max-width:1320px;margin:0 auto;display:grid;grid-template-columns:1.15fr .85fr;gap:90px;align-items:end}.kicker{color:var(--coral);font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase}.story h2,.section h2{font:600 clamp(48px,5.4vw,78px)/.94 var(--serif);letter-spacing:-.045em;margin:16px 0 0;color:var(--chocolate)}.story h2 em{color:var(--coral);font-weight:500}.story-copy{border-left:1px solid var(--gold);padding-left:34px;color:#785e52;font-size:16px;line-height:1.75}.story-copy p{margin:0 0 17px}.story-copy a{color:var(--coral-dark);font-weight:700;text-decoration:none}.motion-line{margin-top:68px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden}.motion-track{width:max-content;display:flex;gap:38px;padding:15px 0;color:var(--brown);font:600 24px var(--serif);animation:marquee 26s linear infinite}.motion-track span{display:flex;align-items:center;gap:38px}.motion-track .material-symbols-rounded{font-size:18px;color:var(--coral)}@keyframes marquee{to{transform:translateX(-50%)}}
    .section{padding:105px 34px;background:var(--paper)}.section-inner{max-width:1320px;margin:0 auto}.section-head{display:grid;grid-template-columns:1fr .72fr;gap:80px;align-items:end;margin-bottom:60px}.section-head p{margin:0;color:#7d6458;max-width:490px}.build-list{border-top:1px solid var(--line)}.build-row{display:grid;grid-template-columns:70px .75fr 1.25fr auto;gap:26px;align-items:center;padding:27px 8px;border-bottom:1px solid var(--line);transition:padding-left .25s,background .25s}.build-row:hover{padding-left:18px;background:#fff5ec}.build-row .number{color:var(--coral);font:600 22px var(--serif)}.build-row strong{font:600 26px var(--serif);color:var(--chocolate)}.build-row p{margin:0;color:#80685d;font-size:13px}.tag{color:var(--green);font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;white-space:nowrap}.today{background:var(--chocolate);color:var(--cream);padding:100px 34px;position:relative;overflow:hidden}.today .section-inner{display:grid;grid-template-columns:1fr .9fr;gap:90px;align-items:center}.today h2{color:var(--cream);margin-bottom:22px}.today p{max-width:580px;color:#d8c6bd}.today-list{border-top:1px solid rgba(255,247,237,.18)}.today-row{display:flex;align-items:center;gap:16px;padding:18px 0;border-bottom:1px solid rgba(255,247,237,.18);font-size:14px}.today-row .material-symbols-rounded{color:var(--coral)}.today-row span:last-child{margin-left:auto;color:#cdb8ae;font-size:11px}.honesty{background:var(--cream);padding:75px 34px}.honesty-inner{max-width:1320px;margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:50px;align-items:center;border-top:1px solid var(--line);padding-top:55px}.honesty h3{font:600 38px/1 var(--serif);color:var(--chocolate);margin:0 0 12px}.honesty p{max-width:770px;margin:0;color:#7e675c}.honesty .button{border:1px solid var(--brown);color:var(--brown)}footer{background:var(--ink);background-image:url("${texture}");background-size:680px;color:#d9c7bd;padding:42px 34px}.footer-inner{max-width:1320px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:30px}.footer-inner .brand img{width:48px;height:48px}.footer-inner small{font-size:10px}.reveal{opacity:0;transform:translateY(34px);transition:opacity .75s ease,transform .75s cubic-bezier(.22,.7,.22,1)}.reveal.visible{opacity:1;transform:none}.delay-1{transition-delay:.1s}.delay-2{transition-delay:.2s}.delay-3{transition-delay:.3s}
    @media(max-width:1050px){.nav-links{gap:20px}.hero-content{grid-template-columns:1fr 1fr}.hero h1{font-size:74px}.cake-stage{right:-120px;width:66vw}.section-head{grid-template-columns:1fr}.today .section-inner{gap:45px}}
    @media(max-width:780px){html{scroll-padding-top:78px}.hero{min-height:auto}.nav-shell{height:78px;padding:0 18px}.brand img{width:48px;height:48px}.brand strong{font-size:23px}.nav-links{position:fixed;inset:78px 0 auto;background:var(--ink);background-image:url("${texture}");background-size:540px;padding:24px 22px 32px;display:grid;gap:5px;box-shadow:0 25px 40px rgba(0,0,0,.32);opacity:0;visibility:hidden;transform:translateY(-16px);transition:.25s}.menu-open .nav-links{opacity:1;visibility:visible;transform:none}.nav-link{width:100%;text-align:left;padding:13px 0}.menu-wrap{width:100%}.menu-trigger{width:100%;justify-content:space-between;border-radius:10px;margin-top:4px}.dropdown{position:static;width:100%;margin-top:8px;display:none;opacity:1;visibility:visible;transform:none;box-shadow:none;background:#321a12}.menu-wrap.open .dropdown{display:block}.mobile-toggle{display:block}.hero-content{display:block;min-height:780px;padding:48px 18px 0}.hero-copy{padding:0}.hero h1{font-size:clamp(55px,16vw,76px);max-width:600px}.hero-lead{font-size:15px;max-width:520px}.hero-actions{gap:19px;flex-wrap:wrap;margin-top:30px}.cake-stage{position:absolute;right:-75px;bottom:-35px;width:630px;height:460px}.cake-heart{right:12%;top:9%;font-size:63px}.scroll-note{display:none}.story{padding:100px 18px 70px}.story-grid{grid-template-columns:1fr;gap:38px}.story-copy{padding-left:22px}.section{padding:80px 18px}.section-head{gap:24px;margin-bottom:42px}.build-row{grid-template-columns:42px 1fr auto;gap:13px;padding:22px 0}.build-row p{grid-column:2/4}.today{padding:80px 18px}.today .section-inner{grid-template-columns:1fr}.honesty{padding:65px 18px}.honesty-inner{grid-template-columns:1fr}.footer-inner{align-items:flex-start;flex-direction:column}}
    @media(max-width:520px){.hero-content{min-height:760px}.eyebrow{font-size:9px}.hero h1{font-size:56px;margin-top:20px}.hero-lead{font-size:14px}.button{min-height:50px;padding:0 20px}.cake-stage{width:500px;right:-95px;bottom:-12px;height:370px}.cake-heart{right:17%;font-size:48px}.story{padding-top:78px}.story h2,.section h2{font-size:49px}.story-copy{font-size:14px}.motion-track{font-size:21px}.build-row{grid-template-columns:34px 1fr}.build-row .tag{grid-column:2}.build-row p{grid-column:2}.today-row{font-size:12px}.honesty h3{font-size:32px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{animation:none!important;transition:none!important}.reveal{opacity:1;transform:none}.cake-stage{transform:none!important}}
  </style>
</head>
<body>
  <section class="hero" id="inicio">
    <header class="nav-shell">
      <a class="brand" href="#inicio" aria-label="Clube Adoce, início"><img src="${logo}" alt="Adoce Brigaderia"><strong>Clube Adoce</strong></a>
      <nav class="nav-links" aria-label="Navegação principal">
        <a class="nav-link active" href="#inicio">Experiência</a>
        <a class="nav-link" href="#como-funciona">Como funciona</a>
        <a class="nav-link" href="#adoce-hoje">Adoce Hoje</a>
        <div class="menu-wrap">
          <button class="menu-trigger" type="button" aria-expanded="false" aria-controls="club-menu"><span>Menu</span><span class="material-symbols-rounded" aria-hidden="true">menu</span></button>
          <div class="dropdown" id="club-menu">
            <a href="#carteira"><span class="material-symbols-rounded" aria-hidden="true">account_balance_wallet</span>Carteira digital</a>
            <a href="#grupo"><span class="material-symbols-rounded" aria-hidden="true">group</span>Cartão em Grupo</a>
            <a href="#indicacoes"><span class="material-symbols-rounded" aria-hidden="true">favorite</span>Espalhe Doçura</a>
            <a href="#premios"><span class="material-symbols-rounded" aria-hidden="true">redeem</span>Prêmios</a>
            <div class="dropdown-status"><i></i>Em construção</div>
          </div>
        </div>
      </nav>
      <button class="mobile-toggle" type="button" aria-label="Abrir navegação" aria-expanded="false"><span class="material-symbols-rounded">menu</span></button>
    </header>
    <div class="hero-content">
      <div class="hero-copy reveal visible">
        <div class="eyebrow"><i></i>Uma nova experiência Adoce</div>
        <h1>Seu carinho agora <em>também</em> vira conquista.</h1>
        <p class="hero-lead">O Clube Adoce reunirá recompensas, cartões compartilhados e novidades diárias para deixar tudo ainda mais doce.</p>
        <div class="hero-actions"><a class="button primary" href="#como-funciona">Descobrir o Clube <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a><a class="text-link" href="#andamento">Ver o que está chegando</a></div>
      </div>
      <div class="cake-stage" aria-hidden="true"><img src="${cake}" alt=""><span class="cake-heart material-symbols-rounded">favorite</span></div>
    </div>
    <div class="scroll-note">Role para conhecer <span class="material-symbols-rounded">south</span></div>
  </section>
  <main>
    <section class="story" id="como-funciona">
      <div class="story-grid"><div class="reveal"><span class="kicker">O Clube Adoce</span><h2>Mais que um cartão,<br>um jeito de <em>estar junto.</em></h2></div><div class="story-copy reveal delay-1"><p>O cartão começará na carteira digital do celular. O progresso ficará fácil de acompanhar e cada prêmio poderá ser usado no seu tempo.</p><p>Casais, famílias e amigos também poderão somar conquistas em um mesmo cartão, com segurança e transparência.</p><a href="#andamento">Conhecer cada parte →</a></div></div>
      <div class="motion-line" aria-label="Destaques do Clube Adoce"><div class="motion-track"><span>juntos é mais doce <i class="material-symbols-rounded">favorite</i> prêmios no seu tempo <i class="material-symbols-rounded">redeem</i> sabores do dia <i class="material-symbols-rounded">bakery_dining</i></span><span aria-hidden="true">juntos é mais doce <i class="material-symbols-rounded">favorite</i> prêmios no seu tempo <i class="material-symbols-rounded">redeem</i> sabores do dia <i class="material-symbols-rounded">bakery_dining</i></span></div></div>
    </section>
    <section class="section" id="andamento"><div class="section-inner"><div class="section-head"><div class="reveal"><span class="kicker">Em construção</span><h2>O que está chegando</h2></div><p class="reveal delay-1">Cada recurso será liberado somente quando estiver funcionando de verdade. Esta página apresenta a experiência que estamos construindo.</p></div><div class="build-list">
      <div class="build-row reveal" id="carteira"><span class="number">01</span><strong>Carteira digital</strong><p>Apple Wallet e Google Wallet como acesso principal ao cartão fidelidade.</p><span class="tag">Em construção</span></div>
      <div class="build-row reveal delay-1" id="grupo"><span class="number">02</span><strong>Cartão em Grupo</strong><p>Casais, famílias e amigos acumulando juntos com acessos individuais.</p><span class="tag">Em construção</span></div>
      <div class="build-row reveal delay-2" id="indicacoes"><span class="number">03</span><strong>Espalhe Doçura</strong><p>Indicações confirmadas que premiam quem indicou e quem chegou.</p><span class="tag">Em construção</span></div>
      <div class="build-row reveal delay-3" id="premios"><span class="number">04</span><strong>Prêmios no seu tempo</strong><p>Recompensas guardadas sem interromper o próximo ciclo de carimbos.</p><span class="tag">Em construção</span></div>
    </div></div></section>
    <section class="today" id="adoce-hoje"><div class="section-inner"><div class="reveal"><span class="kicker">Adoce Hoje</span><h2>A vontade começa antes da visita.</h2><p>O Clube Adoce também será o lugar para descobrir sabores disponíveis, horários, atendimento presencial, pedidos e promoções.</p></div><div class="today-list reveal delay-1"><div class="today-row"><span class="material-symbols-rounded">cake</span>Sabores disponíveis<span>Em breve</span></div><div class="today-row"><span class="material-symbols-rounded">schedule</span>Horários e funcionamento<span>Em breve</span></div><div class="today-row"><span class="material-symbols-rounded">shopping_bag</span>Pedidos e encomendas<span>Em breve</span></div><div class="today-row"><span class="material-symbols-rounded">celebration</span>Novidades e promoções<span>Em breve</span></div></div></div></section>
    <section class="honesty"><div class="honesty-inner reveal"><div><h3>Ainda estamos preparando tudo.</h3><p>Cadastro, lançamento de carimbos e resgate de prêmios ainda não estão disponíveis. A abertura oficial será divulgada pelos canais da Adoce.</p></div><a class="button" href="#inicio">Voltar ao início <span class="material-symbols-rounded">north</span></a></div></section>
  </main>
  <footer><div class="footer-inner"><a class="brand" href="#inicio"><img src="${logo}" alt=""><strong>Clube Adoce</strong></a><small>© 2026 Adoce Brigaderia · adocebrigaderia.com.br</small></div></footer>
  <script>
    const body=document.body;
    const menuWrap=document.querySelector('.menu-wrap');
    const menuTrigger=document.querySelector('.menu-trigger');
    const mobileToggle=document.querySelector('.mobile-toggle');
    const navLinks=document.querySelector('.nav-links');
    const setClubMenu=(open)=>{menuWrap.classList.toggle('open',open);menuTrigger.setAttribute('aria-expanded',String(open))};
    menuTrigger.addEventListener('click',(event)=>{event.stopPropagation();setClubMenu(!menuWrap.classList.contains('open'))});
    mobileToggle.addEventListener('click',()=>{const open=!body.classList.contains('menu-open');body.classList.toggle('menu-open',open);mobileToggle.setAttribute('aria-expanded',String(open));mobileToggle.querySelector('.material-symbols-rounded').textContent=open?'close':'menu'});
    document.addEventListener('click',(event)=>{if(!menuWrap.contains(event.target))setClubMenu(false)});
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){setClubMenu(false);body.classList.remove('menu-open');mobileToggle.setAttribute('aria-expanded','false');mobileToggle.querySelector('.material-symbols-rounded').textContent='menu'}});
    navLinks.querySelectorAll('a').forEach((link)=>link.addEventListener('click',()=>{body.classList.remove('menu-open');mobileToggle.setAttribute('aria-expanded','false');mobileToggle.querySelector('.material-symbols-rounded').textContent='menu';setClubMenu(false)}));
    const revealObserver=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}}),{threshold:.15});
    document.querySelectorAll('.reveal:not(.visible)').forEach((item)=>revealObserver.observe(item));
    const sectionObserver=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){document.querySelectorAll('.nav-link').forEach((link)=>link.classList.toggle('active',link.getAttribute('href')==='#'+entry.target.id))}}),{rootMargin:'-35% 0px -55%'});
    ['inicio','como-funciona','adoce-hoje'].forEach((id)=>{const section=document.getElementById(id);if(section)sectionObserver.observe(section)});
    const hero=document.querySelector('.hero');
    const cakeStage=document.querySelector('.cake-stage');
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){hero.addEventListener('pointermove',(event)=>{const x=(event.clientX/window.innerWidth-.5)*14;const y=(event.clientY/window.innerHeight-.5)*10;cakeStage.style.setProperty('--cake-x',x+'px');cakeStage.style.setProperty('--cake-y',y+'px')});hero.addEventListener('pointerleave',()=>{cakeStage.style.setProperty('--cake-x','0px');cakeStage.style.setProperty('--cake-y','0px')})}
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(path.join(out, "_headers"), "/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n");
fs.writeFileSync(path.join(out, "_redirects"), "/* /index.html 200\n");
console.log("Apresentação sensorial do Clube Adoce gerada localmente.");
