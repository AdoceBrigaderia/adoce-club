import { expect, test } from "@playwright/test";

const assertNoHorizontalOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 2);
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Sessão não autenticada no smoke test." }),
    });
  });
});

test("página pública preserva identidade e não estoura a largura", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#", { waitUntil: "networkidle" });

  await expect(page).toHaveTitle(/Adoce Brigaderia/i);
  await expect(
    page.getByRole("link", { name: "Adoce Brigaderia — início" }).first(),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("cadastro mostra apenas aceite legal obrigatório e marketing opcional", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#cadastro", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Cadastro simples, rápido e protegido." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quero fazer parte" })).toBeVisible();

  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(2);
  await expect(checkboxes.nth(0)).not.toBeChecked();
  await expect(checkboxes.nth(0)).toHaveAttribute("required", "");
  await expect(checkboxes.nth(1)).not.toBeChecked();
  await expect(page.getByRole("link", { name: "Termos do Clube" })).toHaveAttribute(
    "href",
    "/#termos",
  );
  await expect(
    page.getByRole("link", { name: "Política de Privacidade" }),
  ).toHaveAttribute("href", "/#privacidade");
  await expect(page.getByRole("button", { name: /Validar meu WhatsApp/i })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("operação abre login BFF legível e adequado ao toque", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#operacao", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Entre sem perder tempo no atendimento." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar na operação" })).toBeVisible();
  await expect(page.getByLabel("Celular com DDD")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();

  const submitHeight = await page
    .getByRole("button", { name: "Entrar na operação" })
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(submitHeight).toBeGreaterThanOrEqual(44);
  await assertNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("rotas reais não carregam módulos de demonstração", async ({ page }) => {
  const loadedScripts = [];
  page.on("response", (response) => {
    const url = response.url();
    if (/\.(?:js|mjs)(?:\?|$)/.test(url)) loadedScripts.push(url);
  });

  await page.goto("/#operacao", { waitUntil: "networkidle" });
  await page.goto("/#cadastro", { waitUntil: "networkidle" });

  expect(loadedScripts.join("\n")).not.toMatch(
    /AccessApp|PilotApp|ProductionRollbackPanel|LegacyPrototype/i,
  );
});
