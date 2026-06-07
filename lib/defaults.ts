import type { ExpenseInputs, MortgageInputs } from "@/types";

// National mortgage defaults — same across Canada
export const MORTGAGE_DEFAULTS = {
  interestRate: 0.055,
  downPaymentPercent: 0.20,
  closingCostsPercent: 0.02,
  loanTermYears: 25,
  repairCosts: 5000,
};

// Variable expense rates — consistent across Canada
export const EXPENSE_RATE_DEFAULTS = {
  maintenancePercent: 0.08,
  vacancyPercent: 0.05,
  managementPercent: 0.08,
};

// Fix-and-flip defaults — consistent across Canada
export const FLIP_DEFAULTS = {
  flipMonthsHolding: 6,
  flipARVMultiplier: 1.20,
  flipRepairCosts: 30000,
};

// Arbitrage startup defaults — consistent across Canada
export const ARB_DEFAULTS = {
  arbDamageDeposit: 2000,
  arbRepairCosts: 1000,
  arbFurnitureCost: 4000,
};

interface CityProfile {
  propertyTaxAnnualRate: number;  // as decimal, applied to assessed or purchase value
  propertyTaxMillRate?: number;   // if available, used when assessedValue is present
  insuranceMonthly: number;
  rentByBedroom: Record<number, number>;
  airbnbDailyRate: number;
  airbnbNightsPerMonth: number;
  airbnbCleaningFee: number;
  airbnbFurnitureCost: number;
  airbnbCleanerPercent: number;
}

