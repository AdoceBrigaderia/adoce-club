import { describe, expect, it } from "vitest";
import {
  clockToNumber,
  isPickupTimeAllowed,
  pickupWindowForDay,
  pickupWindowHint,
  pickupWindowMessage,
} from "./pickup-window";

const sexta = 5;
const sabado = 6;

const horarios = [
  { channel_slug: "online_orders", weekday: sexta, opens_at: "09:00:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: sexta, opens_at: "19:30:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: sabado, opens_at: "18:00:00", closes_at: "22:00:00", active: true },
  { channel_slug: "in_person", weekday: 3, opens_at: "10:00:00", closes_at: "12:00:00", active: false },
];

describe("janela de retirada", () => {
  it("usa o horario do Cantinho, nao o de reserva online", () => {
    expect(pickupWindowForDay(horarios, sexta)).toEqual({ min: "19:30", max: "22:00" });
  });

  it("respeita o horario diferente de sabado", () => {
    expect(pickupWindowForDay(horarios, sabado)).toEqual({ min: "18:00", max: "22:00" });
  });

  it("ignora janelas desativadas", () => {
    expect(pickupWindowForDay(horarios, 3)).toBeNull();
  });

  it("cobre do primeiro ao ultimo quando ha retirada de dia e de noite", () => {
    const comFabrica = [
      ...horarios,
      { channel_slug: "factory", weekday: sexta, opens_at: "10:00:00", closes_at: "16:00:00", active: true },
    ];
    expect(pickupWindowForDay(comFabrica, sexta, ["in_person", "factory"])).toEqual({
      min: "10:00",
      max: "22:00",
    });
  });

  it("recusa o horario que causou o problema real: 14h numa sexta", () => {
    const janela = pickupWindowForDay(horarios, sexta);
    expect(isPickupTimeAllowed("14:00", janela)).toBe(false);
  });

  it("aceita horarios dentro da janela, incluindo as pontas", () => {
    const janela = pickupWindowForDay(horarios, sexta);
    expect(isPickupTimeAllowed("19:30", janela)).toBe(true);
    expect(isPickupTimeAllowed("20:45", janela)).toBe(true);
    expect(isPickupTimeAllowed("22:00", janela)).toBe(true);
    expect(isPickupTimeAllowed("22:01", janela)).toBe(false);
  });

  it("recusa horario vazio", () => {
    expect(isPickupTimeAllowed("", pickupWindowForDay(horarios, sexta))).toBe(false);
  });

  it("nao bloqueia quando nao ha janela cadastrada", () => {
    expect(isPickupTimeAllowed("14:00", null)).toBe(true);
  });

  it("converte relogio em numero", () => {
    expect(clockToNumber("19:30")).toBe(19.5);
    expect(clockToNumber("22:00:00")).toBe(22);
  });

  it("fala com o cliente, nao com o sistema", () => {
    const janela = pickupWindowForDay(horarios, sexta);
    expect(pickupWindowMessage(janela)).toContain("das 19h30 ?s 22h00");
    expect(pickupWindowHint(janela)).toBe("Hoje das 19h30 ?s 22h00.");
    expect(pickupWindowMessage(janela)).not.toContain("channel");
  });
});
