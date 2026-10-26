import { describe, expect, it } from "vitest";
import { calculateManagementResult, classifyCoverage, type ManagementResultInput } from "./management-accounting";

const fullPeriod = (): ManagementResultInput => ({
  salesRevenueCents: 100_000,
  feesCents: 3_000,
  cogsCents: 40_000,
  lossesCents: 2_000,
  unabsorbedOperatingExpensesCents: 10_000,
  absorbedFixedCostsCents: 5_000,
  proLaboreCents: 15_000,
  ownerWithdrawalsCents: 0,
  coverage: {
    historical: { units: 10, revenueCents: 97_000 },
    estimated_current: { units: 0, revenueCents: 0 },
    missing: { units: 0, revenueCents: 0 },
  },
});

describe("management accounting", () => {
  it("calculates_profit_after_pro_labore", () => {
    const result = calculateManagementResult(fullPeriod());
    expect(result).toMatchObject({
      salesRevenueCents: 100_000, netRevenueCents: 97_000,
      coveredRevenueCents: 97_000, cogsCents: 40_000,
      coveredGrossProfitCents: 57_000,
      operatingResultBeforeProLaboreCents: 45_000,
      proLaboreCents: 15_000, profitAfterProLaboreCents: 30_000,
      warnings: [],
    });
    expect(result.coverage.isPartial).toBe(false);
  });

  it("uses_only_covered_revenue_for_partial_gross_profit", () => {
    const result = calculateManagementResult({
      ...fullPeriod(), cogsCents: 24_000,
      coverage: {
        historical: { units: 4, revenueCents: 38_800 },
        estimated_current: { units: 2, revenueCents: 19_400 },
        missing: { units: 4, revenueCents: 38_800 },
      },
    });
    expect(result.coveredRevenueCents).toBe(58_200);
    expect(result.coveredGrossProfitCents).toBe(34_200);
    expect(result.profitAfterProLaboreCents).toBe(7_200);
    expect(result.coverage).toMatchObject({
      isPartial: true, coveredRevenuePercent: 60, historicalRevenuePercent: 40,
      estimatedRevenuePercent: 20, missingRevenuePercent: 40,
    });
    expect(result.warnings).toEqual(["partial_cost_coverage", "estimated_current_costs", "missing_costs"]);
  });

  it("does_not_double_count_absorbed_fixed_costs", () => {
    // The 5,000 absorbed fixed costs are already part of the 40,000 CMV.
    const result = calculateManagementResult(fullPeriod());
    expect(result.operatingResultBeforeProLaboreCents).toBe(45_000);
    expect(result.absorbedFixedCostsCents).toBe(5_000);
  });

  it("returns_zero_safe_percentages_for_empty_period", () => {
    const coverage = classifyCoverage({
      historical: { units: 0, revenueCents: 0 },
      estimated_current: { units: 0, revenueCents: 0 },
      missing: { units: 0, revenueCents: 0 },
    });
    expect(coverage).toMatchObject({
      totalUnits: 0, totalRevenueCents: 0, coveredUnitsPercent: 0,
      coveredRevenuePercent: 0, historicalUnitsPercent: 0, historicalRevenuePercent: 0,
      estimatedUnitsPercent: 0, estimatedRevenuePercent: 0,
      missingUnitsPercent: 0, missingRevenuePercent: 0, isPartial: false,
    });
    const result = calculateManagementResult({
      salesRevenueCents: 0, feesCents: 0, cogsCents: 0, lossesCents: 0,
      unabsorbedOperatingExpensesCents: 0, absorbedFixedCostsCents: 0,
      proLaboreCents: 0, ownerWithdrawalsCents: 0, coverage,
    });
    expect(result.profitAfterProLaboreCents).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("keeps_owner_withdrawals_out_of_expenses", () => {
    const result = calculateManagementResult({ ...fullPeriod(), ownerWithdrawalsCents: 50_000 });
    expect(result.profitAfterProLaboreCents).toBe(30_000);
    expect(result.ownerWithdrawalsCents).toBe(50_000);
  });

  it("distinguishes_estimated_costs_from_historical_coverage", () => {
    const coverage = classifyCoverage({
      historical: { units: 0, revenueCents: 0 },
      estimated_current: { units: 10, revenueCents: 97_000 },
      missing: { units: 0, revenueCents: 0 },
    });
    expect(coverage).toMatchObject({
      coveredUnitsPercent: 100, coveredRevenuePercent: 100,
      historicalUnitsPercent: 0, historicalRevenuePercent: 0,
      estimatedUnitsPercent: 100, estimatedRevenuePercent: 100, isPartial: true,
    });
    const result = calculateManagementResult({ ...fullPeriod(), coverage });
    expect(result.coveredGrossProfitCents).toBe(57_000);
    expect(result.warnings).toEqual(["partial_cost_coverage", "estimated_current_costs"]);
  });

  it("keeps_zero_revenue_units_without_cost_partial", () => {
    expect(classifyCoverage({
      historical: { units: 1, revenueCents: 100 },
      estimated_current: { units: 0, revenueCents: 0 },
      missing: { units: 1, revenueCents: 0 },
    })).toMatchObject({ historicalRevenuePercent: 100, historicalUnitsPercent: 50, isPartial: true });
  });

  it("rejects_fractional_cents_and_inconsistent_net_revenue", () => {
    expect(() => calculateManagementResult({ ...fullPeriod(), cogsCents: 0.5 })).toThrow(RangeError);
    expect(() => calculateManagementResult({ ...fullPeriod(), feesCents: 3_001 })).toThrow(RangeError);
  });

  it("preserves_losses_and_negative_profit_in_integer_cents", () => {
    const result = calculateManagementResult({ ...fullPeriod(), proLaboreCents: 60_001 });
    expect(result.profitAfterProLaboreCents).toBe(-15_001);
  });
});
