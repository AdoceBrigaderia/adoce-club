import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WeeklyScheduleDialog from "./WeeklyScheduleDialog";

describe("agenda semanal renderizada", () => {
  it("exibe um sabor antecipado de retirada dentro da modalidade correta", () => {
    const markup = renderToStaticMarkup(
      <WeeklyScheduleDialog
        open
        onClose={vi.fn()}
        today="2026-07-21"
        hours={[
          {
            channel_slug: "online_orders",
            weekday: 3,
            opens_at: "09:00:00",
            closes_at: "22:00:00",
            active: true,
          },
        ]}
        exceptions={[]}
        menuItems={[
          {
            id: "pickup-menu-item",
            service_date: "2026-07-22",
            channel_slug: "online_orders",
            flavor_id: "chocolatudo-supreme",
            quantity_planned: 10,
            quantity_reserved: 0,
            status: "published",
            note: null,
          },
        ]}
        flavors={[
          {
            id: "chocolatudo-supreme",
            name: "Chocolatudo Supreme",
            image: "/adoce-hoje/chocolatudo.webp",
          },
        ]}
      />,
    );

    const pickupCard = markup.indexOf("weekly-channel-card online_orders");
    const flavor = markup.indexOf("Chocolatudo Supreme");
    const stallCard = markup.indexOf("weekly-channel-card in_person");

    expect(pickupCard).toBeGreaterThan(-1);
    expect(flavor).toBeGreaterThan(pickupCard);
    expect(stallCard).toBeGreaterThan(flavor);
    expect(markup).toContain("10 fatias disponíveis");
  });

  it("não libera reserva quando há cardápio sem horário confirmado", () => {
    const markup = renderToStaticMarkup(
      <WeeklyScheduleDialog
        open
        onClose={vi.fn()}
        today="2026-07-21"
        hours={[]}
        exceptions={[]}
        menuItems={[
          {
            id: "pickup-without-hours",
            service_date: "2026-07-22",
            channel_slug: "online_orders",
            flavor_id: "chocolatudo-supreme",
            quantity_planned: 10,
            quantity_reserved: 0,
            status: "published",
            note: null,
          },
        ]}
        flavors={[
          {
            id: "chocolatudo-supreme",
            name: "Chocolatudo Supreme",
            image: "/adoce-hoje/chocolatudo.webp",
          },
        ]}
      />,
    );

    expect(markup).toContain("Horário ainda não confirmado");
    expect(markup).toContain("a reserva será liberada");
    expect(markup).not.toContain("Adicionar uma Chocolatudo Supreme");
  });
});
