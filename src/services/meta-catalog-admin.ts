import { readBffCsrfToken } from "./bff-auth";

export function metaCatalogRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const csrfToken = readBffCsrfToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}
