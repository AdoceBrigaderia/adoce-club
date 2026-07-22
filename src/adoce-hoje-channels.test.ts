import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serviceHeadline, serviceState, type BusinessHour } from "./AdoceHoje";

const page = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");
const contentStyles = readFileSync(
  new URL("./adoce-hoje-content.css", import.meta.url),
  "utf8",
);

describe("canais independentes do Adoce Hoje", () => {
  it("não mistura o status da retirada com o da barraquinha", () => {
    expect(page).toContain("Retirada aberta agora");
    expect(page).toContain("Sem retirada neste momento");
    expect(page).toContain("Barraquinha aberta agora");
    expect(page).toContain("Barraquinha fechada hoje");
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

  it("explica se o atendimento ainda vai abrir ou se já encerrou", () => {
    const hours: BusinessHour[] = [
      {
        channel_slug: "online_orders",
        weekday: 2,
        opens_at: "09:00:00",
        closes_at: "22:00:00",
        active: true,
        note: null,
      },
    ];
    const before = serviceState("pickup", hours, [], {
      weekday: 2,
      hour: 8.5,
      date: "2026-07-21",
    });
    const after = serviceState("pickup", hours, [], {
      weekday: 2,
      hour: 22.5,
      date: "2026-07-21",
    });

    expect(serviceHeadline("pickup", before)).toBe("A retirada abre mais tarde");
    expect(before.message).toContain("abre hoje às 09:00");
    expect(serviceHeadline("pickup", after)).toBe("Retirada encerrada hoje");
    expect(after.message).toContain("encerrou o atendimento de hoje às 22:00");
  });

  it("não oferece localização da barraquinha fechada no atalho móvel", () => {
    expect(page).toContain("Ver agenda");
    expect(page).toContain('open ? (');
    expect(page).toContain('setScheduleOpen(true)');
    expect(page).toContain('href={open ? maps : orderLink()}');
    expect(page).toContain("Como chegar à barraquinha");
  });

  it("fala sobre os sabores de forma acolhedora, sem linguagem de sistema", () => {
    expect(page).toContain("Tem um sabor esperando por você");
    expect(page).toContain("Toque no seu favorito e peça pelo WhatsApp.");
    expect(page).not.toContain("sabor sinalizado");
    expect(page).not.toContain("As fotos continuam visíveis");
  });

  it("mostra os sabores antes dos cartões de atendimento e permite pedi-los", () => {
    expect(page.indexOf('className="today-live-showcase"')).toBeLessThan(
      page.indexOf('className="today-service-grid"'),
    );
    expect(page).toContain('href={orderLink(flavor.name)}');
    expect(page).toContain("Sabores disponíveis agora");
  });

  it("preserva o desktop e prioriza os sabores somente no celular", () => {
    expect(contentStyles).toMatch(/\.today-service-grid\s*{\s*order:\s*1;/);
    expect(contentStyles).toMatch(/\.today-live-showcase\s*{\s*order:\s*2;/);
    expect(contentStyles).toContain("@media (max-width: 700px)");
    expect(contentStyles).toMatch(/\.today-live-showcase\s*{\s*order:\s*1;/);
    expect(contentStyles).toMatch(/\.today-service-grid\s*{\s*order:\s*2;/);
    expect(contentStyles).toMatch(/\.today-hero-actions\s*{\s*display:\s*none;/);
  });

  it("leva o contexto para depois das fotos somente no celular", () => {
    expect(page.indexOf('className="today-mobile-context"')).toBeGreaterThan(
      page.indexOf('className="today-live-flavor-grid"'),
    );
    expect(contentStyles).toMatch(/\.today-mobile-context\s*{\s*display:\s*none;/);
    expect(contentStyles).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?\.today-mobile-context\s*{[\s\S]*?display:\s*grid;/,
    );
    expect(contentStyles).toMatch(
      /\.today-hero-copy > \.today-live,[\s\S]*?\.today-hero-copy > \.today-lead\s*{\s*display:\s*none;/,
    );
  });
});
