import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicPage = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("./WeeklyScheduleDialog.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("./WeeklyMenuAdmin.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260721194324_weekly_service_menu.sql", import.meta.url),
  "utf8",
);

describe("agenda semanal do Festival de Fatias", () => {
  it("transforma o aqui em uma ação que abre a agenda", () => {
    expect(publicPage).toContain("today-inline-link");
    expect(publicPage).toContain("setScheduleOpen(true)");
    expect(publicPage).toContain("WeeklyScheduleDialog");
  });

  it("oferece pedido imediato e solicitação de reserva honesta", () => {
    expect(dialog).toContain("Não precisa esperar a barraquinha.");
    expect(dialog).toContain("Consultar retirada");
    expect(dialog).toContain("A Adoce confirma sua reserva pelo WhatsApp.");
    expect(dialog).toContain("Solicitar minha reserva");
  });

  it("mostra separadamente os sabores antecipados de retirada e da barraquinha", () => {
    expect(dialog).toContain('serviceWindows(date, "online_orders"');
    expect(dialog).toContain('serviceWindows(date, "in_person"');
    expect(dialog).toContain('title: "Pedidos para retirada"');
    expect(dialog).toContain('title: "Barraquinha de rua"');
    expect(dialog).toContain("item.channel_slug === channel");
    expect(dialog).not.toContain(
      'item.channel_slug === "in_person" &&\n        item.status !== "hidden"',
    );
  });

  it("distingue um dia somente com retirada de uma barraquinha sem cardápio publicado", () => {
    expect(dialog).toContain(
      "Neste dia, o atendimento é somente por retirada.",
    );
    expect(dialog).toContain(
      "Escolha suas fatias na opção de retirada acima",
    );
    expect(dialog).toContain(
      'emptyTitle: "O cardápio da barraquinha ainda está ganhando forma."',
    );
    expect(dialog).toContain("!channel.active &&");
  });

  it("diferencia estoque disponível hoje de estoque planejado para datas futuras", () => {
    expect(dialog).toContain("const isToday = selectedDate === today");
    expect(dialog).toContain("fatia estará disponível");
    expect(dialog).toContain("fatias estarão disponíveis");
    expect(dialog).toContain("Disponibilidade prevista para este dia");
  });

  it("permite planejar data, modalidade, sabor e quantidade na operação", () => {
    expect(admin).toContain("Cardápio por dia e atendimento");
    expect(admin).toContain("quantity_planned");
    expect(admin).toContain("in_person");
    expect(admin).toContain("online_orders");
  });

  it("mantém publicação pública somente para leitura e escrita restrita aos gestores", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("weekly_service_menu_anon_read");
    expect(migration).toContain("private.is_manager()");
  });
});
