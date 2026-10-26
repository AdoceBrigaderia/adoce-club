export const PRODUCTION_SITE_ORIGIN = "https://www.adocebrigaderia.com.br";

const allowedOrigins = new Set([
  PRODUCTION_SITE_ORIGIN,
  "https://adocebrigaderia.com.br",
  "https://clube.adocebrigaderia.com.br",
  "https://operacao.adocebrigaderia.com.br",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4182",
  "http://127.0.0.1:4182",
]);

export const isAllowedAppOrigin = (origin: string | null) =>
  !origin || allowedOrigins.has(origin.replace(/\/$/, ""));
