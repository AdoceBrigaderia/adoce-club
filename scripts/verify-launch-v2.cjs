const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const pageUrl = pathToFileURL(path.resolve("launch-dist/index.html")).href;
  for (const [name,width,height] of [["desktop",1536,1024],["mobile",390,844]]) {
    const page = await browser.newPage({ viewport:{width,height} });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(pageUrl,{waitUntil:"load"});
    if(name === "mobile") {
      await page.click(".menu");
      if(!await page.locator("body").evaluate(body=>body.classList.contains("open"))) throw new Error("Menu móvel não abriu");
      await page.click(".overlay");
    }
    await page.screenshot({path:path.resolve("launch-dist/.qa-v2-"+name+".png")});
  }
  const compare=`<!doctype html><style>body{margin:0;background:#23120e;color:white;font-family:Arial}main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}figure{margin:0}figcaption{padding:0 0 8px;font-weight:700}img{display:block;width:100%;height:590px;object-fit:cover;object-position:top;border:1px solid #77564b}</style><main><figure><figcaption>Referência aprovada</figcaption><img src="${pathToFileURL(path.resolve("docs/conceito-documentacao.png")).href}"></figure><figure><figcaption>Nova apresentação local</figcaption><img src="${pathToFileURL(path.resolve("launch-dist/.qa-v2-desktop.png")).href}"></figure></main>`;
  fs.writeFileSync(path.resolve("launch-dist/.qa-compare.html"),compare);
  const board=await browser.newPage({viewport:{width:1800,height:650}});
  await board.goto(pathToFileURL(path.resolve("launch-dist/.qa-compare.html")).href,{waitUntil:"load"});
  await board.screenshot({path:path.resolve("launch-dist/.qa-v2-comparison.png")});
  await browser.close();
  console.log(JSON.stringify({errors,desktop:"launch-dist/.qa-v2-desktop.png",mobile:"launch-dist/.qa-v2-mobile.png",comparison:"launch-dist/.qa-v2-comparison.png"},null,2));
  if(errors.length) process.exitCode=1;
})();
