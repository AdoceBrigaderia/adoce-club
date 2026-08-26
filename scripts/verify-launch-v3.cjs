const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const pageUrl = pathToFileURL(path.resolve("launch-dist/index.html")).href;

  const desktop = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  desktop.on("pageerror", (error) => errors.push("desktop: " + error.message));
  desktop.on("console", (message) => { if (message.type() === "error") errors.push("desktop console: " + message.text()); });
  await desktop.goto(pageUrl, { waitUntil: "networkidle" });
  await desktop.click(".menu-trigger");
  await desktop.waitForTimeout(250);
  if (await desktop.getAttribute(".menu-trigger", "aria-expanded") !== "true") throw new Error("Menu suspenso desktop não abriu");
  if (!await desktop.locator(".dropdown").isVisible()) throw new Error("Conteúdo do menu suspenso desktop não ficou visível");
  const desktopOverflow = await desktop.evaluate(() => { window.scrollTo(100, 0); const moved = window.scrollX > 0; window.scrollTo(0, 0); return moved; });
  if (desktopOverflow) throw new Error("Página desktop possui rolagem horizontal");
  await desktop.screenshot({ path: path.resolve("launch-dist/.qa-v3-desktop.png") });
  await desktop.click(".menu-trigger");
  await desktop.waitForTimeout(250);
  await desktop.click('a[href="#como-funciona"]');
  await desktop.waitForTimeout(350);
  if (!desktop.url().endsWith("#como-funciona")) throw new Error("Navegação por âncora não funcionou");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (error) => errors.push("mobile: " + error.message));
  mobile.on("console", (message) => { if (message.type() === "error") errors.push("mobile console: " + message.text()); });
  await mobile.goto(pageUrl, { waitUntil: "networkidle" });
  const mobileOverflow = await mobile.evaluate(() => { window.scrollTo(100, 0); const moved = window.scrollX > 0; window.scrollTo(0, 0); return moved; });
  if (mobileOverflow) throw new Error("Página mobile possui rolagem horizontal");
  await mobile.screenshot({ path: path.resolve("launch-dist/.qa-v3-mobile.png") });
  await mobile.click(".mobile-toggle");
  if (!await mobile.locator("body").evaluate((element) => element.classList.contains("menu-open"))) throw new Error("Navegação mobile não abriu");
  await mobile.click(".menu-trigger");
  if (!await mobile.locator(".dropdown").isVisible()) throw new Error("Submenu mobile não abriu");
  await mobile.screenshot({ path: path.resolve("launch-dist/.qa-v3-mobile-menu.png") });
  await mobile.keyboard.press("Escape");
  if (await mobile.locator("body").evaluate((element) => element.classList.contains("menu-open"))) throw new Error("Escape não fechou a navegação mobile");

  const compare = `<!doctype html><style>body{margin:0;background:#160a07;color:#fff;font-family:Arial}main{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px}figure{margin:0}figcaption{padding:0 0 8px;font-weight:700}img{display:block;width:100%;height:580px;object-fit:cover;object-position:top;border:1px solid #68463b}</style><main><figure><figcaption>Opção 2 escolhida</figcaption><img src="${pathToFileURL(path.resolve("design-references/landing-opcao-2.png")).href}"></figure><figure><figcaption>Implementação local</figcaption><img src="${pathToFileURL(path.resolve("launch-dist/.qa-v3-desktop.png")).href}"></figure></main>`;
  fs.writeFileSync(path.resolve("launch-dist/.qa-v3-compare.html"), compare);
  const board = await browser.newPage({ viewport: { width: 1800, height: 640 } });
  await board.goto(pathToFileURL(path.resolve("launch-dist/.qa-v3-compare.html")).href, { waitUntil: "load" });
  await board.screenshot({ path: path.resolve("launch-dist/.qa-v3-comparison.png") });

  await browser.close();
  console.log(JSON.stringify({ errors, desktop: "launch-dist/.qa-v3-desktop.png", mobile: "launch-dist/.qa-v3-mobile.png", mobileMenu: "launch-dist/.qa-v3-mobile-menu.png", comparison: "launch-dist/.qa-v3-comparison.png" }, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
