import { Capacitor } from "@capacitor/core";

export const productionApiOrigin = "https://www.adocebrigaderia.com.br";

export function resolveApiRequestUrl(input: RequestInfo | URL, nativePlatform: boolean) {
  if (!nativePlatform || typeof input !== "string" || !input.startsWith("/api/")) {
    return input;
  }

  return new URL(input, productionApiOrigin).toString();
}

export function installNativeApiFetch() {
  if (!Capacitor.isNativePlatform()) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    originalFetch(resolveApiRequestUrl(input, true), init);
}
