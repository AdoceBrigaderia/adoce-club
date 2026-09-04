import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// alerta-pedidos.ts (Web Push) e alerta-telegram.ts (Telegram) foram apagadas
// em 2026-09-04: eram acionamento manual, sem `export const config` (ficavam
// publicadas em /.netlify/functions/<nome> sem segredo nem sessão) e liam o
// Postgres direto por fetch cru. order-notification-webhook.ts já cobre o
// aviso de pedido novo, autenticado e orientado a evento. Este teste impede
// que alguém as reintroduza sem saber por que saíram.
describe("avisos de pedido sem função órfã e sem autenticação", () => {
  it.each(["alerta-pedidos", "alerta-telegram"])(
    "%s não volta a existir",
    (name) => {
      const path = fileURLToPath(new URL(`../netlify/functions/${name}.ts`, import.meta.url));
      expect(existsSync(path)).toBe(false);
    },
  );
});
