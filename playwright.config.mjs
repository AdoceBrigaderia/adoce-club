import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/+$/, "");
const localBaseURL = "http://127.0.0.1:4173";

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
    {
      name: "celular-android",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "tablet-operacao",
      use: {
        browserName: "chromium",
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
    {
      name: "computador",
      use: {
        browserName: "chromium",
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
});
