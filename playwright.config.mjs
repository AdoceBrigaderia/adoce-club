import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/+$/, "");
const localBaseURL = "http://127.0.0.1:4173";
const localChromiumExecutable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
const chromiumLaunchOptions = localChromiumExecutable
  ? { launchOptions: { executablePath: localChromiumExecutable } }
  : {};
const includeWebKit = process.env.PLAYWRIGHT_WEBKIT === "1";

const smokeProject = (name, use) => ({
  name,
  testIgnore: "**/public-responsive-contracts.e2e.mjs",
  use: {
    ...use,
    ...chromiumLaunchOptions,
  },
});

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: externalBaseURL || localBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
        url: localBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    smokeProject(
      "celular-android",
      {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    ),
    smokeProject(
      "tablet-operacao",
      {
        browserName: "chromium",
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    ),
    smokeProject(
      "computador",
      {
        browserName: "chromium",
        viewport: { width: 1366, height: 768 },
      },
    ),
    {
      name: "responsividade-chromium",
      testMatch: "**/public-responsive-contracts.e2e.mjs",
      use: {
        browserName: "chromium",
        ...chromiumLaunchOptions,
      },
    },
    ...(includeWebKit
      ? [
          {
            name: "responsividade-webkit",
            testMatch: "**/public-responsive-contracts.e2e.mjs",
            use: {
              browserName: "webkit",
            },
          },
        ]
      : []),
  ],
});
