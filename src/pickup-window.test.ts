import { describe, expect, it } from "vitest";
import {
  clockToNumber,
  isPickupTimeAllowed,
  pickupBoundsForDay,
  pickupWindowHint,
  pickupWindowMessage,
  pickupWindowsForDay,
} from "./pickup-window";

const quinta = 4;
const sexta = 5;
const sabado = 6;

const horarios = [
  { channel_slug: "online_orders", weekday: sexta, opens_at: "09:00:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: quinta, opens_at: "19:30:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: sexta, opens_at: "19:30:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: sabado, opens_at: "18:00:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: 3, opens_at: "10:00:00", closes_at: "12:00:00", active: false },
];

describe("janelas de retirada", () => {
  it("usa o horário do Cantinho, não o de reserva online", () => {
    expect(pickupWindowsForDay(horarios, sexta)).toEqual([{ min: "19:30", max: "22:00" }]);
  });

  it("respeita o horário diferente de sábado", () => {
    expect(pickupWindowsForDay(horarios, sabado)).toEqual([{ min: "18:00", max: "22:00" }]);
  });

  it("ignora janelas desativadas", () => {
    expect(pickupWindowsForDay(horarios, 3)).toEqual([]);
  });

  it("recusa o horário que causou o problema real: 14h numa sexta", () => {
    expect(isPickupTimeAllowed("14:00", pickupWindowsForDay(horarios, sexta))).toBe(false);
  });

  it("aceita dentro da janela, incluindo as pontas", () => {
    const j = pickupWindowsForDay(horarios, sexta);
    expect(isPickupTimeAllowed("19:30", j)).toBe(true);
    expect(isPickupTimeAllowed("20:45", j)).toBe(true);
    expect(isPickupTimeAllowed("22:00", j)).toBe(true);
    expect(isPickupTimeAllowed("22:01", j)).toBe(false);
  });
});

describe("duas retiradas no mesmo dia", () => {
  // Fábrica de dia (liberada pela operação) + Cantinho à noite.
  const comFabrica = [
    ...horarios,
    { channel_slug: "factory", weekday: sexta, opens_at: "10:00:00", closes_at: "16:00:00", active: true },
  ];
  const janelas = pickupWindowsForDay(comFabrica, sexta, ["in_person", "factory"]);

  it("mantém as duas faixas separadas, sem juntar", () => {
    expect(janelas).toEqual([
      { min: "10:00", max: "16:00" },
      { min: "19:30", max: "22:00" },
    ]);
  });

  it("aceita horário dentro de qualquer uma das duas", () => {
    expect(isPickupTimeAllowed("11:00", janelas)).toBe(true);
    expect(isPickupTimeAllowed("20:00", janelas)).toBe(true);
  });

  it("RECUSA o vão entre elas — o bug que a versão anterior tinha", () => {
    expect(isPickupTimeAllowed("17:30", janelas)).toBe(false);
    expect(isPickupTimeAllowed("16:30", janelas)).toBe(false);
    expect(isPickupTimeAllowed("19:00", janelas)).toBe(false);
  });

  it("os limites do campo cobrem do primeiro ao último", () => {
    expect(pickupBoundsForDay(janelas)).toEqual({ min: "10:00", max: "22:00" });
  });

  it("fala das duas faixas para o cliente", () => {
    expect(pickupWindowHint(janelas)).toBe("Hoje das 10h00 às 16h00 e 19h30 às 22h00.");
    expect(pickupWindowMessage(janelas)).toContain("10h00 às 16h00 ou 19h30 às 22h00");
  });
});

describe("dados bagunçados", () => {
  it("une faixas que se sobrepõem", () => {
    const dobradas = [
      { channel_slug: "in_person", weekday: sexta, opens_at: "17:00:00", closes_at: "22:00:00", active: true },
      { channel_slug: "in_person", weekday: sexta, opens_at: "19:30:00", closes_at: "23:00:00", active: true },
    ];
    expect(pickupWindowsForDay(dobradas, sexta)).toEqual([{ min: "17:00", max: "23:00" }]);
  });

  it("descarta faixa invertida ou de duração zero", () => {
    const ruins = [
      { channel_slug: "in_person", weekday: sexta, opens_at: "22:00:00", closes_at: "19:00:00", active: true },
      { channel_slug: "in_person", weekday: sexta, opens_at: "20:00:00", closes_at: "20:00:00", active: true },
    ];
    expect(pickupWindowsForDay(ruins, sexta)).toEqual([]);
  });

  it("não bloqueia quando não há janela cadastrada", () => {
    expect(isPickupTimeAllowed("14:00", [])).toBe(true);
    expect(isPickupTimeAllowed("14:00", null)).toBe(true);
  });

  it("recusa horário vazio", () => {
    expect(isPickupTimeAllowed("", pickupWindowsForDay(horarios, sexta))).toBe(false);
  });

  it("converte relógio em número", () => {
    expect(clockToNumber("19:30")).toBe(19.5);
    expect(clockToNumber("22:00:00")).toBe(22);
  });
});
