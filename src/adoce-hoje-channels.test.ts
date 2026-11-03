import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serviceHeadline, serviceState, type BusinessHour } from "./AdoceHoje";

const page = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");
const contentStyles = readFileSync(
  new URL("./adoce-hoje-content.css", import.meta.url),
  "utf8",
);

describe("canais independentes do Adoce Hoje", () => {
  it("não mistura o status da retirada com o do Cantinho da Adoce", () => {
    expect(page).toContain("Retirada aberta agora");
    expect(page).toContain("Sem retirada neste momento");
    expect(page).toContain("Cantinho da Adoce aberto agora");
    expect(page).toContain("Cantinho da Adoce fechado hoje");
    expect(page).toContain("O Cantinho da Adoce está fechado, mas os pedidos para retirada funcionam separadamente.");
  });

  it("explica a retirada residencial sem prometer atendimento dentro do local", () => {
    expect(page).toContain("retire no endereço da Adoce");
    expect(page).toContain("Retirada na Adoce");
    expect(page).toContain("O local de produção não é aberto à visitação");
    expect(page).not.toContain("Retirada na Fábrica Adoce");
  });

  it("publica as duas ilustrações usadas na comunicação", () => {
    expect(existsSync("public/site/adoce-hoje-retirada-ilustracao.webp")).toBe(true);
    expect(existsSync("public/site/adoce-hoje-barraquinha-ilustracao.webp")).toBe(true);
  });

  it("mantém filtros e busca dentro da rota Adoce Hoje", () => {
    expect(page).toContain('className="today-category-filters"');
    expect(page).toContain('className="today-search"');
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
    expect(before.closingLabel).toBeUndefined();
    expect(serviceHeadline("pickup", after)).toBe("Retirada encerrada hoje");
    expect(after.message).toContain("encerrou o atendimento de hoje às 22:00");
    expect(after.closingLabel).toBe("22h");
  });

  it("troca o aviso bloqueante pelo texto exato quando a retirada já encerrou hoje", () => {
    const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
    expect(panel).toContain("Retiradas encerradas por hoje");
    expect(panel).toContain("O horário de retirada de pedidos terminou às {closedTodayLabel}.");
    expect(panel).toContain("Você ainda pode fazer seu pedido para retirada no próximo dia de funcionamento.");
    expect(panel).toContain("Entendi, continuar");
    expect(page).toContain("pickupState.phase === \"finished_today\" && !pickupPaused");
  });

  it("calcula o horário de abertura para o card de confirmação de retirada", () => {
    const hours: BusinessHour[] = [
      {
        channel_slug: "online_orders",
        weekday: 2,
        opens_at: "18:00:00",
        closes_at: "22:00:00",
        active: true,
        note: null,
      },
    ];
    const open = serviceState("pickup", hours, [], {
      weekday: 2,
      hour: 19,
      date: "2026-07-21",
    });
    expect(open).toMatchObject({ open: true, openingLabel: "18h" });
  });

  it("mostra o card de confirmação de retirada (horário + local, lidos de pickup_locations) antes de enviar o pedido", () => {
    const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
    expect(panel).toContain("Antes de finalizar seu pedido");
    expect(panel).toContain("Confira onde e quando retirar seu pedido:");
    expect(panel).toContain("Horário de retirada");
    expect(panel).toContain("A partir das {pickupLocationCard.timeLabel}");
    expect(panel).toContain("{pickupLocationCard.name}");
    expect(panel).toContain("{pickupLocationCard.address}");
    expect(panel).toContain("Entendi, continuar meu pedido");
    expect(panel).toContain("if (pickupLocationCard && !pickupConfirmAcknowledged)");
    expect(page).toContain('from("pickup_locations").select("slug,name,address_text")');
    expect(page).not.toMatch(/const\s+pickupLocationCard\s*=[\s\S]{0,40}["']Adoce (Fábrica|Barraca)["']/);
  });

  it("não oferece localização do Cantinho da Adoce fechado no atalho móvel", () => {
    expect(page).toContain("Sabores da semana");
    expect(page).toContain('open ? (');
    expect(page).toContain('setScheduleOpen(true)');
    expect(page).toContain('href={maps}');
    expect(page).toContain("Como chegar ao Cantinho da Adoce");
  });

  it("deixa os sabores da semana explícitos para o cliente", () => {
    expect(page).toContain('className="today-weekly-link"');
    expect(page).toContain("Veja os próximos sete dias");
    expect(page.match(/Sabores da semana/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("mantém o texto de ação visível em botões e links dos produtos", () => {
    expect(page).toContain("<span>Toque para pedir</span>");
    expect(page).toContain("<span>Avise quando voltar</span>");
    expect(contentStyles).toMatch(/\.today-weekly-link\s*\{/);
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
    expect(page).toContain("openInstantOrder(flavor.id)");
    expect(page).toContain("Toque para pedir");
    expect(page).toContain("Sabores disponíveis hoje");
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
