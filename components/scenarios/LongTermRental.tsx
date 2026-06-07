"use client";

import { useEffect, useState } from "react";
import type { PropertyListing } from "@/types";
import type { LongTermRentalInputs } from "@/types";
import { calcLongTermRental } from "@/lib/calculations";
import { getDefaultMortgageInputs, getDefaultExpenses, getDefaultRent } from "@/lib/defaults";
import MetricCard from "@/components/ui/MetricCard";
import RuleCheck from "@/components/ui/RuleCheck";
import InputField from "@/components/ui/InputField";
import SectionHeader from "@/components/ui/SectionHeader";

function fmt(n: number, isNeg = false) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  return n < 0 || isNeg ? `(${s})` : s;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default function LongTermRental({ property, externalRent }: { property: PropertyListing; externalRent?: number | null }) {
  const defaultRent = getDefaultRent(property.bedrooms, property.city, property.province);

  const [inputs, setInputs] = useState<LongTermRentalInputs>({
    mortgage: getDefaultMortgageInputs(property.price),
    expenses: getDefaultExpenses(property.price, property.assessedValue, property.city, property.province),
    monthlyRents: [defaultRent],
    laundryRevenue: 0,
    additionalRevenue: 0,
  });

  // Apply market rent from RentalComps whenever it changes — preserve unit count
  useEffect(() => {
    if (externalRent) {
      setInputs(p => ({ ...p, monthlyRents: p.monthlyRents.map(() => externalRent) }));
    }
  }, [externalRent]);

  const [showInputs, setShowInputs] = useState(false);

  const results = calcLongTermRental(inputs);

  function setMortgage(key: keyof typeof inputs.mortgage, val: number) {
    setInputs(p => ({ ...p, mortgage: { ...p.mortgage, [key]: val } }));
  }
  function setExpense(key: keyof typeof inputs.expenses, val: number) {
    setInputs(p => ({ ...p, expenses: { ...p.expenses, [key]: val } }));
  }
  function setRent(idx: number, val: number) {
    setInputs(p => {
      const rents = [...p.monthlyRents];
      rents[idx] = val;
      return { ...p, monthlyRents: rents };
    });
  }

  const cashflowSentiment = results.monthlyCashflow > 100 ? "positive" : results.monthlyCashflow > 0 ? "warning" : "negative";
  const capSentiment = results.capRate >= 0.06 ? "positive" : results.capRate >= 0.04 ? "warning" : "negative";
  const cocSentiment = results.cashOnCashReturn >= 0.08 ? "positive" : results.cashOnCashReturn > 0 ? "warning" : "negative";

  return (
    <div className="space-y-6">
      {/* Verdict Banner */}
      <div className={`rounded-2xl p-5 flex items-center gap-4 ${results.isProfitable ? "bg-emerald-600" : "bg-red-600"}`}>
        <div className="text-4xl">{results.isProfitable ? "✅" : "❌"}</div>
        <div>
          <h2 className="text-white text-xl font-bold">{results.isProfitable ? "Likely Profitable" : "Likely Not Profitable"}</h2>
          <p className="text-white/80 text-sm">Based on your inputs — adjust assumptions to refine this analysis</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Monthly Cashflow" value={fmt(results.monthlyCashflow)} sub="after all expenses + mortgage" sentiment={cashflowSentiment} large />
        <MetricCard label="CAP Rate" value={fmtPct(results.capRate)} sub="target ≥ 5–6% in Canada" sentiment={capSentiment} />
        <MetricCard label="Cash-on-Cash" value={fmtPct(results.cashOnCashReturn)} sub="target ≥ 8%" sentiment={cocSentiment} />
        <MetricCard label="Capital Needed" value={fmt(results.totalCapitalNeeded)} sub={`Down + closing + repairs`} sentiment="neutral" />
      </div>

      {/* Rules */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Investment Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <RuleCheck label="1% Rule" passes={results.meets1PercentRule} description={`Monthly rent ${fmt(results.grossMonthlyIncome)} vs 1% of price ${fmt(property.price * 0.01)}`} />
          <RuleCheck label="50% Rule" passes={results.meets50PercentRule} description={`Operating expenses = ${fmtPct(results.monthlyExpensesNoMortgage / results.grossMonthlyIncome)} of income (target ≤ 50%)`} />
          <RuleCheck label="Positive Cashflow" passes={results.monthlyCashflow > 0} description={`${fmt(results.monthlyCashflow)}/month after mortgage`} />
          <RuleCheck label="CAP Rate ≥ 5%" passes={results.capRate >= 0.05} description={`NOI ${fmt(results.yearlyNOI)}/yr ÷ purchase price`} />
        </div>
      </div>

      {/* Why Summary */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Why this verdict?</h3>
        <ul className="space-y-1.5">
          {results.profitabilityReasons.map((r, i) => (
            <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">→</span> {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Income / Expense Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Monthly Income</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Gross Rent</span><span className="font-semibold">{fmt(results.grossMonthlyIncome)}</span></div>
            <div className="flex justify-between text-slate-500"><span>- Operating Expenses</span><span>{fmt(results.monthlyExpensesNoMortgage)}</span></div>
            <div className="flex justify-between text-slate-500"><span>- Mortgage P&I</span><span>{fmt(Math.abs(results.mortgagePayment))}</span></div>
            <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Net Cashflow</span><span className={results.monthlyCashflow >= 0 ? "text-emerald-700" : "text-red-700"}>{fmt(results.monthlyCashflow)}</span></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Deal Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Purchase Price</span><span className="font-semibold">{fmt(inputs.mortgage.purchasePrice)}</span></div>
            <div className="flex justify-between"><span>Down Payment ({fmtPct(inputs.mortgage.downPaymentPercent)})</span><span>{fmt(results.downPayment)}</span></div>
            <div className="flex justify-between"><span>Closing Costs</span><span>{fmt(results.closingCosts)}</span></div>
            <div className="flex justify-between"><span>Repairs</span><span>{fmt(inputs.mortgage.repairCosts)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Capital Needed</span><span>{fmt(results.totalCapitalNeeded)}</span></div>
            <div className="flex justify-between text-slate-500 text-xs"><span>Annual NOI</span><span>{fmt(results.yearlyNOI)}</span></div>
            <div className="flex justify-between text-slate-500 text-xs"><span>Annual Cashflow</span><span className={results.yearlyCashflow >= 0 ? "text-emerald-600" : "text-red-600"}>{fmt(results.yearlyCashflow)}</span></div>
          </div>
        </div>
      </div>

      {/* Adjust Inputs Toggle */}
      <button onClick={() => setShowInputs(v => !v)} className="w-full text-sm text-blue-600 font-semibold py-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors print:hidden">
        {showInputs ? "▲ Hide" : "▼ Adjust"} Assumptions
      </button>

      {showInputs && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
          <div>
            <SectionHeader title="Purchase & Mortgage" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Purchase Price" value={inputs.mortgage.purchasePrice} onChange={v => setMortgage("purchasePrice", v)} prefix="$" step={5000} hint="From MLS listing" />
              <InputField label="Down Payment" value={inputs.mortgage.downPaymentPercent} onChange={v => setMortgage("downPaymentPercent", v)} isPercent suffix="%" hint="Min 20% for investment" />
              <InputField label="Interest Rate" value={inputs.mortgage.interestRate} onChange={v => setMortgage("interestRate", v)} isPercent suffix="%" hint="Current ~5.5% in Canada" />
              <InputField label="Loan Term" value={inputs.mortgage.loanTermYears} onChange={v => setMortgage("loanTermYears", v)} suffix="yrs" hint="Max 25 yrs in Canada" />
              <InputField label="Closing Costs" value={inputs.mortgage.closingCostsPercent} onChange={v => setMortgage("closingCostsPercent", v)} isPercent suffix="%" hint="Typically ~2%" />
              <InputField label="Repair Costs" value={inputs.mortgage.repairCosts} onChange={v => setMortgage("repairCosts", v)} prefix="$" step={1000} />
            </div>
          </div>
          <div>
            <SectionHeader title="Monthly Rent" hint="Enter rent per unit. Add units if multi-family." />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {inputs.monthlyRents.map((rent, i) => (
                <InputField key={i} label={`Unit ${i + 1} Rent`} value={rent} onChange={v => setRent(i, v)} prefix="$" step={50} />
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setInputs(p => ({ ...p, monthlyRents: [...p.monthlyRents, 0] }))} className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50">+ Add Unit</button>
              {inputs.monthlyRents.length > 1 && (
                <button onClick={() => setInputs(p => ({ ...p, monthlyRents: p.monthlyRents.slice(0, -1) }))} className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">− Remove Unit</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <InputField label="Laundry Revenue" value={inputs.laundryRevenue} onChange={v => setInputs(p => ({ ...p, laundryRevenue: v }))} prefix="$" step={25} hint="Monthly" />
              <InputField label="Additional Revenue" value={inputs.additionalRevenue} onChange={v => setInputs(p => ({ ...p, additionalRevenue: v }))} prefix="$" step={25} hint="Parking, storage, etc." />
            </div>
          </div>
          <div>
            <SectionHeader title="Monthly Fixed Expenses" hint="Enter $0 if included in rent or not applicable" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Property Tax" value={inputs.expenses.monthlyTaxes} onChange={v => setExpense("monthlyTaxes", v)} prefix="$" step={25} hint="Based on local mill rate" />
              <InputField label="Insurance" value={inputs.expenses.monthlyInsurance} onChange={v => setExpense("monthlyInsurance", v)} prefix="$" step={25} />
              <InputField label="HOA / Condo Fees" value={inputs.expenses.monthlyHOA} onChange={v => setExpense("monthlyHOA", v)} prefix="$" step={25} />
              <InputField label="Water/Sewer" value={inputs.expenses.monthlyWaterSewer} onChange={v => setExpense("monthlyWaterSewer", v)} prefix="$" step={10} />
              <InputField label="Gas/Electric" value={inputs.expenses.monthlyGasElectric} onChange={v => setExpense("monthlyGasElectric", v)} prefix="$" step={10} />
              <InputField label="Lawn/Snow" value={inputs.expenses.monthlyLawnSnow} onChange={v => setExpense("monthlyLawnSnow", v)} prefix="$" step={25} />
            </div>
          </div>
          <div>
            <SectionHeader title="Variable Expense Rates" hint="Calculated as % of gross monthly income" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Maintenance" value={inputs.expenses.maintenancePercent} onChange={v => setExpense("maintenancePercent", v)} isPercent suffix="%" hint="Typically 8–10%" />
              <InputField label="Vacancy" value={inputs.expenses.vacancyPercent} onChange={v => setExpense("vacancyPercent", v)} isPercent suffix="%" hint="Typically 5–8%" />
              <InputField label="Property Mgmt" value={inputs.expenses.managementPercent} onChange={v => setExpense("managementPercent", v)} isPercent suffix="%" hint="8–10% if using a manager" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
