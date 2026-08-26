import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readFunction = (name: string) =>
  readFileSync(new URL(`../netlify/functions/${name}.ts`, import.meta.url), "utf8");

describe("alertas operacionais sem polling recorrente", () => {
  it.each(["alerta-pedidos", "alerta-telegram"])(
    "%s nao volta a executar a cada minuto",
    (name) => {
      const source = readFunction(name);

      expect(source).not.toContain('schedule: "* * * * *"');
      expect(source).not.toMatch(/export const config\s*=\s*\{[^}]*schedule/s);
    },
  );
});
