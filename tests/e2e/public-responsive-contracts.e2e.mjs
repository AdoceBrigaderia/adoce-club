import { expect, test } from "@playwright/test";

const viewports = [
  { name: "celular-320", width: 320, height: 568, mobile: true, touch: true },
  { name: "celular-360", width: 360, height: 800, mobile: true, touch: true },
  { name: "celular-390", width: 390, height: 844, mobile: true, touch: true },
  { name: "celular-412", width: 412, height: 915, mobile: true, touch: true },
  { name: "celular-430", width: 430, height: 932, mobile: true, touch: true },
  { name: "tablet-768", width: 768, height: 1024, touch: true },
  { name: "tablet-820", width: 820, height: 1180, touch: true },
  { name: "intermediario-900", width: 900, height: 900 },
  { name: "intermediario-960", width: 960, height: 900 },
  { name: "desktop-1280", width: 1280, height: 720 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1536", width: 1536, height: 864 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

const publicRoutes = [
  { hash: "#", heading: /Feito pelas mãos da Beth/i },
  { hash: "#adoce-hoje", heading: /Descubra o que pode adoçar seu dia/i },
  { hash: "#cadastro", heading: /Cadastro simples, rápido e protegido/i },
  { hash: "#clube", heading: /Seu cartão agora é digital/i },
  { hash: "#pede-junto", heading: /Uma fatia custa R\$ 16/i },
  { hash: "#encomendas", heading: /Monte cada camada antes de pedir/i },
  { hash: "#operacao", heading: /Entre sem perder tempo no atendimento/i },
  {
    hash: "#fale-com-a-adoce",
    heading: /Sua experiência ajuda a gente a cuidar melhor/i,
  },
];

const expectedUnauthenticatedConsole = [
  /Failed to load resource: the server responded with a status of 401/i,
  /Sessão não autenticada no smoke responsivo/i,
  /Service Worker registration blocked by Playwright/i,
];

const absoluteUrl = (baseURL, hash) =>
  `${String(baseURL).replace(/\/+$/, "")}/${hash}`;

const overlapArea = (left, right) => {
  if (!left || !right) return 0;
  const width = Math.max(
    0,
    Math.min(left.right, right.right) - Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y),
  );
  return width * height;
};

const assertNoHorizontalOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 2);
};

const assertRectInsideViewport = (rect, viewportWidth) => {
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.x).toBeGreaterThanOrEqual(-1);
  expect(rect.right).toBeLessThanOrEqual(viewportWidth + 1);
};

const visibleRect = async (locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  });

const settleRoute = async (page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => Boolean(document.querySelector("#root")?.firstElementChild),
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
};

const relevantConsoleMessages = (messages) =>
  messages.filter(
    ({ text }) =>
      !expectedUnauthenticatedConsole.some((pattern) => pattern.test(text)),
  );

const assertPublicRoute = async ({
  page,
  baseURL,
  route,
  pageErrors,
  consoleMessages,
}) => {
  pageErrors.length = 0;
  consoleMessages.length = 0;

  await page.goto(absoluteUrl(baseURL, route.hash), {
    waitUntil: "domcontentloaded",
  });
  await settleRoute(page);

  await expect(
    page.getByRole("heading", { name: route.heading }).first(),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Internal Server Error|Vite error|Webpack error/i,
  );
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  const routeGeometry = await page.evaluate(() => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const viewport = document.documentElement.clientWidth;
    const formsOutside = [...document.querySelectorAll("form")]
      .filter(isVisible)
      .map((form) => form.getBoundingClientRect())
      .filter((rect) => rect.x < -2 || rect.right > viewport + 2)
      .map((rect) => ({
        x: rect.x,
        right: rect.right,
        width: rect.width,
        viewport,
      }));
    return { formsOutside };
  });

  expect(routeGeometry.formsOutside).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(relevantConsoleMessages(consoleMessages)).toEqual([]);
};

const measureHomeGeometry = async (page) =>
  page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        right: bounds.right,
        bottom: bounds.bottom,
      };
    };
    const style = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display : null;
    };
    return {
      viewportWidth: document.documentElement.clientWidth,
      brand: rect(".public-header .public-brand"),
      navigation: rect(".public-header nav"),
      navigationDisplay: style(".public-header nav"),
      menu: rect(".public-menu"),
      menuDisplay: style(".public-menu"),
      login: rect(".public-login"),
      title: rect(".brand-hero-copy h1"),
      primaryAction: rect(".brand-hero .public-primary"),
      secondaryAction: rect(".brand-hero .public-secondary"),
      proof: rect(".home-proof-strip"),
      image: rect(".brand-hero-cake img"),
      contactDock: rect(".public-contact-trigger"),
    };
  });

