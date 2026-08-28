const { chromium } = require("playwright-core");
const path = require("node:path");
const fs = require("node:fs");

const base = process.argv[2] || "http://127.0.0.1:4192";
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = path.resolve("artifacts/homologation-qa");
fs.mkdirSync(output, { recursive: true });

const routes = [
  ["inicio", "#inicio"],
  ["fatias", "#adoce-hoje"],
  ["cardapio-fatias", "#cardapio-fatias"],
  ["tortas", "#encomendas"],
];
const viewports = [
  ["celular-360", { width: 360, height: 800 }],
  ["celular-430", { width: 430, height: 932 }],
  ["tablet-768", { width: 768, height: 1024 }],
  ["desktop-1280", { width: 1280, height: 900 }],
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const report = [];
  try {
    for (const [viewportName, viewport] of viewports) {
      const context = await browser.newContext({ viewport });
      for (const [routeName, hash] of routes) {
        const page = await context.newPage();
        const errors = [];
        const failedResources = [];
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        page.on("pageerror", error => errors.push(error.message));
        page.on("response", response => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });
        await page.goto(`${base}/${hash}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(500);
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          title: document.title,
          heading: document.querySelector("h1")?.textContent?.trim() || "",
        }));
        const file = path.join(output, `${routeName}-${viewportName}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const knownExternalWarnings = failedResources.filter(resource => resource.includes("get_public_order_whatsapp_number"));
        const unknownFailures = failedResources.filter(resource => !resource.includes("get_public_order_whatsapp_number"));
        report.push({ routeName, viewportName, ...dimensions, overflow: dimensions.scrollWidth > dimensions.clientWidth + 1, errors, failedResources, knownExternalWarnings, unknownFailures, file });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  const failures = report.filter(item => item.overflow || item.unknownFailures.length || (!item.failedResources.length && item.errors.length) || !item.heading);
  console.log(JSON.stringify({ captures: report.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})();