// Per-city market data (2025 approximations)
const CITY_PROFILES: Record<string, CityProfile> = {
  edmonton: {
    propertyTaxAnnualRate: 0.0094,
    propertyTaxMillRate: 9.4040,
    insuranceMonthly: 175,
    rentByBedroom: { 0: 1200, 1: 1450, 2: 1850, 3: 2200, 4: 2600, 5: 3000 },
    airbnbDailyRate: 150, airbnbNightsPerMonth: 18, airbnbCleaningFee: 85,
    airbnbFurnitureCost: 8000, airbnbCleanerPercent: 0.15,
  },
  calgary: {
    propertyTaxAnnualRate: 0.0067,
    insuranceMonthly: 170,
    rentByBedroom: { 0: 1400, 1: 1800, 2: 2200, 3: 2700, 4: 3100, 5: 3600 },
    airbnbDailyRate: 175, airbnbNightsPerMonth: 19, airbnbCleaningFee: 90,
    airbnbFurnitureCost: 8500, airbnbCleanerPercent: 0.15,
  },
  vancouver: {
    propertyTaxAnnualRate: 0.0027,
    insuranceMonthly: 220,
    rentByBedroom: { 0: 2400, 1: 2700, 2: 3600, 3: 4800, 4: 6000, 5: 7200 },
    airbnbDailyRate: 225, airbnbNightsPerMonth: 22, airbnbCleaningFee: 100,
    airbnbFurnitureCost: 10000, airbnbCleanerPercent: 0.15,
  },
  surrey: {
    propertyTaxAnnualRate: 0.0034,
    insuranceMonthly: 200,
    rentByBedroom: { 0: 1900, 1: 2200, 2: 2800, 3: 3500, 4: 4200, 5: 5000 },
    airbnbDailyRate: 180, airbnbNightsPerMonth: 20, airbnbCleaningFee: 90,
    airbnbFurnitureCost: 9000, airbnbCleanerPercent: 0.15,
  },
  burnaby: {
    propertyTaxAnnualRate: 0.0028,
    insuranceMonthly: 205,
    rentByBedroom: { 0: 2100, 1: 2500, 2: 3200, 3: 4100, 4: 5100, 5: 6000 },
    airbnbDailyRate: 200, airbnbNightsPerMonth: 21, airbnbCleaningFee: 95,
    airbnbFurnitureCost: 9500, airbnbCleanerPercent: 0.15,
  },
  victoria: {
    propertyTaxAnnualRate: 0.0052,
    insuranceMonthly: 195,
    rentByBedroom: { 0: 1900, 1: 2200, 2: 2800, 3: 3500, 4: 4200, 5: 5000 },
    airbnbDailyRate: 200, airbnbNightsPerMonth: 22, airbnbCleaningFee: 95,
    airbnbFurnitureCost: 9000, airbnbCleanerPercent: 0.15,
  },
  kelowna: {
    propertyTaxAnnualRate: 0.0035,
    insuranceMonthly: 185,
    rentByBedroom: { 0: 1700, 1: 2000, 2: 2500, 3: 3200, 4: 3900, 5: 4600 },
    airbnbDailyRate: 195, airbnbNightsPerMonth: 20, airbnbCleaningFee: 90,
    airbnbFurnitureCost: 8500, airbnbCleanerPercent: 0.15,
  },
  toronto: {
    propertyTaxAnnualRate: 0.0067,
    insuranceMonthly: 200,
    rentByBedroom: { 0: 2100, 1: 2500, 2: 3300, 3: 4200, 4: 5200, 5: 6200 },
    airbnbDailyRate: 225, airbnbNightsPerMonth: 21, airbnbCleaningFee: 100,
    airbnbFurnitureCost: 10000, airbnbCleanerPercent: 0.15,
  },
  mississauga: {
    propertyTaxAnnualRate: 0.0074,
    insuranceMonthly: 190,
    rentByBedroom: { 0: 1900, 1: 2200, 2: 2900, 3: 3700, 4: 4500, 5: 5200 },
    airbnbDailyRate: 190, airbnbNightsPerMonth: 20, airbnbCleaningFee: 95,
    airbnbFurnitureCost: 9500, airbnbCleanerPercent: 0.15,
  },
  brampton: {
    propertyTaxAnnualRate: 0.0095,
    insuranceMonthly: 185,
    rentByBedroom: { 0: 1700, 1: 2000, 2: 2600, 3: 3300, 4: 4000, 5: 4700 },
    airbnbDailyRate: 175, airbnbNightsPerMonth: 19, airbnbCleaningFee: 90,
    airbnbFurnitureCost: 9000, airbnbCleanerPercent: 0.15,
  },
  ottawa: {
    propertyTaxAnnualRate: 0.0110,
    insuranceMonthly: 185,
    rentByBedroom: { 0: 1600, 1: 2000, 2: 2500, 3: 3100, 4: 3800, 5: 4400 },
    airbnbDailyRate: 175, airbnbNightsPerMonth: 20, airbnbCleaningFee: 90,
    airbnbFurnitureCost: 8500, airbnbCleanerPercent: 0.15,
  },
  hamilton: {
    propertyTaxAnnualRate: 0.0114,
    insuranceMonthly: 175,
    rentByBedroom: { 0: 1500, 1: 1800, 2: 2300, 3: 2800, 4: 3400, 5: 4000 },
    airbnbDailyRate: 160, airbnbNightsPerMonth: 19, airbnbCleaningFee: 85,
    airbnbFurnitureCost: 8500, airbnbCleanerPercent: 0.15,
  },
  montreal: {
    propertyTaxAnnualRate: 0.0089,
    insuranceMonthly: 140,
    rentByBedroom: { 0: 1100, 1: 1500, 2: 1900, 3: 2400, 4: 2900, 5: 3400 },
    airbnbDailyRate: 175, airbnbNightsPerMonth: 20, airbnbCleaningFee: 85,
    airbnbFurnitureCost: 8000, airbnbCleanerPercent: 0.15,
  },
  "quebec city": {
    propertyTaxAnnualRate: 0.0088,
    insuranceMonthly: 130,
    rentByBedroom: { 0: 1000, 1: 1300, 2: 1700, 3: 2100, 4: 2500, 5: 3000 },
    airbnbDailyRate: 150, airbnbNightsPerMonth: 19, airbnbCleaningFee: 80,
    airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15,
  },
  winnipeg: {
    propertyTaxAnnualRate: 0.0130,
    insuranceMonthly: 150,
    rentByBedroom: { 0: 1100, 1: 1400, 2: 1750, 3: 2100, 4: 2500, 5: 2900 },
    airbnbDailyRate: 120, airbnbNightsPerMonth: 17, airbnbCleaningFee: 75,
    airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15,
  },
  saskatoon: {
    propertyTaxAnnualRate: 0.0120,
    insuranceMonthly: 145,
    rentByBedroom: { 0: 1100, 1: 1400, 2: 1700, 3: 2100, 4: 2500, 5: 2900 },
    airbnbDailyRate: 120, airbnbNightsPerMonth: 17, airbnbCleaningFee: 75,
    airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15,
  },
  regina: {
    propertyTaxAnnualRate: 0.0128,
    insuranceMonthly: 140,
    rentByBedroom: { 0: 1000, 1: 1300, 2: 1600, 3: 1950, 4: 2300, 5: 2700 },
    airbnbDailyRate: 115, airbnbNightsPerMonth: 17, airbnbCleaningFee: 70,
    airbnbFurnitureCost: 7000, airbnbCleanerPercent: 0.15,
  },
  halifax: {
    propertyTaxAnnualRate: 0.0115,
    insuranceMonthly: 160,
    rentByBedroom: { 0: 1500, 1: 1800, 2: 2200, 3: 2700, 4: 3200, 5: 3700 },
    airbnbDailyRate: 155, airbnbNightsPerMonth: 19, airbnbCleaningFee: 85,
    airbnbFurnitureCost: 8000, airbnbCleanerPercent: 0.15,
  },
};

