import { expect, test } from "@playwright/test";

const assertNoHorizontalOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 2);
};

const assertTouchTarget = async (locator) => {
  const box = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
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
  const validateWhatsApp = page.getByRole("button", {
    name: /Validar meu WhatsApp/i,
  });
  await expect(validateWhatsApp).toBeVisible();
  await assertTouchTarget(validateWhatsApp);
  await assertNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("cliente encontra login BFF, senha e acesso biométrico em tela touch", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#entrar", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Seu Clube Adoce sempre à mão." }),
  ).toBeVisible();
  await expect(page.getByLabel("WhatsApp com DDD")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  const submit = page.getByRole("button", { name: "Entrar no Clube" });
  await expect(submit).toBeVisible();
  await assertTouchTarget(submit);
  await expect(page.getByText(/biometria|chave de acesso/i).first()).toBeVisible();
  await assertNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("Pede Junto abre com proposta clara e ações adequadas ao toque", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/#pede-junto", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: /Uma fatia custa R\$ 16/i }),
  ).toBeVisible();
  await expect(page.getByText("5 fatias = entrega grátis")).toBeVisible();
  const createGroup = page.getByRole("button", {
    name: /Começar com a minha fatia/i,
  });
  const enterInvite = page.getByRole("button", { name: /Entrar pelo convite/i });
  await expect(createGroup).toBeVisible();
  await expect(enterInvite).toBeVisible();
  await assertTouchTarget(createGroup);
  await assertTouchTarget(enterInvite);
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
  await expect(page.getByLabel("Celular com DDD")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  const submit = page.getByRole("button", { name: "Entrar na operação" });
  await expect(submit).toBeVisible();
  await assertTouchTarget(submit);
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