const assertResponsiveNavigation = async (page, geometry, browserName) => {
  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  const usesCollapsedMenu =
    geometry.menuDisplay !== "none" && geometry.menu?.width > 0;

  if (!usesCollapsedMenu) {
    expect(geometry.navigationDisplay).toBe("flex");
    assertRectInsideViewport(geometry.navigation, geometry.viewportWidth);
    assertRectInsideViewport(geometry.login, geometry.viewportWidth);
    return;
  }

  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute(
    "aria-controls",
    "public-primary-navigation",
  );
  await menuButton.click();

  const closeButton = page.getByRole("button", { name: "Fechar menu" });
  await expect(closeButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("link", { name: "Entrar no Clube" }),
  ).toBeVisible();

  const openMenuGeometry = await page
    .getByRole("navigation", { name: "Navegação principal" })
    .evaluate((navigation) => {
      const viewport = document.documentElement.clientWidth;
      return [...navigation.querySelectorAll("a")].map((link) => {
        const rect = link.getBoundingClientRect();
        return {
          text: link.textContent?.trim(),
          width: rect.width,
          height: rect.height,
          x: rect.x,
          right: rect.right,
          viewport,
        };
      });
    });

  for (const link of openMenuGeometry) {
    expect(link.width, link.text).toBeGreaterThanOrEqual(44);
    expect(link.height, link.text).toBeGreaterThanOrEqual(44);
    expect(link.x, link.text).toBeGreaterThanOrEqual(-1);
    expect(link.right, link.text).toBeLessThanOrEqual(link.viewport + 1);
  }

  await closeButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");

  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(closeButton).toHaveAttribute("aria-expanded", "true");
  if (browserName === "webkit") {
    // WebKit follows Safari's default preference that excludes links from
    // sequential Tab focus. Direct focus still verifies that the open menu is
    // keyboard reachable before exercising Escape and focus restoration.
    const firstNavigationLink = page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link")
      .first();
    await firstNavigationLink.focus();
    await expect(firstNavigationLink).toBeFocused();
  } else {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document
          .querySelector("#public-primary-navigation")
          ?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();
};

const measureVisibleHeroTransition = async (page) => {
  const scrollTarget = await page.evaluate(() => {
    const hero = document.querySelector(".brand-hero");
    if (!hero) return 0;
    const bottom = hero.getBoundingClientRect().bottom + window.scrollY;
    return Math.max(0, bottom - window.innerHeight * 0.62);
  });
  await page.evaluate((target) => window.scrollTo(0, target), scrollTarget);
  await page.waitForTimeout(80);

  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const image = document.querySelector(".brand-hero-cake img");
        const hero = document.querySelector(".brand-hero");
        const heading = document.querySelector(".intent-split-head");
        if (!image || !hero || !heading) {
          resolve(null);
          return;
        }
        const observer = new IntersectionObserver(([entry]) => {
          const imageRect = image.getBoundingClientRect();
          const heroRect = hero.getBoundingClientRect();
          const headingRect = heading.getBoundingClientRect();
          const offset = window.scrollY;
          observer.disconnect();
          resolve({
            imageBottom: imageRect.bottom + offset,
            heroBottom: heroRect.bottom + offset,
            visibleImageBottom: entry.intersectionRect.bottom + offset,
            headingTop: headingRect.top + offset,
          });
        });
        observer.observe(image);
      }),
  );
};

test.describe("contratos responsivos do Portal Adoce", () => {
  test.describe.configure({ mode: "parallel" });

  for (const viewport of viewports) {
    test(`${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      browser,
      browserName,
    }, testInfo) => {
      test.setTimeout(90_000);
      const baseURL = testInfo.project.use.baseURL;
      expect(baseURL).toBeTruthy();

      const context = await browser.newContext({
        baseURL,
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile ?? false,
        hasTouch: viewport.touch ?? false,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleMessages = [];

      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (!["error", "warning"].includes(message.type())) return;
        consoleMessages.push({ type: message.type(), text: message.text() });
      });
      await context.route("**/api/**", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Sessão não autenticada no smoke responsivo.",
          }),
        });
      });

      await page.goto(absoluteUrl(baseURL, "#"), {
        waitUntil: "domcontentloaded",
      });
      await settleRoute(page);
      await expect(page).toHaveTitle(/Adoce Brigaderia/i);
      await expect(
        page.getByRole("link", { name: "Adoce Brigaderia — início" }).first(),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const homeGeometry = await measureHomeGeometry(page);
      assertRectInsideViewport(
        homeGeometry.brand,
        homeGeometry.viewportWidth,
      );
      assertRectInsideViewport(
        homeGeometry.title,
        homeGeometry.viewportWidth,
      );
      assertRectInsideViewport(
        homeGeometry.primaryAction,
        homeGeometry.viewportWidth,
      );
      assertRectInsideViewport(
        homeGeometry.secondaryAction,
        homeGeometry.viewportWidth,
      );
      expect(
        overlapArea(homeGeometry.image, homeGeometry.primaryAction),
      ).toBe(0);
      expect(
        overlapArea(homeGeometry.image, homeGeometry.secondaryAction),
      ).toBe(0);
      expect(
        overlapArea(homeGeometry.contactDock, homeGeometry.primaryAction),
      ).toBe(0);
      expect(
        overlapArea(homeGeometry.contactDock, homeGeometry.secondaryAction),
      ).toBe(0);

      await assertResponsiveNavigation(page, homeGeometry, browserName);
      expect(pageErrors).toEqual([]);
      expect(relevantConsoleMessages(consoleMessages)).toEqual([]);

      const primaryAction = page.locator(".brand-hero .public-primary");
      const primaryBox = await primaryAction.boundingBox();
      expect(primaryBox).not.toBeNull();
      await page.mouse.click(
        primaryBox.x + primaryBox.width - 24,
        primaryBox.y + primaryBox.height / 2,
      );
      await expect(page).toHaveURL(/#adoce-hoje$/);

      if (viewport.mobile) {
        await page.goto(absoluteUrl(baseURL, "#"), {
          waitUntil: "domcontentloaded",
        });
        await settleRoute(page);
        const transition = await measureVisibleHeroTransition(page);
        expect(transition).not.toBeNull();
        expect(transition.imageBottom).toBeGreaterThan(
          transition.heroBottom + 24,
        );
        expect(transition.visibleImageBottom).toBeGreaterThan(
          transition.heroBottom + 12,
        );
        expect(transition.headingTop).toBeGreaterThanOrEqual(
          transition.visibleImageBottom + 8,
        );
      }

      for (const route of publicRoutes) {
        await assertPublicRoute({
          page,
          baseURL,
          route,
          pageErrors,
          consoleMessages,
        });
      }

      await context.close();
    });
  }
});
