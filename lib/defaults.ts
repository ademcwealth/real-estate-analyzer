import type { ExpenseInputs, MortgageInputs } from "@/types";

// Edmonton, Alberta market defaults (2025)
export const EDMONTON_DEFAULTS = {
  interestRate: 0.055, // 5.5% - current Canadian investment property rates
  downPaymentPercent: 0.20,
  closingCostsPercent: 0.02,
  loanTermYears: 25, // Standard Canadian amortization
  propertyTaxAnnualRate: 0.01014, // fallback: ~1.014% of purchase price when assessed value unavailable
  propertyTaxMillRate: 10.14,    // Edmonton 2025 combined mill rate (municipal 7.63 + education 2.51) per $1,000 assessed
  insuranceMonthly: 175,
  maintenancePercent: 0.08,
  vacancyPercent: 0.05,
  managementPercent: 0.08,
  repairCosts: 5000,

  // Airbnb defaults for Edmonton
  airbnbNightsPerMonth: 18, // ~60% occupancy
  airbnbDailyRate: 150,
  airbnbCleaningFee: 85,
  airbnbFurnitureCost: 8000,
  airbnbCleanerPercent: 0.15,

  // Arbitrage defaults
  arbDamageDeposit: 2000,
  arbRepairCosts: 1000,
  arbFurnitureCost: 4000,

  // Fix and flip defaults
  flipMonthsHolding: 6,
  flipARVMultiplier: 1.20, // 20% above purchase price
  flipRepairCosts: 30000,
};

// Rent estimates by bedroom count (Edmonton 2025)
export const EDMONTON_RENT_BY_BEDROOM: Record<number, number> = {
  0: 1200, // bachelor/studio
  1: 1450,
  2: 1850,
  3: 2200,
  4: 2600,
  5: 3000,
};

export function getDefaultMortgageInputs(purchasePrice: number): MortgageInputs {
  return {
    purchasePrice,
    downPaymentPercent: EDMONTON_DEFAULTS.downPaymentPercent,
    closingCostsPercent: EDMONTON_DEFAULTS.closingCostsPercent,
    repairCosts: EDMONTON_DEFAULTS.repairCosts,
    loanTermYears: EDMONTON_DEFAULTS.loanTermYears,
    interestRate: EDMONTON_DEFAULTS.interestRate,
  };
}

export function getDefaultExpenses(purchasePrice: number, assessedValue?: number, annualTaxLevy?: number): ExpenseInputs {
  const annualTaxes = annualTaxLevy
    ? annualTaxLevy
    : assessedValue
    ? assessedValue * (EDMONTON_DEFAULTS.propertyTaxMillRate / 1000)
    : purchasePrice * EDMONTON_DEFAULTS.propertyTaxAnnualRate;
  return {
    monthlyTaxes: Math.round(annualTaxes / 12),
    monthlyInsurance: EDMONTON_DEFAULTS.insuranceMonthly,
    monthlyTrash: 0,
    monthlyGasElectric: 0,
    monthlyInternet: 0,
    monthlyHOA: 0,
    monthlyWaterSewer: 0,
    monthlyHeat: 0,
    monthlyLawnSnow: 0,
    monthlyPhoneBill: 0,
    monthlyExtra: 0,
    maintenancePercent: EDMONTON_DEFAULTS.maintenancePercent,
    vacancyPercent: EDMONTON_DEFAULTS.vacancyPercent,
    managementPercent: EDMONTON_DEFAULTS.managementPercent,
  };
}

export function getDefaultRent(bedrooms: number): number {
  return EDMONTON_RENT_BY_BEDROOM[bedrooms] ?? EDMONTON_RENT_BY_BEDROOM[2];
}
