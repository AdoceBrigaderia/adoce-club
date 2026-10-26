/** Monetary inputs and outputs are integer cents; percentages use the 0–100 scale. */
export type CostConfidence = "historical" | "estimated_current" | "missing";

export type CostClass =
  | "variable_material_packaging"
  | "variable_fee"
  | "direct_labor"
  | "allocated_fixed"
  | "depreciation"
  | "unabsorbed_operating_expense"
  | "pro_labore";

export type CoverageBucket = {
  units: number;
  /** Net sales for this confidence bucket, after its allocated fees. */
  revenueCents: number;
};

export type CoverageInput = Record<CostConfidence, CoverageBucket>;

export type CoverageSummary = CoverageInput & {
  totalUnits: number;
  totalRevenueCents: number;
  coveredUnits: number;
  coveredRevenueCents: number;
  coveredUnitsPercent: number;
  coveredRevenuePercent: number;
  historicalUnitsPercent: number;
  historicalRevenuePercent: number;
  estimatedUnitsPercent: number;
  estimatedRevenuePercent: number;
  missingUnitsPercent: number;
  missingRevenuePercent: number;
  /** Estimates remain partial even when every item has a calculable cost. */
  isPartial: boolean;
};

export type ManagementResultInput = {
  /** Effective completed sales, after commercial deductions and reversals. */
  salesRevenueCents: number;
  feesCents: number;
  /** Historical + estimated CMV, including any absorbed fixed costs. */
  cogsCents: number;
  lossesCents: number;
  /** Only expenses not already included in CMV or fees. */
  unabsorbedOperatingExpensesCents: number;
  /** Informational subset of CMV; never deducted again. */
  absorbedFixedCostsCents: number;
  proLaboreCents: number;
  ownerWithdrawalsCents: number;
  coverage: CoverageInput;
};

export type ManagementWarning = "partial_cost_coverage" | "estimated_current_costs" | "missing_costs";

export type ManagementResult = {
  salesRevenueCents: number;
  netRevenueCents: number;
  coveredRevenueCents: number;
  cogsCents: number;
  coveredGrossProfitCents: number;
  operatingResultBeforeProLaboreCents: number;
  proLaboreCents: number;
  profitAfterProLaboreCents: number;
  absorbedFixedCostsCents: number;
  ownerWithdrawalsCents: number;
  coverage: CoverageSummary;
  warnings: ManagementWarning[];
};

function integer(value: number, field: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${field} must be a safe integer`);
  return value;
}

const percentage = (part: number, total: number) => total === 0 ? 0 : part / total * 100;
const hasActivity = (bucket: CoverageBucket) => bucket.units !== 0 || bucket.revenueCents !== 0;

export function classifyCoverage(input: CoverageInput): CoverageSummary {
  const copyBucket = (confidence: CostConfidence): CoverageBucket => ({
    units: integer(input[confidence].units, `${confidence}.units`),
    revenueCents: integer(input[confidence].revenueCents, `${confidence}.revenueCents`),
  });
  const historical = copyBucket("historical");
  const estimated = copyBucket("estimated_current");
  const missing = copyBucket("missing");
  const coveredUnits = integer(historical.units + estimated.units, "coveredUnits");
  const coveredRevenueCents = integer(historical.revenueCents + estimated.revenueCents, "coveredRevenueCents");
  const totalUnits = integer(coveredUnits + missing.units, "totalUnits");
  const totalRevenueCents = integer(coveredRevenueCents + missing.revenueCents, "totalRevenueCents");
  return {
    historical, estimated_current: estimated, missing,
    totalUnits, totalRevenueCents, coveredUnits, coveredRevenueCents,
    coveredUnitsPercent: percentage(coveredUnits, totalUnits),
    coveredRevenuePercent: percentage(coveredRevenueCents, totalRevenueCents),
    historicalUnitsPercent: percentage(historical.units, totalUnits),
    historicalRevenuePercent: percentage(historical.revenueCents, totalRevenueCents),
    estimatedUnitsPercent: percentage(estimated.units, totalUnits),
    estimatedRevenuePercent: percentage(estimated.revenueCents, totalRevenueCents),
    missingUnitsPercent: percentage(missing.units, totalUnits),
    missingRevenuePercent: percentage(missing.revenueCents, totalRevenueCents),
    isPartial: hasActivity(estimated) || hasActivity(missing),
  };
}

export function calculateManagementResult(input: ManagementResultInput): ManagementResult {
  // Fail closed on fractional/unsafe money rather than silently rounding financial facts.
  for (const [field, value] of Object.entries(input)) {
    if (field !== "coverage") integer(value as number, field);
  }
  const coverage = classifyCoverage(input.coverage);
  const netRevenueCents = integer(input.salesRevenueCents - input.feesCents, "netRevenueCents");
  if (coverage.totalRevenueCents !== netRevenueCents) {
    throw new RangeError("Coverage revenue must reconcile with sales less allocated fees");
  }
  const coveredGrossProfitCents = integer(coverage.coveredRevenueCents - input.cogsCents, "coveredGrossProfitCents");
  const operatingResultBeforeProLaboreCents = integer(
    coveredGrossProfitCents - input.lossesCents - input.unabsorbedOperatingExpensesCents,
    "operatingResultBeforeProLaboreCents",
  );
  const profitAfterProLaboreCents = integer(operatingResultBeforeProLaboreCents - input.proLaboreCents, "profitAfterProLaboreCents");
  const warnings: ManagementWarning[] = [];
  if (coverage.isPartial) warnings.push("partial_cost_coverage");
  if (hasActivity(coverage.estimated_current)) warnings.push("estimated_current_costs");
  if (hasActivity(coverage.missing)) warnings.push("missing_costs");
  return {
    salesRevenueCents: input.salesRevenueCents, netRevenueCents,
    coveredRevenueCents: coverage.coveredRevenueCents, cogsCents: input.cogsCents,
    coveredGrossProfitCents, operatingResultBeforeProLaboreCents,
    proLaboreCents: input.proLaboreCents, profitAfterProLaboreCents,
    absorbedFixedCostsCents: input.absorbedFixedCostsCents,
    ownerWithdrawalsCents: input.ownerWithdrawalsCents,
    coverage, warnings,
  };
}
