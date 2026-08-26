import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const ORIGIN = "https://www.adocebrigaderia.com.br";
const SPECIAL_SLUGS = new Map([["Trufado de Ninho", "trufado-de-ninho-com-morangos"]]);

function loadLocalEnv(text) {
  return Object.fromEntries(
    text.split(/\r?\n/).flatMap((line) => {
      const clean = line.trim();
      if (!clean || clean.startsWith("#") || !clean.includes("=")) return [];
      const index = clean.indexOf("=");
      return [[clean.slice(0, index), clean.slice(index + 1).replace(/^['\"]|['\"]$/g, "")]];
    }),
  );
}

function slugify(name) {
  return SPECIAL_SLUGS.get(name) || name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  })[char]);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(value)).replace(/[\u00a0\u202f]/g, " ");
}

function fortalezaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function absoluteImage(image) {
  if (!image) return `${ORIGIN}/adoce-hoje/fatia-ilustrativa.webp`;
  return new URL(image, ORIGIN).href;
}

function replaceMeta(html, selector, value) {
  const attribute = selector.startsWith("og:") ? "property" : "name";
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = `<meta ${attribute}="${selector}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function pageHead(baseHtml, { title, description, canonical, image, type = "website", jsonLd }) {
  let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, "description", description);
  html = replaceMeta(html, "og:title", title);
  html = replaceMeta(html, "og:description", description);
  html = replaceMeta(html, "og:url", canonical);
  html = replaceMeta(html, "og:image", image);
  html = replaceMeta(html, "og:image:alt", title);
  html = replaceMeta(html, "og:type", type);
  html = replaceMeta(html, "twitter:title", title);
  html = replaceMeta(html, "twitter:description", description);
  html = replaceMeta(html, "twitter:image", image);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  if (jsonLd) html = html.replace("</head>", `    <script type="application/ld+json">${safeJson(jsonLd)}</script>\n  </head>`);
  return html;
}

async function rest(tableAndQuery, env) {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${tableAndQuery}`, {
      headers: {
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function summariesFromMigration() {
  const sql = await fs.readFile(path.join(ROOT, "supabase/migrations/20260810213000_flavor_summaries.sql"), "utf8");
  return new Map(
    [...sql.matchAll(/\('((?:''|[^'])*)'\s*,\s*'((?:''|[^'])*)'\)/g)]
      .map((match) => [match[1].replaceAll("''", "'"), match[2].replaceAll("''", "'")]),
  );
}

function nextMenuLabel(rows, flavorId) {
  const next = rows.find((row) => row.flavor_id === flavorId)?.service_date;
  if (!next) return null;
  const parsed = new Date(`${next}T12:00:00-03:00`);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Fortaleza" }).format(parsed);
  return `${weekday}, ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" }).format(parsed)}`;
}

function availabilityFor(rows, flavorId) {
  const row = rows.find((item) => item.flavor_id === flavorId);
  if (!row) return null;
  const free = row.quantity_available == null
    ? null
    : Math.max(0, Number(row.quantity_available) - Number(row.quantity_reserved || 0));
  const available = !["sold_out", "unavailable"].includes(row.status) && (free == null || free > 0);
  return { available, free };
}

function openingHoursSpecification(rows) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return rows.filter((row) => row.channel_slug === "in_person" && row.active).map((row) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${days[Number(row.weekday)]}`,
    opens: String(row.opens_at).slice(0, 5),
    closes: String(row.closes_at).slice(0, 5),
  }));
}

async function writePage(route, html) {
  const relative = route.replace(/^\//, "");
  const directory = path.join(DIST, relative);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html, "utf8");
  await fs.writeFile(path.join(DIST, `${relative}.html`), html, "utf8");
}

const envText = await fs.readFile(path.join(ROOT, ".env.local"), "utf8").catch(() => "");
const env = { ...loadLocalEnv(envText), ...process.env };
const today = fortalezaDate();
const baseHtml = await fs.readFile(path.join(DIST, "index.html"), "utf8");
let flavors = await rest("flavors?select=id,name,slug,category,description,short_description,image_path,base_price,active&active=eq.true&order=name", env);
if (!flavors) {
  flavors = await rest("flavors?select=id,name,category,description,short_description,image_path,base_price,active&active=eq.true&order=name", env);
}
const MINIMUM_PUBLIC_FLAVORS = 26;
if (!Array.isArray(flavors) || flavors.length < MINIMUM_PUBLIC_FLAVORS) {
  throw new Error(`SEO exige ao menos ${MINIMUM_PUBLIC_FLAVORS} sabores publicos; a leitura retornou ${Array.isArray(flavors) ? flavors.length : 0}.`);
}

const [liveSummaries, menu, availability, hours] = await Promise.all([
  rest("flavor_summaries?select=flavor_id,resumo", env),
  rest(`weekly_service_menu?select=flavor_id,service_date&service_date=gte.${today}&order=service_date&limit=500`, env),
  rest(`flavor_availability?select=flavor_id,status,quantity_available,quantity_reserved&service_date=eq.${today}`, env),
  rest("business_hours?select=channel_slug,weekday,opens_at,closes_at,active&active=eq.true&order=weekday", env),
]);
const fallbackSummaries = await summariesFromMigration();
const summaryById = new Map((liveSummaries || []).map((row) => [row.flavor_id, row.resumo]));
const slugs = new Set();
const catalog = flavors.map((flavor) => {
  const slug = flavor.slug || slugify(flavor.name);
  if (slugs.has(slug)) throw new Error(`Slug duplicado no catalogo SEO: ${slug}`);
  slugs.add(slug);
  if (!flavor.image_path || flavor.base_price == null) throw new Error(`Sabor sem foto ou preco para SEO: ${flavor.name}`);
  return {
    ...flavor,
    slug,
    resumo: summaryById.get(flavor.id) || fallbackSummaries.get(flavor.name) || flavor.short_description,
    image: absoluteImage(flavor.image_path),
    nextMenu: nextMenuLabel(menu || [], flavor.id),
    availability: availabilityFor(availability || [], flavor.id),
  };
});

const bakeryHours = openingHoursSpecification(hours || []);
let homeHtml = baseHtml.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, (whole, json) => {
  try {
    const data = JSON.parse(json);
    data["@type"] = "Bakery";
    if (bakeryHours.length) data.openingHoursSpecification = bakeryHours;
    return `<script type="application/ld+json">${safeJson(data)}</script>`;
  } catch {
    return whole;
  }
});
await fs.writeFile(path.join(DIST, "index.html"), homeHtml, "utf8");

for (const flavor of catalog) {
  const canonical = `${ORIGIN}/sabores/${flavor.slug}`;
  const description = `${flavor.resumo} Retirada em Fortaleza. ${money(flavor.base_price)} a fatia.`;
  const offer = {
    "@type": "Offer",
    url: canonical,
    priceCurrency: "BRL",
    price: Number(flavor.base_price).toFixed(2),
  };
  if (flavor.availability) {
    offer.availability = flavor.availability.available
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: flavor.name,
    image: [flavor.image],
    description: flavor.resumo,
    brand: { "@type": "Brand", name: "Adoce Brigaderia" },
    offers: offer,
  };
  let html = pageHead(baseHtml, {
    title: `${flavor.name} · Adoce Brigaderia — Fortaleza`,
    description,
    canonical,
    image: flavor.image,
    type: "product",
    jsonLd,
  });
  const availabilityText = flavor.availability
    ? flavor.availability.available
      ? flavor.availability.free == null ? "Disponível hoje" : `${flavor.availability.free} fatias disponíveis hoje`
      : "Sem fatias disponíveis hoje"
    : "Disponibilidade de hoje ainda não publicada";
  const menuText = flavor.nextMenu ? `Próxima saída prevista: ${flavor.nextMenu}.` : "Próxima saída ainda não publicada.";
  const content = `<main class="sabores sab-detalhe" data-seo-static-page>
    <nav class="sab-barra" aria-label="Navegação"><a class="sab-voltar" href="/sabores/">← Nossos sabores</a><a class="sab-atalho" href="/#adoce-hoje">O que tem hoje</a></nav>
    <article class="sab-detalhe-card">
      <div class="sab-detalhe-foto"><img src="${escapeHtml(flavor.image)}" alt="Fatia de ${escapeHtml(flavor.name)}" /></div>
      <div class="sab-detalhe-corpo"><p class="sab-legenda">Fatia artesanal</p><h1>${escapeHtml(flavor.name)}</h1>
        <p class="sab-frase">${escapeHtml(flavor.resumo)}</p>
        <p class="sab-detalhe-preco"><strong>${escapeHtml(money(flavor.base_price))}</strong><span>a fatia</span></p>
        <p class="sab-detalhe-estado">${escapeHtml(availabilityText)}</p><p>${escapeHtml(menuText)}</p>
        <a class="sab-principal" href="/#adoce-hoje">Ver as fatias de hoje</a>
      </div>
    </article>
    <footer class="sab-rodape"><p class="sab-assinatura">Doce feito com afeto, para celebrar cada momento.</p><a class="sab-secundario" href="/#encomendas">Encomendar uma torta</a><a class="sab-secundario" href="/">Voltar ao início</a></footer>
  </main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  await writePage(`/sabores/${flavor.slug}`, html);
}

const catalogContent = `<main class="sabores" data-seo-static-page><nav class="sab-barra"><a class="sab-voltar" href="/">← Início</a><a class="sab-atalho" href="/#adoce-hoje">O que tem hoje</a></nav><header class="sab-capa"><p class="sab-legenda">Nossos sabores</p><h1>${catalog.length} sabores,<em> feitos pelas mãos da Beth.</em></h1></header><ul class="sab-seo-lista">${catalog.map((flavor) => `<li><a href="/sabores/${escapeHtml(flavor.slug)}"><img src="${escapeHtml(flavor.image)}" alt="" loading="lazy"><span><strong>${escapeHtml(flavor.name)}</strong><small>${escapeHtml(money(flavor.base_price))} a fatia</small></span></a></li>`).join("")}</ul><footer class="sab-rodape"><p class="sab-assinatura">Doce feito com afeto, para celebrar cada momento.</p><a class="sab-secundario" href="/">Voltar ao início</a></footer></main>`;
let catalogHtml = pageHead(baseHtml, {
  title: "Nossos sabores · Adoce Brigaderia — Fortaleza",
  description: `Conheça os ${catalog.length} sabores de fatias artesanais da Adoce Brigaderia em Fortaleza.`,
  canonical: `${ORIGIN}/sabores/`,
  image: `${ORIGIN}/adoce-hoje/sabores-hoje.webp`,
});
catalogHtml = catalogHtml.replace('<div id="root"></div>', `<div id="root">${catalogContent}</div>`);
await writePage("/sabores", catalogHtml);

for (const landing of [
  { route: "/encomendas", hash: "#encomendas", title: "Encomendas · Adoce Brigaderia — Fortaleza", description: "Tortas e produtos Adoce para encomendar em Fortaleza." },
  { route: "/festas", hash: "#eventos", title: "Festas · Adoce Brigaderia — Fortaleza", description: "Doces, tortas e experiências Adoce para festas em Fortaleza." },
  { route: "/clube", hash: "#clube", title: "Clube Adoce · Adoce Brigaderia", description: "Conheça o Clube Adoce e sua fatia-presente." },
]) {
  let html = pageHead(baseHtml, { ...landing, canonical: `${ORIGIN}${landing.route}`, image: `${ORIGIN}/site/logo.webp` });
  html = html.replace('<div id="root"></div>', `<div id="root"><main class="seo-landing"><h1>${escapeHtml(landing.title.split(" · ")[0])}</h1><p>${escapeHtml(landing.description)}</p></main></div>`);
  await writePage(landing.route, html);
}

const sitemapUrls = [ORIGIN + "/", ...catalog.map((flavor) => `${ORIGIN}/sabores/${flavor.slug}`), `${ORIGIN}/encomendas`, `${ORIGIN}/festas`, `${ORIGIN}/clube`];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url, index) => `  <url><loc>${url}</loc><changefreq>${index === 0 ? "weekly" : "monthly"}</changefreq><priority>${index === 0 ? "1.0" : "0.8"}</priority></url>`).join("\n")}\n</urlset>\n`;
await fs.writeFile(path.join(DIST, "sitemap.xml"), sitemap, "utf8");
await fs.writeFile(path.join(ROOT, "public/sitemap.xml"), sitemap, "utf8");

console.log(`SEO: ${catalog.length} paginas de sabor e ${sitemapUrls.length} URLs no sitemap.`);
console.log(`SEO: disponibilidade real publicada para ${(availability || []).length} sabores em ${today}.`);
console.log(`SEO: horarios presenciais publicados: ${bakeryHours.length}.`);
