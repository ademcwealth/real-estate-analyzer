import type {
  MortgageInputs,
  ExpenseInputs,
  LongTermRentalInputs,
  LongTermRentalResults,
  AirbnbOwnedInputs,
  AirbnbOwnedResults,
  AirbnbArbitrageInputs,
  AirbnbArbitrageResults,
  FixAndFlipInputs,
  FixAndFlipResults,
} from "@/types";

export function calcMortgagePayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (annualRate === 0) return -(principal / (termYears * 12));
  const r = annualRate / 12;
  const n = termYears * 12;
  return -(principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

function calcMonthlyExpenses(
  expenses: ExpenseInputs,
  grossMonthlyIncome: number
): number {
  const fixed =
    expenses.monthlyTaxes +
    expenses.monthlyInsurance +
    expenses.monthlyTrash +
    expenses.monthlyGasElectric +
    expenses.monthlyInternet +
    expenses.monthlyHOA +
    expenses.monthlyWaterSewer +
    expenses.monthlyHeat +
    expenses.monthlyLawnSnow +
    expenses.monthlyPhoneBill +
    expenses.monthlyExtra;

  const variable =
    grossMonthlyIncome * expenses.maintenancePercent +
    grossMonthlyIncome * expenses.vacancyPercent +
    grossMonthlyIncome * expenses.managementPercent;

  return fixed + variable;
}

export function calcLongTermRental(
  inputs: LongTermRentalInputs
): LongTermRentalResults {
  const { mortgage: m, expenses, monthlyRents, laundryRevenue, additionalRevenue } = inputs;

  const downPayment = m.purchasePrice * m.downPaymentPercent;
  const mortgagePrincipal = m.purchasePrice - downPayment;
  const closingCosts = m.purchasePrice * m.closingCostsPercent;
  const totalCapitalNeeded = downPayment + closingCosts + m.repairCosts;
  const mortgagePayment = calcMortgagePayment(mortgagePrincipal, m.interestRate, m.loanTermYears);

  const rentTotal = monthlyRents.reduce((sum, r) => sum + (r || 0), 0);
  const grossMonthlyIncome = rentTotal + laundryRevenue + additionalRevenue;
  const grossYearlyIncome = grossMonthlyIncome * 12;

  const monthlyExpensesNoMortgage = calcMonthlyExpenses(expenses, grossMonthlyIncome);
  const monthlyExpensesWithMortgage = monthlyExpensesNoMortgage + Math.abs(mortgagePayment);

  const monthlyNOI = grossMonthlyIncome - monthlyExpensesNoMortgage;
  const yearlyNOI = monthlyNOI * 12;

  const capRate = m.purchasePrice > 0 ? yearlyNOI / m.purchasePrice : 0;
  const monthlyCashflow = grossMonthlyIncome - monthlyExpensesWithMortgage;
  const yearlyCashflow = monthlyCashflow * 12;
  const cashOnCashReturn = totalCapitalNeeded > 0 ? yearlyCashflow / totalCapitalNeeded : 0;

  const meets50PercentRule = grossMonthlyIncome > 0
    ? monthlyExpensesNoMortgage / grossMonthlyIncome <= 0.5
    : false;
  const meets1PercentRule = m.purchasePrice > 0
    ? grossMonthlyIncome >= m.purchasePrice * 0.01
    : false;

  const isProfitable = monthlyCashflow > 0;
  const profitabilityReasons: string[] = [];

  if (monthlyCashflow > 0) {
    profitabilityReasons.push(`Positive monthly cashflow of $${monthlyCashflow.toFixed(0)}`);
  } else {
    profitabilityReasons.push(`Negative monthly cashflow of $${Math.abs(monthlyCashflow).toFixed(0)} — you'll pay out-of-pocket each month`);
  }
  if (capRate >= 0.06) {
    profitabilityReasons.push(`Strong CAP rate of ${(capRate * 100).toFixed(1)}% (≥6% target)`);
  } else if (capRate >= 0.04) {
    profitabilityReasons.push(`Acceptable CAP rate of ${(capRate * 100).toFixed(1)}% (below 6% ideal)`);
  } else {
    profitabilityReasons.push(`Weak CAP rate of ${(capRate * 100).toFixed(1)}% (below 4% is generally poor for Canadian investment properties)`);
  }
  if (meets1PercentRule) {
    profitabilityReasons.push("Passes the 1% rule — rent ≥ 1% of purchase price");
  } else {
    profitabilityReasons.push(`Fails the 1% rule — rent is ${((grossMonthlyIncome / m.purchasePrice) * 100).toFixed(2)}% of purchase price (need ≥1%)`);
  }
  if (meets50PercentRule) {
    profitabilityReasons.push("Passes the 50% rule — operating expenses ≤ 50% of income");
  } else {
    profitabilityReasons.push(`Fails the 50% rule — operating expenses are ${((monthlyExpensesNoMortgage / grossMonthlyIncome) * 100).toFixed(0)}% of income`);
  }

  return {
    downPayment,
    mortgage: mortgagePrincipal,
    closingCosts,
    totalCapitalNeeded,
    mortgagePayment,
    grossMonthlyIncome,
    grossYearlyIncome,
    monthlyExpensesNoMortgage,
    monthlyExpensesWithMortgage,
    monthlyNOI,
    yearlyNOI,
    capRate,
    cashOnCashReturn,
    monthlyCashflow,
    yearlyCashflow,
    meets50PercentRule,
    meets1PercentRule,
    isProfitable,
    profitabilityReasons,
  };
}

export function calcAirbnbOwned(inputs: AirbnbOwnedInputs): AirbnbOwnedResults {
  const { mortgage: m, expenses, furnitureCost, dailyRate, dailyCleaningFee, occupiedNightsPerMonth, cleanerPercent } = inputs;

  const downPayment = m.purchasePrice * m.downPaymentPercent;
  const mortgagePrincipal = m.purchasePrice - downPayment;
  const closingCosts = m.purchasePrice * m.closingCostsPercent;
  const totalCapitalNeeded = downPayment + closingCosts + m.repairCosts + furnitureCost;
  const mortgagePayment = calcMortgagePayment(mortgagePrincipal, m.interestRate, m.loanTermYears);

  const grossMonthlyIncome = (dailyRate + dailyCleaningFee) * occupiedNightsPerMonth;
  const grossYearlyIncome = grossMonthlyIncome * 12;

  const cleanerMonthly = dailyCleaningFee * occupiedNightsPerMonth * cleanerPercent;
  const expensesWithCleaner: ExpenseInputs = {
    ...expenses,
    monthlyExtra: expenses.monthlyExtra + cleanerMonthly,
  };

  const monthlyExpensesNoMortgage = calcMonthlyExpenses(expensesWithCleaner, grossMonthlyIncome);
  const monthlyExpensesWithMortgage = monthlyExpensesNoMortgage + Math.abs(mortgagePayment);

  const monthlyNOI = grossMonthlyIncome - monthlyExpensesNoMortgage;
  const yearlyNOI = monthlyNOI * 12;

  const capRate = m.purchasePrice > 0 ? yearlyNOI / m.purchasePrice : 0;
  const monthlyCashflow = grossMonthlyIncome - monthlyExpensesWithMortgage;
  const yearlyCashflow = monthlyCashflow * 12;
  const cashOnCashReturn = totalCapitalNeeded > 0 ? yearlyCashflow / totalCapitalNeeded : 0;

  const meets50PercentRule = grossMonthlyIncome > 0
    ? monthlyExpensesNoMortgage / grossMonthlyIncome <= 0.5
    : false;
  const meets1PercentRule = m.purchasePrice > 0
    ? grossMonthlyIncome >= m.purchasePrice * 0.01
    : false;

  const isProfitable = monthlyCashflow > 0;
  const profitabilityReasons: string[] = [];

  if (monthlyCashflow > 0) {
    profitabilityReasons.push(`Positive monthly cashflow of $${monthlyCashflow.toFixed(0)}`);
  } else {
    profitabilityReasons.push(`Negative cashflow of $${Math.abs(monthlyCashflow).toFixed(0)}/month — assumes ${occupiedNightsPerMonth} occupied nights/month`);
  }
  if (capRate >= 0.06) {
    profitabilityReasons.push(`Strong CAP rate of ${(capRate * 100).toFixed(1)}% at this occupancy`);
  } else {
    profitabilityReasons.push(`CAP rate of ${(capRate * 100).toFixed(1)}% — may need higher occupancy or nightly rate`);
  }
  if (meets1PercentRule) {
    profitabilityReasons.push("Monthly Airbnb revenue exceeds 1% of purchase price");
  } else {
    profitabilityReasons.push(`Airbnb revenue is only ${((grossMonthlyIncome / m.purchasePrice) * 100).toFixed(2)}% of purchase price — below 1% rule`);
  }

  return {
    downPayment,
    mortgage: mortgagePrincipal,
    closingCosts,
    totalCapitalNeeded,
    totalFurnitureCost: furnitureCost,
    mortgagePayment,
    grossMonthlyIncome,
    grossYearlyIncome,
    monthlyExpensesNoMortgage,
    monthlyExpensesWithMortgage,
    monthlyNOI,
    yearlyNOI,
    capRate,
    cashOnCashReturn,
    monthlyCashflow,
    yearlyCashflow,
    meets50PercentRule,
    meets1PercentRule,
    isProfitable,
    profitabilityReasons,
  };
}

export function calcAirbnbArbitrage(inputs: AirbnbArbitrageInputs): AirbnbArbitrageResults {
  const { expenses, damageDeposit, repairCosts, furnitureCost, monthlyRentToLandlord, dailyRate, dailyCleaningFee, occupiedNightsPerMonth } = inputs;

  const totalCapitalNeeded = damageDeposit + repairCosts + furnitureCost;

  const grossMonthlyIncome = (dailyRate + dailyCleaningFee) * occupiedNightsPerMonth;
  const grossYearlyIncome = grossMonthlyIncome * 12;

  const fixedExpenses =
    expenses.monthlyTaxes +
    expenses.monthlyGasElectric +
    expenses.monthlyInternet +
    expenses.monthlyHOA +
    expenses.monthlyWaterSewer +
    expenses.monthlyExtra;

  const monthlyExpensesNoRent = fixedExpenses;
  const monthlyExpensesWithRent = monthlyExpensesNoRent + monthlyRentToLandlord;

  const monthlyNOI = grossMonthlyIncome - monthlyExpensesNoRent;
  const yearlyNOI = monthlyNOI * 12;

  const monthlyProfit = grossMonthlyIncome - monthlyExpensesWithRent;
  const yearlyProfit = monthlyProfit * 12;

  const cashOnCashReturn = totalCapitalNeeded > 0 ? yearlyNOI / totalCapitalNeeded : 0;

  const meets50PercentRule = grossMonthlyIncome > 0
    ? monthlyExpensesNoRent / grossMonthlyIncome <= 0.5
    : false;

  const isProfitable = monthlyProfit > 0;
  const profitabilityReasons: string[] = [];

  if (monthlyProfit > 0) {
    profitabilityReasons.push(`Monthly profit of $${monthlyProfit.toFixed(0)} after paying rent and all expenses`);
  } else {
    profitabilityReasons.push(`Monthly loss of $${Math.abs(monthlyProfit).toFixed(0)} — Airbnb revenue doesn't cover rent + expenses`);
  }

  const revenueToRentRatio = monthlyRentToLandlord > 0 ? grossMonthlyIncome / monthlyRentToLandlord : 0;
  if (revenueToRentRatio >= 2) {
    profitabilityReasons.push(`Revenue is ${revenueToRentRatio.toFixed(1)}x your rent — strong arbitrage spread`);
  } else if (revenueToRentRatio >= 1.5) {
    profitabilityReasons.push(`Revenue is ${revenueToRentRatio.toFixed(1)}x your rent — moderate arbitrage spread`);
  } else {
    profitabilityReasons.push(`Revenue is only ${revenueToRentRatio.toFixed(1)}x your rent — thin arbitrage spread, risky`);
  }

  if (cashOnCashReturn >= 1.0) {
    profitabilityReasons.push(`Exceptional cash-on-cash of ${(cashOnCashReturn * 100).toFixed(0)}% — low capital, high return`);
  } else {
    profitabilityReasons.push(`Cash-on-cash of ${(cashOnCashReturn * 100).toFixed(0)}% on $${totalCapitalNeeded.toLocaleString()} startup capital`);
  }

  profitabilityReasons.push("Note: Verify landlord permits subletting and check local short-term rental bylaws for your city");

  return {
    totalCapitalNeeded,
    grossMonthlyIncome,
    grossYearlyIncome,
    monthlyExpensesNoRent,
    monthlyExpensesWithRent,
    monthlyNOI,
    yearlyNOI,
    cashOnCashReturn,
    monthlyProfit,
    yearlyProfit,
    meets50PercentRule,
    isProfitable,
    profitabilityReasons,
  };
}

export function calcFixAndFlip(inputs: FixAndFlipInputs): FixAndFlipResults {
  const { mortgage: m, expenses, afterRepairValue, monthsUntilFlip } = inputs;

  const downPayment = m.purchasePrice * m.downPaymentPercent;
  const mortgagePrincipal = m.purchasePrice - downPayment;
  const closingCosts = m.purchasePrice * m.closingCostsPercent;
  const totalCapitalNeeded = downPayment + closingCosts + m.repairCosts;
  const mortgagePayment = calcMortgagePayment(mortgagePrincipal, m.interestRate, m.loanTermYears);

  const monthlyHoldingExpenses =
    expenses.monthlyTaxes +
    expenses.monthlyInsurance +
    expenses.monthlyTrash +
    expenses.monthlyGasElectric +
    expenses.monthlyWaterSewer +
    expenses.monthlyHeat +
    expenses.monthlyExtra;

  const totalHoldingExpenses =
    (monthlyHoldingExpenses + Math.abs(mortgagePayment)) * monthsUntilFlip;

  const sellingCosts = afterRepairValue * 0.05; // ~5% realtor/closing costs on sale
  const anticipatedProfit =
    afterRepairValue -
    m.purchasePrice -
    m.repairCosts -
    totalHoldingExpenses -
    sellingCosts;

  const rule70OfARV = afterRepairValue * 0.7;
  const maxOfferForHome = rule70OfARV - m.repairCosts;

  const roi = totalCapitalNeeded > 0 ? anticipatedProfit / totalCapitalNeeded : 0;

  const isProfitable = anticipatedProfit > 0 && m.purchasePrice <= maxOfferForHome;
  const profitabilityReasons: string[] = [];

  if (anticipatedProfit > 0) {
    profitabilityReasons.push(`Anticipated profit of $${anticipatedProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  } else {
    profitabilityReasons.push(`Projected loss of $${Math.abs(anticipatedProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })} — deal doesn't pencil out`);
  }

  if (m.purchasePrice <= maxOfferForHome) {
    profitabilityReasons.push(`Purchase price ($${m.purchasePrice.toLocaleString()}) is within the 70% ARV rule max offer of $${maxOfferForHome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  } else {
    profitabilityReasons.push(`Purchase price ($${m.purchasePrice.toLocaleString()}) exceeds the 70% ARV max offer of $${maxOfferForHome.toLocaleString(undefined, { maximumFractionDigits: 0 })} — overpaying`);
  }

  if (roi >= 0.2) {
    profitabilityReasons.push(`Strong ROI of ${(roi * 100).toFixed(1)}% on capital invested`);
  } else if (roi > 0) {
    profitabilityReasons.push(`Modest ROI of ${(roi * 100).toFixed(1)}% — consider if the risk is worth it`);
  } else {
    profitabilityReasons.push(`Negative ROI of ${(roi * 100).toFixed(1)}%`);
  }

  profitabilityReasons.push(`Holding period: ${monthsUntilFlip} months. Total holding costs: $${totalHoldingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

  return {
    downPayment,
    mortgage: mortgagePrincipal,
    closingCosts,
    totalCapitalNeeded,
    mortgagePayment,
    monthlyHoldingExpenses,
    totalHoldingExpenses,
    anticipatedProfit,
    rule70OfARV,
    maxOfferForHome,
    roi,
    isProfitable,
    profitabilityReasons,
  };
}
