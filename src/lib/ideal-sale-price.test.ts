import { expect, it } from "vitest";
import { parseIdealSalePrice, idealSaleMargin, parsePaymentFeePercent, weightedPaymentFeePercent } from "./ideal-sale-price";

it("aceita reais com vírgula ou ponto e rejeita valores inválidos", () => {
  expect(parseIdealSalePrice("18,50")).toBe(18.5);
  expect(parseIdealSalePrice("18.00")).toBe(18);
  for (const value of ["", "0", "-18", "18.001", "abc", "Infinity"]) expect(parseIdealSalePrice(value)).toBeNull();
});
it("desconta a taxa média sobre a venda antes de calcular as duas margens", () => {
  expect(idealSaleMargin(9, 18, 1)?.amount).toBeCloseTo(8.82);
  expect(idealSaleMargin(9, 18, 1)?.percent).toBeCloseTo(49);
  expect(idealSaleMargin(9, 20, 1)?.percent).toBeCloseTo(54);
  expect(idealSaleMargin(20, 18, 1)?.percent).toBeCloseTo(-12.111111);
  expect(idealSaleMargin(9, 18, 100)).toBeNull();
});
it("pondera o relatório pelo valor vendido, incluindo meios sem taxa", () => {
  const payments = [{ amount: 3090, fee: 15.14 }, { amount: 736, fee: 12.29 }, { amount: 448, fee: 17.43 }, { amount: 172, fee: 0 }, { amount: 48, fee: 0 }];
  expect(weightedPaymentFeePercent(payments)).toBeCloseTo(0.9982198487);
  expect(weightedPaymentFeePercent([])).toBeNull();
  expect(parsePaymentFeePercent("0")).toBe(0);
  expect(parsePaymentFeePercent("0,9982")).toBe(0.9982);
  for (const invalid of ["", "100", "-1", "0.12345", "abc"]) expect(parsePaymentFeePercent(invalid)).toBeNull();
});
it("calcula margem sobre o preço de venda, incluindo margem negativa", () => {
  expect(idealSaleMargin(9, 18)).toEqual({ amount: 9, percent: 50 });
  expect(idealSaleMargin(9, 20)?.amount).toBe(11);
  expect(idealSaleMargin(9, 20)?.percent).toBeCloseTo(55);
  expect(idealSaleMargin(20, 18)?.percent).toBeCloseTo(-11.111111);
  expect(idealSaleMargin(null, 18)).toBeNull();
  expect(idealSaleMargin(9, 0)).toBeNull();
});
