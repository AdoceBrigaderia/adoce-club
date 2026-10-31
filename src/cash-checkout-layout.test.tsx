import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import CashCustomerSelector from "./CashCustomerSelector";

describe("caixa compacto no tablet", () => {
  it("mantém os três campos do cliente sem legenda nem indicação opcional", () => {
    const html = renderToStaticMarkup(
      <CashCustomerSelector
        value={null}
        phone=""
        name=""
        paidSlices={0}
        onSelect={() => {}}
        onPhone={() => {}}
        onName={() => {}}
      />,
    );

    expect(html).toContain("Clube Adoce");
    expect(html).toContain("Celular");
    expect(html).toContain("Nome e sobrenome");
    expect(html).not.toContain("Identificação do cliente");
    expect(html).not.toContain("(opcional)");
  });

  it("exibe Caixa e a identificação na mesma faixa antes dos sabores", () => {
    const manualSale = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");

    expect(manualSale).toContain('className="cash-sale-heading"');
    expect(manualSale).toContain('className="cash-flavors-title">Caixa');
    expect(manualSale.indexOf("<CashCustomerSelector")).toBeLessThan(manualSale.indexOf('className="cash-register-flavors"'));
    expect(manualSale).toContain('className="cash-online-orders"');
  });
});
