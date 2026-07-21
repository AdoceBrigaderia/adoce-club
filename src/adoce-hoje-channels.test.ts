import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serviceState, type BusinessHour } from "./AdoceHoje";

const page = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");

describe("canais independentes do Adoce Hoje", () => {
  it("não mistura o status da retirada com o da barraquinha", () => {
    expect(page).toContain("Retirada aberta agora");
    expect(page).toContain("Retirada fechada agora");
    expect(page).toContain("Barraquinha aberta agora");
    expect(page).toContain("Barraquinha fechada agora");
    expect(page).toContain("A barraquinha está fechada, mas os pedidos para retirada funcionam separadamente.");
  });

  it("explica a retirada residencial sem prometer atendimento dentro do local", () => {
    expect(page).toContain("receba seu pacote no portão");
    expect(page).toContain("Retirada no portão da Adoce");
    expect(page).toContain("O local de produção não é aberto à visitação");
    expect(page).not.toContain("Retirada na Fábrica Adoce");
  });

  it("publica as duas ilustrações usadas na comunicação", () => {
    expect(existsSync("public/site/adoce-hoje-retirada-ilustracao.webp")).toBe(true);
    expect(existsSync("public/site/adoce-hoje-barraquinha-ilustracao.webp")).toBe(true);
  });

  it("mantém os atalhos de sabores e atendimento dentro da rota Adoce Hoje", () => {
    expect(page).toContain('scrollToTodaySection("sabores")');
    expect(page).toContain('scrollToTodaySection("atendimento")');
    expect(page).not.toContain('href="#sabores"');
    expect(page).not.toContain('href="#atendimento"');
  });

  it("usa a agenda de pedidos online para calcular a retirada", () => {
    const hours: BusinessHour[] = [
      {
        channel_slug: "store",
        weekday: 2,
        opens_at: "09:00:00",
        closes_at: "10:00:00",
        active: true,
        note: null,
      },
      {
        channel_slug: "online_orders",
        weekday: 2,
        opens_at: "09:00:00",
        closes_at: "22:00:00",
        active: true,
        note: null,
      },
    ];

    expect(
      serviceState("pickup", hours, [], {
        weekday: 2,
        hour: 15,
        date: "2026-07-21",
      }),
    ).toMatchObject({ open: true });
  });

  it("fala sobre os sabores de forma acolhedora, sem linguagem de sistema", () => {
    expect(page).toContain("Tem um sabor esperando por você");
    expect(page).toContain("Escolha o seu favorito e chame a gente para reservar.");
    expect(page).not.toContain("sabor sinalizado");
    expect(page).not.toContain("As fotos continuam visíveis");
  });
});
