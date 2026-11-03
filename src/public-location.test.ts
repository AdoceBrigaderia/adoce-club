import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cantinhoDaAdoceLocation } from "./public-location";

const footer = readFileSync(new URL("./PublicFooter.tsx", import.meta.url), "utf8");

describe("modal de localização do Cantinho da Adoce", () => {
  it("usa o nome comercial como destino em Maps, Waze e Uber", () => {
    const query = encodeURIComponent("Cantinho da Adoce, Fortaleza, CE");
    expect(cantinhoDaAdoceLocation.googleMapsUrl).toContain(query);
    expect(cantinhoDaAdoceLocation.wazeUrl).toContain(query);
    expect(cantinhoDaAdoceLocation.uberUrl).toContain("dropoff%5Bformatted_address%5D=Cantinho+da+Adoce%2C+Fortaleza%2C+CE");
    expect(cantinhoDaAdoceLocation.uberUrl).toContain("pickup=my_location");
  });

  it("usa um endereço alternativo só para a 99, nunca o nome comercial", () => {
    expect(cantinhoDaAdoceLocation.ninetyNineAddress).toBe("Rua Cento e Quatro, 277, Passaré, Fortaleza/CE");
    expect(cantinhoDaAdoceLocation.ninetyNineAddress).not.toContain("Cantinho da Adoce");
    expect(cantinhoDaAdoceLocation.googleMapsUrl).not.toContain("Cento e Quatro");
    expect(cantinhoDaAdoceLocation.wazeUrl).not.toContain("Cento e Quatro");
  });

  it("nunca abre apps automaticamente nem pede localização GPS", () => {
    expect(footer).not.toContain("navigator.geolocation");
    expect(footer).not.toMatch(/window\.open\(.*location/i);
  });

  it("mostra os quatro botões, o card de endereço e o aviso da 99 no modal", () => {
    expect(footer).toContain("Nossa localização");
    expect(footer).toContain("Estamos esperando por você!");
    expect(footer).toContain("Como deseja chegar?");
    expect(footer).toContain("cantinhoDaAdoceLocation.googleMapsUrl");
    expect(footer).toContain("cantinhoDaAdoceLocation.wazeUrl");
    expect(footer).toContain("cantinhoDaAdoceLocation.uberUrl");
    expect(footer).toContain("copyNinetyNineAddress");
    expect(footer).toContain("Abra a 99 e cole no campo de destino");
  });

  it("fecha com Escape e devolve o foco para quem abriu o modal", () => {
    expect(footer).toContain('event.key === "Escape"');
    expect(footer).toContain("lastTriggerRef.current?.focus()");
    expect(footer).toContain("closeButtonRef.current?.focus()");
  });
});
