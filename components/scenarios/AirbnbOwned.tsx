"use client";

import { useEffect, useState } from "react";
import type { PropertyListing, AirbnbOwnedInputs } from "@/types";
import { calcAirbnbOwned } from "@/lib/calculations";
import { getDefaultMortgageInputs, getDefaultExpenses, getCityDefaults } from "@/lib/defaults";
import MetricCard from "@/components/ui/MetricCard";
import RuleCheck from "@/components/ui/RuleCheck";
import InputField from "@/components/ui/InputField";
import SectionHeader from "@/components/ui/SectionHeader";

function fmt(n: number) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default function AirbnbOwned({ property, externalRent, externalNightly }: { property: PropertyListing; externalRent?: number | null; externalNightly?: number | null }) {
  const cityDef = getCityDefaults(property.city, property.province);
  const [inputs, setInputs] = useState<AirbnbOwnedInputs>({
    mortgage: getDefaultMortgageInputs(property.price),
    expenses: getDefaultExpenses(property.price, property.assessedValue, property.city, property.province),
    furnitureCost: cityDef.airbnbFurnitureCost,
    dailyRate: cityDef.airbnbDailyRate,
    dailyCleaningFee: cityDef.airbnbCleaningFee,
    occupiedNightsPerMonth: cityDef.airbnbNightsPerMonth,
    additionalGuestFee: 0,
    cleanerPercent: cityDef.airbnbCleanerPercent,
  });
  const [showInputs, setShowInputs] = useState(false);

  // Apply live Airbnb nightly rate from STRComps (takes priority)
  useEffect(() => {
    if (externalNightly) {
      setInputs(p => ({ ...p, dailyRate: externalNightly }));
    }
  }, [externalNightly]);

  // Fallback: back-calculate from LTR market rent if no Airbnb comp available
  useEffect(() => {
    if (externalRent && !externalNightly) {
      const suggestedNightly = Math.round(externalRent / (cityDef.airbnbNightsPerMonth * 0.7));
      setInputs(p => ({ ...p, dailyRate: suggestedNightly }));
    }
  }, [externalRent, externalNightly, cityDef.airbnbNightsPerMonth]);

  const results = calcAirbnbOwned(inputs);

  function setMortgage(key: keyof typeof inputs.mortgage, val: number) {
    setInputs(p => ({ ...p, mortgage: { ...p.mortgage, [key]: val } }));
  }
  function setExpense(key: keyof typeof inputs.expenses, val: number) {
    setInputs(p => ({ ...p, expenses: { ...p.expenses, [key]: val } }));
  }

  const cashflowSentiment = results.monthlyCashflow > 100 ? "positive" : results.monthlyCashflow > 0 ? "warning" : "negative";
  const capSentiment = results.capRate >= 0.06 ? "positive" : results.capRate >= 0.04 ? "warning" : "negative";
  const cocSentiment = results.cashOnCashReturn >= 0.08 ? "positive" : results.cashOnCashReturn > 0 ? "warning" : "negative";

  const monthlyRevenue = (inputs.dailyRate + inputs.dailyCleaningFee) * inputs.occupiedNightsPerMonth;
  const annualRevenue = monthlyRevenue * 12;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 flex items-center gap-4 ${results.isProfitable ? "bg-emerald-600" : "bg-red-600"}`}>
        <div className="text-4xl">{results.isProfitable ? "✅" : "❌"}</div>
        <div>
          <h2 className="text-white text-xl font-bold">{results.isProfitable ? "Likely Profitable" : "Likely Not Profitable"}</h2>
          <p className="text-white/80 text-sm">Based on {inputs.occupiedNightsPerMonth} occupied nights/month at ${inputs.dailyRate}/night</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Monthly Cashflow" value={fmt(results.monthlyCashflow)} sub="after all expenses + mortgage" sentiment={cashflowSentiment} large />
        <MetricCard label="CAP Rate" value={fmtPct(results.capRate)} sub="at current occupancy" sentiment={capSentiment} />
        <MetricCard label="Cash-on-Cash" value={fmtPct(results.cashOnCashReturn)} sub="target ≥ 8%" sentiment={cocSentiment} />
        <MetricCard label="Capital Needed" value={fmt(results.totalCapitalNeeded)} sub="incl. furniture setup" sentiment="neutral" />
      </div>

      {/* Airbnb Revenue Breakdown */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 tracking-wider">Airbnb Revenue Model</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-blue-900">
          <div><p className="text-xs opacity-70">Nightly Rate</p><p className="font-bold">${inputs.dailyRate}</p></div>
          <div><p className="text-xs opacity-70">Cleaning Fee</p><p className="font-bold">${inputs.dailyCleaningFee}/stay</p></div>
          <div><p className="text-xs opacity-70">Nights/Month</p><p className="font-bold">{inputs.occupiedNightsPerMonth} ({Math.round(inputs.occupiedNightsPerMonth / 30 * 100)}% occupancy)</p></div>
          <div><p className="text-xs opacity-70">Gross Revenue</p><p className="font-bold">{fmt(monthlyRevenue)}/mo</p></div>
        </div>
        <p className="text-xs text-blue-600 mt-3 opacity-80">Annual projected revenue: {fmt(annualRevenue)} — verify against AirDNA or similar tool for {property.city} comps</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Investment Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <RuleCheck label="1% Rule" passes={results.meets1PercentRule} description={`Monthly revenue ${fmt(results.grossMonthlyIncome)} vs 1% of price ${fmt(property.price * 0.01)}`} />
          <RuleCheck label="50% Rule" passes={results.meets50PercentRule} description={`Operating costs = ${fmtPct(results.monthlyExpensesNoMortgage / Math.max(results.grossMonthlyIncome, 1))} of revenue`} />
          <RuleCheck label="Positive Cashflow" passes={results.monthlyCashflow > 0} description={`${fmt(results.monthlyCashflow)}/month after mortgage`} />
          <RuleCheck label="CAP Rate ≥ 5%" passes={results.capRate >= 0.05} description="Measures return independent of financing" />
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Monthly Breakdown</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Airbnb Revenue</span><span className="font-semibold">{fmt(results.grossMonthlyIncome)}</span></div>
            <div className="flex justify-between text-slate-500"><span>- Operating Expenses</span><span>{fmt(results.monthlyExpensesNoMortgage)}</span></div>
            <div className="flex justify-between text-slate-500"><span>- Mortgage P&I</span><span>{fmt(Math.abs(results.mortgagePayment))}</span></div>
            <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Net Cashflow</span><span className={results.monthlyCashflow >= 0 ? "text-emerald-700" : "text-red-700"}>{fmt(results.monthlyCashflow)}</span></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Capital Required</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Down Payment</span><span>{fmt(results.downPayment)}</span></div>
            <div className="flex justify-between"><span>Closing Costs</span><span>{fmt(results.closingCosts)}</span></div>
            <div className="flex justify-between"><span>Repairs</span><span>{fmt(inputs.mortgage.repairCosts)}</span></div>
            <div className="flex justify-between"><span>Furniture & Setup</span><span>{fmt(inputs.furnitureCost)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Capital</span><span>{fmt(results.totalCapitalNeeded)}</span></div>
          </div>
        </div>
      </div>

      <button onClick={() => setShowInputs(v => !v)} className="w-full text-sm text-blue-600 font-semibold py-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors print:hidden">
        {showInputs ? "▲ Hide" : "▼ Adjust"} Assumptions
      </button>

      {showInputs && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
          <div>
            <SectionHeader title="Purchase & Mortgage" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Purchase Price" value={inputs.mortgage.purchasePrice} onChange={v => setMortgage("purchasePrice", v)} prefix="$" step={5000} />
              <InputField label="Down Payment" value={inputs.mortgage.downPaymentPercent} onChange={v => setMortgage("downPaymentPercent", v)} isPercent suffix="%" />
              <InputField label="Interest Rate" value={inputs.mortgage.interestRate} onChange={v => setMortgage("interestRate", v)} isPercent suffix="%" />
              <InputField label="Loan Term" value={inputs.mortgage.loanTermYears} onChange={v => setMortgage("loanTermYears", v)} suffix="yrs" />
              <InputField label="Closing Costs %" value={inputs.mortgage.closingCostsPercent} onChange={v => setMortgage("closingCostsPercent", v)} isPercent suffix="%" />
              <InputField label="Repair Costs" value={inputs.mortgage.repairCosts} onChange={v => setMortgage("repairCosts", v)} prefix="$" step={1000} />
            </div>
          </div>
          <div>
            <SectionHeader title="Airbnb Revenue" hint="Adjust based on comparable listings in the area" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Nightly Rate" value={inputs.dailyRate} onChange={v => setInputs(p => ({ ...p, dailyRate: v }))} prefix="$" step={10} hint="Check Airbnb comps" />
              <InputField label="Cleaning Fee" value={inputs.dailyCleaningFee} onChange={v => setInputs(p => ({ ...p, dailyCleaningFee: v }))} prefix="$" step={5} hint="Per stay" />
              <InputField label="Nights Booked/Month" value={inputs.occupiedNightsPerMonth} onChange={v => setInputs(p => ({ ...p, occupiedNightsPerMonth: v }))} step={1} hint="18 = ~60% occupancy" />
              <InputField label="Furniture & Setup" value={inputs.furnitureCost} onChange={v => setInputs(p => ({ ...p, furnitureCost: v }))} prefix="$" step={500} />
              <InputField label="Cleaner Cost %" value={inputs.cleanerPercent} onChange={v => setInputs(p => ({ ...p, cleanerPercent: v }))} isPercent suffix="%" hint="% of cleaning revenue" />
            </div>
          </div>
          <div>
            <SectionHeader title="Monthly Fixed Expenses" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Property Tax" value={inputs.expenses.monthlyTaxes} onChange={v => setExpense("monthlyTaxes", v)} prefix="$" step={25} />
              <InputField label="Insurance" value={inputs.expenses.monthlyInsurance} onChange={v => setExpense("monthlyInsurance", v)} prefix="$" step={25} hint="Short-term rental insurance is higher" />
              <InputField label="HOA / Condo Fees" value={inputs.expenses.monthlyHOA} onChange={v => setExpense("monthlyHOA", v)} prefix="$" step={25} hint="Check if STR allowed" />
              <InputField label="Gas/Electric" value={inputs.expenses.monthlyGasElectric} onChange={v => setExpense("monthlyGasElectric", v)} prefix="$" step={25} />
              <InputField label="Water/Sewer" value={inputs.expenses.monthlyWaterSewer} onChange={v => setExpense("monthlyWaterSewer", v)} prefix="$" step={10} />
              <InputField label="Internet" value={inputs.expenses.monthlyInternet} onChange={v => setExpense("monthlyInternet", v)} prefix="$" step={10} />
            </div>
          </div>
          <div>
            <SectionHeader title="Variable Rates" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Maintenance" value={inputs.expenses.maintenancePercent} onChange={v => setExpense("maintenancePercent", v)} isPercent suffix="%" hint="Higher for STR (~10%)" />
              <InputField label="Vacancy Buffer" value={inputs.expenses.vacancyPercent} onChange={v => setExpense("vacancyPercent", v)} isPercent suffix="%" />
              <InputField label="Mgmt / Platform Fee" value={inputs.expenses.managementPercent} onChange={v => setExpense("managementPercent", v)} isPercent suffix="%" hint="Airbnb takes ~3%, cohost 15–20%" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
