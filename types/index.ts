export interface PropertyListing {
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft?: number;
  propertyType: string;
  city: string;
  province: string;
  mlsNumber?: string;
  description?: string;
  assessedValue?: number;
  annualTaxLevy?: number;       // actual billed tax (from dkk9-cj3x) or assessed × mill rate
  taxSource?: "billed" | "estimated";
}

export interface MortgageInputs {
  purchasePrice: number;
  downPaymentPercent: number;
  closingCostsPercent: number;
  repairCosts: number;
  loanTermYears: number;
  interestRate: number;
}

export interface ExpenseInputs {
  monthlyTaxes: number;
  monthlyInsurance: number;
  monthlyTrash: number;
  monthlyGasElectric: number;
  monthlyInternet: number;
  monthlyHOA: number;
  monthlyWaterSewer: number;
  monthlyHeat: number;
  monthlyLawnSnow: number;
  monthlyPhoneBill: number;
  monthlyExtra: number;
  maintenancePercent: number;
  vacancyPercent: number;
  managementPercent: number;
}

export interface LongTermRentalInputs {
  mortgage: MortgageInputs;
  expenses: ExpenseInputs;
  monthlyRents: number[];
  laundryRevenue: number;
  additionalRevenue: number;
}

export interface AirbnbOwnedInputs {
  mortgage: MortgageInputs;
  expenses: ExpenseInputs;
  furnitureCost: number;
  dailyRate: number;
  dailyCleaningFee: number;
  occupiedNightsPerMonth: number;
  additionalGuestFee: number;
  cleanerPercent: number;
}

export interface AirbnbArbitrageInputs {
  expenses: ExpenseInputs;
  damageDeposit: number;
  repairCosts: number;
  furnitureCost: number;
  monthlyRentToLandlord: number;
  dailyRate: number;
  dailyCleaningFee: number;
  occupiedNightsPerMonth: number;
  additionalGuestFee: number;
}

export interface FixAndFlipInputs {
  mortgage: MortgageInputs;
  expenses: Omit<ExpenseInputs, 'maintenancePercent' | 'vacancyPercent' | 'managementPercent'>;
  afterRepairValue: number;
  monthsUntilFlip: number;
}

export interface LongTermRentalResults {
  downPayment: number;
  mortgage: number;
  closingCosts: number;
  totalCapitalNeeded: number;
  mortgagePayment: number;
  grossMonthlyIncome: number;
  grossYearlyIncome: number;
  monthlyExpensesNoMortgage: number;
  monthlyExpensesWithMortgage: number;
  monthlyNOI: number;
  yearlyNOI: number;
  capRate: number;
  cashOnCashReturn: number;
  monthlyCashflow: number;
  yearlyCashflow: number;
  meets50PercentRule: boolean;
  meets1PercentRule: boolean;
  isProfitable: boolean;
  profitabilityReasons: string[];
}

export interface AirbnbOwnedResults extends LongTermRentalResults {
  totalFurnitureCost: number;
}

export interface AirbnbArbitrageResults {
  totalCapitalNeeded: number;
  grossMonthlyIncome: number;
  grossYearlyIncome: number;
  monthlyExpensesNoRent: number;
  monthlyExpensesWithRent: number;
  monthlyNOI: number;
  yearlyNOI: number;
  cashOnCashReturn: number;
  monthlyProfit: number;
  yearlyProfit: number;
  meets50PercentRule: boolean;
  isProfitable: boolean;
  profitabilityReasons: string[];
}

export interface SaleRecord {
  date: string;
  price: number;
  type?: string;
}

export interface SalesHistoryResult {
  sales: SaleRecord[];
  hdEstimate: number | null;
  address: string;
}

export interface FixAndFlipResults {
  downPayment: number;
  mortgage: number;
  closingCosts: number;
  totalCapitalNeeded: number;
  mortgagePayment: number;
  monthlyHoldingExpenses: number;
  totalHoldingExpenses: number;
  anticipatedProfit: number;
  rule70OfARV: number;
  maxOfferForHome: number;
  roi: number;
  isProfitable: boolean;
  profitabilityReasons: string[];
}