// Province-level fallbacks for cities not in the table above
const PROVINCE_PROFILES: Record<string, Omit<CityProfile, "rentByBedroom"> & { rentByBedroom?: Record<number, number> }> = {
  AB: { propertyTaxAnnualRate: 0.0090, insuranceMonthly: 165, airbnbDailyRate: 145, airbnbNightsPerMonth: 18, airbnbCleaningFee: 85, airbnbFurnitureCost: 8000, airbnbCleanerPercent: 0.15 },
  BC: { propertyTaxAnnualRate: 0.0032, insuranceMonthly: 200, airbnbDailyRate: 190, airbnbNightsPerMonth: 20, airbnbCleaningFee: 90, airbnbFurnitureCost: 9000, airbnbCleanerPercent: 0.15 },
  ON: { propertyTaxAnnualRate: 0.0082, insuranceMonthly: 185, airbnbDailyRate: 180, airbnbNightsPerMonth: 19, airbnbCleaningFee: 90, airbnbFurnitureCost: 9000, airbnbCleanerPercent: 0.15 },
  QC: { propertyTaxAnnualRate: 0.0085, insuranceMonthly: 135, airbnbDailyRate: 160, airbnbNightsPerMonth: 19, airbnbCleaningFee: 80, airbnbFurnitureCost: 8000, airbnbCleanerPercent: 0.15 },
  MB: { propertyTaxAnnualRate: 0.0125, insuranceMonthly: 145, airbnbDailyRate: 120, airbnbNightsPerMonth: 17, airbnbCleaningFee: 75, airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15 },
  SK: { propertyTaxAnnualRate: 0.0122, insuranceMonthly: 140, airbnbDailyRate: 120, airbnbNightsPerMonth: 17, airbnbCleaningFee: 75, airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15 },
  NS: { propertyTaxAnnualRate: 0.0112, insuranceMonthly: 155, airbnbDailyRate: 145, airbnbNightsPerMonth: 18, airbnbCleaningFee: 80, airbnbFurnitureCost: 8000, airbnbCleanerPercent: 0.15 },
  NB: { propertyTaxAnnualRate: 0.0120, insuranceMonthly: 145, airbnbDailyRate: 130, airbnbNightsPerMonth: 17, airbnbCleaningFee: 75, airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15 },
  PE: { propertyTaxAnnualRate: 0.0090, insuranceMonthly: 140, airbnbDailyRate: 140, airbnbNightsPerMonth: 18, airbnbCleaningFee: 75, airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15 },
  NL: { propertyTaxAnnualRate: 0.0100, insuranceMonthly: 145, airbnbDailyRate: 125, airbnbNightsPerMonth: 17, airbnbCleaningFee: 75, airbnbFurnitureCost: 7500, airbnbCleanerPercent: 0.15 },
};

