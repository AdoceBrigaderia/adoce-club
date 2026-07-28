export type CostDataStatus =
  | "provisional"
  | "awaiting_validation"
  | "validated"
  | "blocked";

export type CostComponent = {
  id: string;
  label: string;
  quantity: number;
  unitCost: number;
  lossPercent?: number;
};

export type CostAmount = {
  id: string;
  label: string;
  amount: number;
};

export type CostSnapshotInput = {
  recipeVersionId: string;
  calculatedAt?: string;
  dataStatus: CostDataStatus;
  yieldUnits: number;
  directComponents?: CostComponent[];
  packaging?: CostComponent[];
  labor?: CostAmount[];
  energyAndGas?: CostAmount[];
  variableOverhead?: CostAmount[];
  fixedAllocation?: CostAmount[];
  depreciation?: CostAmount[];
  maintenance?: CostAmount[];
  replacementReserve?: CostAmount[];
};

export type CostSnapshot = {
  recipeVersionId: string;
  calculatedAt: string;
  dataStatus: CostDataStatus;
  yieldUnits: number;
  breakdown: {
    direct: number;
    packaging: number;
    labor: number;
    energyAndGas: number;
    variableOverhead: number;
    fixedAllocation: number;
    depreciation: number;
    maintenance: number;
    replacementReserve: number;
  };
  total: number;
  costPerUnit: number;
};

export type EnergyCostInput = {
  powerWatts: number;
  hours: number;
  equipmentCount?: number;
  tariffPerKwh: number;
  sharedUnits?: number;
};

export type GasCostInput = {
  consumptionPerHour: number;
  hours: number;
  unitPrice: number;
  sharedUnits?: number;
};

export type LaborCostInput = {
  hourlyCost: number;
  activeMinutes: number;
  workers?: number;
  sharedUnits?: number;
};

export type ChannelPriceInput = {
  totalCost: number;
  targetMargin: number;
  minimumMargin?: number;
  percentageCharges?: number;
  fixedCharges?: number;
  commercialRounding?: number;
};

export type ChannelPrice = {
  suggestedPrice: number;
  minimumPrice: number;
  expectedNetRevenue: number;
  expectedProfit: number;
  expectedMargin: number;
};

const ensureFinite = (value: number, field: string) => {
  if (!Number.isFinite(value)) throw new Error(`${field} precisa ser um número válido.`);
  return value;
};

const ensureNonNegative = (value: number, field: string) => {
  ensureFinite(value, field);
  if (value < 0) throw new Error(`${field} não pode ser negativo.`);
  return value;
};

const ensurePositive = (value: number, field: string) => {
  ensureFinite(value, field);
  if (value <= 0) throw new Error(`${field} precisa ser maior que zero.`);
  return value;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const sumAmounts = (items: CostAmount[] = []) =>
  roundMoney(
    items.reduce((total, item) => {
      ensureNonNegative(item.amount, `Custo de ${item.label || item.id}`);
      return total + item.amount;
    }, 0),
  );

export function componentCost(component: CostComponent) {
  const quantity = ensureNonNegative(component.quantity, `Quantidade de ${component.label}`);
  const unitCost = ensureNonNegative(component.unitCost, `Custo unitário de ${component.label}`);
  const lossPercent = ensureNonNegative(
    component.lossPercent ?? 0,
    `Perda de ${component.label}`,
  );
  if (lossPercent >= 100) throw new Error(`Perda de ${component.label} precisa ser menor que 100%.`);
  const usefulFactor = 1 - lossPercent / 100;
  return roundMoney((quantity * unitCost) / usefulFactor);
}

export function calculateEnergyCost(input: EnergyCostInput) {
  const powerWatts = ensureNonNegative(input.powerWatts, "Potência");
  const hours = ensureNonNegative(input.hours, "Tempo de energia");
  const equipmentCount = ensurePositive(input.equipmentCount ?? 1, "Quantidade de equipamentos");
  const tariff = ensureNonNegative(input.tariffPerKwh, "Tarifa de energia");
  const sharedUnits = ensurePositive(input.sharedUnits ?? 1, "Unidades compartilhadas");
  const kwh = (powerWatts / 1000) * hours * equipmentCount;
  return roundMoney((kwh * tariff) / sharedUnits);
}

export function calculateGasCost(input: GasCostInput) {
  const consumption = ensureNonNegative(input.consumptionPerHour, "Consumo de gás");
  const hours = ensureNonNegative(input.hours, "Tempo de gás");
  const unitPrice = ensureNonNegative(input.unitPrice, "Preço do gás");
  const sharedUnits = ensurePositive(input.sharedUnits ?? 1, "Unidades compartilhadas");
  return roundMoney((consumption * hours * unitPrice) / sharedUnits);
}

export function calculateLaborCost(input: LaborCostInput) {
  const hourlyCost = ensureNonNegative(input.hourlyCost, "Custo por hora");
  const activeMinutes = ensureNonNegative(input.activeMinutes, "Tempo ativo");
  const workers = ensurePositive(input.workers ?? 1, "Quantidade de pessoas");
  const sharedUnits = ensurePositive(input.sharedUnits ?? 1, "Unidades compartilhadas");
  return roundMoney((hourlyCost * (activeMinutes / 60) * workers) / sharedUnits);
}

export function calculateMonthlyDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLifeMonths: number,
) {
  const acquisition = ensureNonNegative(acquisitionCost, "Valor de aquisição");
  const residual = ensureNonNegative(residualValue, "Valor residual");
  const months = ensurePositive(usefulLifeMonths, "Vida útil em meses");
  if (residual > acquisition) throw new Error("O valor residual não pode superar a aquisição.");
  return roundMoney((acquisition - residual) / months);
}