// Fallback rent table used when city is unknown (based on national median)
const FALLBACK_RENT: Record<number, number> = { 0: 1400, 1: 1700, 2: 2100, 3: 2600, 4: 3100, 5: 3600 };

export function getCityDefaults(city: string, province?: string): CityProfile {
  const cityKey = city.toLowerCase().trim();
  if (CITY_PROFILES[cityKey]) return CITY_PROFILES[cityKey];

  const provProfile = province ? PROVINCE_PROFILES[province.toUpperCase()] : undefined;
  if (provProfile) {
    return {
      ...provProfile,
      rentByBedroom: provProfile.rentByBedroom ?? FALLBACK_RENT,
    };
  }

  return CITY_PROFILES.edmonton;
}

// Keep for backwards compat — components that already imported this still work
export const EDMONTON_DEFAULTS = {
  ...MORTGAGE_DEFAULTS,
  ...EXPENSE_RATE_DEFAULTS,
  ...FLIP_DEFAULTS,
  ...ARB_DEFAULTS,
  propertyTaxAnnualRate: CITY_PROFILES.edmonton.propertyTaxAnnualRate,
  propertyTaxMillRate: CITY_PROFILES.edmonton.propertyTaxMillRate!,
  insuranceMonthly: CITY_PROFILES.edmonton.insuranceMonthly,
  airbnbNightsPerMonth: CITY_PROFILES.edmonton.airbnbNightsPerMonth,
  airbnbDailyRate: CITY_PROFILES.edmonton.airbnbDailyRate,
  airbnbCleaningFee: CITY_PROFILES.edmonton.airbnbCleaningFee,
  airbnbFurnitureCost: CITY_PROFILES.edmonton.airbnbFurnitureCost,
  airbnbCleanerPercent: CITY_PROFILES.edmonton.airbnbCleanerPercent,
};

export function getDefaultMortgageInputs(purchasePrice: number): MortgageInputs {
  return {
    purchasePrice,
    downPaymentPercent: MORTGAGE_DEFAULTS.downPaymentPercent,
    closingCostsPercent: MORTGAGE_DEFAULTS.closingCostsPercent,
    repairCosts: MORTGAGE_DEFAULTS.repairCosts,
    loanTermYears: MORTGAGE_DEFAULTS.loanTermYears,
    interestRate: MORTGAGE_DEFAULTS.interestRate,
  };
}

export function getDefaultExpenses(
  purchasePrice: number,
  assessedValue?: number,
  city?: string,
  province?: string
): ExpenseInputs {
  const profile = getCityDefaults(city ?? "Edmonton", province);

  const annualTaxes = assessedValue
    ? assessedValue * (profile.propertyTaxMillRate
        ? profile.propertyTaxMillRate / 1000
        : profile.propertyTaxAnnualRate)
    : purchasePrice * profile.propertyTaxAnnualRate;

  return {
    monthlyTaxes: Math.round(annualTaxes / 12),
    monthlyInsurance: profile.insuranceMonthly,
    monthlyTrash: 0,
    monthlyGasElectric: 0,
    monthlyInternet: 0,
    monthlyHOA: 0,
    monthlyWaterSewer: 0,
    monthlyHeat: 0,
    monthlyLawnSnow: 0,
    monthlyPhoneBill: 0,
    monthlyExtra: 0,
    maintenancePercent: EXPENSE_RATE_DEFAULTS.maintenancePercent,
    vacancyPercent: EXPENSE_RATE_DEFAULTS.vacancyPercent,
    managementPercent: EXPENSE_RATE_DEFAULTS.managementPercent,
  };
}

export function getDefaultRent(bedrooms: number, city?: string, province?: string): number {
  const profile = getCityDefaults(city ?? "Edmonton", province);
  return profile.rentByBedroom[bedrooms] ?? profile.rentByBedroom[2] ?? 2100;
}