export function calculateCostSnapshot(input: CostSnapshotInput): CostSnapshot {
  const yieldUnits = ensurePositive(input.yieldUnits, "Rendimento");
  if (!input.recipeVersionId.trim()) throw new Error("A versão da ficha técnica é obrigatória.");

  const breakdown = {
    direct: roundMoney((input.directComponents ?? []).reduce((sum, item) => sum + componentCost(item), 0)),
    packaging: roundMoney((input.packaging ?? []).reduce((sum, item) => sum + componentCost(item), 0)),
    labor: sumAmounts(input.labor),
    energyAndGas: sumAmounts(input.energyAndGas),
    variableOverhead: sumAmounts(input.variableOverhead),
    fixedAllocation: sumAmounts(input.fixedAllocation),
    depreciation: sumAmounts(input.depreciation),
    maintenance: sumAmounts(input.maintenance),
    replacementReserve: sumAmounts(input.replacementReserve),
  };

  const total = roundMoney(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return {
    recipeVersionId: input.recipeVersionId,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
    dataStatus: input.dataStatus,
    yieldUnits,
    breakdown,
    total,
    costPerUnit: roundMoney(total / yieldUnits),
  };
}

const validateMargin = (value: number, field: string) => {
  ensureNonNegative(value, field);
  if (value >= 1) throw new Error(`${field} precisa ser menor que 100%.`);
  return value;
};

const roundCommercial = (value: number, increment: number) => {
  const validIncrement = ensurePositive(increment, "Arredondamento comercial");
  return roundMoney(Math.ceil(value / validIncrement) * validIncrement);
};

export function calculateChannelPrice(input: ChannelPriceInput): ChannelPrice {
  const totalCost = ensureNonNegative(input.totalCost, "Custo total");
  const targetMargin = validateMargin(input.targetMargin, "Margem desejada");
  const minimumMargin = validateMargin(
    input.minimumMargin ?? targetMargin,
    "Margem mínima",
  );
  const percentageCharges = validateMargin(
    input.percentageCharges ?? 0,
    "Taxas percentuais",
  );
  const fixedCharges = ensureNonNegative(input.fixedCharges ?? 0, "Taxas fixas");
  const rounding = input.commercialRounding ?? 0.5;

  const grossForMargin = (margin: number) => {
    const requiredNetRevenue = totalCost / (1 - margin);
    return (requiredNetRevenue + fixedCharges) / (1 - percentageCharges);
  };

  const minimumPrice = roundCommercial(grossForMargin(minimumMargin), rounding);
  const suggestedPrice = Math.max(
    minimumPrice,
    roundCommercial(grossForMargin(targetMargin), rounding),
  );
  const expectedNetRevenue = roundMoney(
    suggestedPrice * (1 - percentageCharges) - fixedCharges,
  );
  const expectedProfit = roundMoney(expectedNetRevenue - totalCost);
  const expectedMargin = expectedNetRevenue > 0
    ? Math.round((expectedProfit / expectedNetRevenue) * 10_000) / 10_000
    : 0;

  return {
    suggestedPrice,
    minimumPrice,
    expectedNetRevenue,
    expectedProfit,
    expectedMargin,
  };
}
