"use client";

import { useEffect, useState } from "react";
import type { PropertyListing, AirbnbArbitrageInputs } from "@/types";
import { calcAirbnbArbitrage } from "@/lib/calculations";
import { EDMONTON_DEFAULTS, getDefaultRent } from "@/lib/defaults";
import MetricCard from "@/components/ui/MetricCard";
import RuleCheck from "@/components/ui/RuleCheck";
import InputField from "@/components/ui/InputField";
import SectionHeader from "@/components/ui/SectionHeader";

function fmt(n: number) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(0)}%`; }

export default function AirbnbArbitrage({ property, externalRent }: { property: PropertyListing; externalRent?: number | null }) {
  const defaultLandlordRent = getDefaultRent(property.bedrooms);

  const [inputs, setInputs] = useState<AirbnbArbitrageInputs>({
    expenses: {
      monthlyTaxes: 200,
      monthlyInsurance: 0,
      monthlyTrash: 0,
      monthlyGasElectric: 120,
      monthlyInternet: 60,
      monthlyHOA: 0,
      monthlyWaterSewer: 0,
      monthlyHeat: 0,
      monthlyLawnSnow: 0,
      monthlyPhoneBill: 0,
      monthlyExtra: 800, // cleaner
      maintenancePercent: 0,
      vacancyPercent: 0,
      managementPercent: 0,
    },
    damageDeposit: EDMONTON_DEFAULTS.arbDamageDeposit,
    repairCosts: EDMONTON_DEFAULTS.arbRepairCosts,
    furnitureCost: EDMONTON_DEFAULTS.arbFurnitureCost,
    monthlyRentToLandlord: defaultLandlordRent,
    dailyRate: EDMONTON_DEFAULTS.airbnbDailyRate,
    dailyCleaningFee: EDMONTON_DEFAULTS.airbnbCleaningFee,
    occupiedNightsPerMonth: EDMONTON_DEFAULTS.airbnbNightsPerMonth,
    additionalGuestFee: 0,
  });
  const [showInputs, setShowInputs] = useState(false);

  // Apply live market rent as the landlord rent assumption
  useEffect(() => {
    if (externalRent) {
      setInputs(p => ({ ...p, monthlyRentToLandlord: externalRent }));
    }
  }, [externalRent]);

  const results = calcAirbnbArbitrage(inputs);

  function setExpense(key: keyof typeof inputs.expenses, val: number) {
    setInputs(p => ({ ...p, expenses: { ...p.expenses, [key]: val } }));
  }

  const profitSentiment = results.monthlyProfit > 200 ? "positive" : results.monthlyProfit > 0 ? "warning" : "negative";
  const cocSentiment = results.cashOnCashReturn >= 1.0 ? "positive" : results.cashOnCashReturn > 0.5 ? "warning" : "negative";

  return (
    <div className="space-y-6">
      {/* Context Banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-sm text-violet-800 font-semibold">💡 Airbnb Arbitrage — No Property Purchase Required</p>
        <p className="text-sm text-violet-600 mt-1">You lease this property from the landlord and relist it on Airbnb at a higher nightly rate. Startup capital is low, but you must verify the landlord permits subletting and check Edmonton&apos;s short-term rental bylaws.</p>
      </div>

      <div className={`rounded-2xl p-5 flex items-center gap-4 ${results.isProfitable ? "bg-emerald-600" : "bg-red-600"}`}>
        <div className="text-4xl">{results.isProfitable ? "✅" : "❌"}</div>
        <div>
          <h2 className="text-white text-xl font-bold">{results.isProfitable ? "Likely Profitable" : "Likely Not Profitable"}</h2>
          <p className="text-white/80 text-sm">Paying ${inputs.monthlyRentToLandlord.toLocaleString()}/mo to landlord, earning ${inputs.dailyRate}/night × {inputs.occupiedNightsPerMonth} nights</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Monthly Profit" value={fmt(results.monthlyProfit)} sub="after rent + all expenses" sentiment={profitSentiment} large />
        <MetricCard label="Yearly Profit" value={fmt(results.yearlyProfit)} sub="at current occupancy" sentiment={profitSentiment} />
        <MetricCard label="Cash-on-Cash" value={fmtPct(results.cashOnCashReturn)} sub={`on ${fmt(results.totalCapitalNeeded)} startup`} sentiment={cocSentiment} />
        <MetricCard label="Startup Capital" value={fmt(results.totalCapitalNeeded)} sub="deposit + furniture + repairs" sentiment="neutral" />
      </div>

      {/* Revenue vs Rent spread */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Arbitrage Spread</h4>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">You pay landlord</p>
            <p className="text-2xl font-bold text-red-600">{fmt(inputs.monthlyRentToLandlord)}<span className="text-sm">/mo</span></p>
          </div>
          <div className="text-2xl text-slate-300 font-light">→</div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Airbnb revenue</p>
            <p className="text-2xl font-bold text-emerald-600">{fmt(results.grossMonthlyIncome)}<span className="text-sm">/mo</span></p>
          </div>
          <div className="text-2xl text-slate-300 font-light">−</div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Operating costs</p>
            <p className="text-2xl font-bold text-slate-700">{fmt(results.monthlyExpensesNoRent)}<span className="text-sm">/mo</span></p>
          </div>
          <div className="text-2xl text-slate-300 font-light">=</div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Net profit</p>
            <p className={`text-2xl font-bold ${results.monthlyProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(results.monthlyProfit)}<span className="text-sm">/mo</span></p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Checks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <RuleCheck label="50% Rule (excl. rent)" passes={results.meets50PercentRule} description={`Operating expenses = ${fmtPct(results.monthlyExpensesNoRent / Math.max(results.grossMonthlyIncome, 1))} of revenue`} />
          <RuleCheck label="Revenue > 2× Rent" passes={results.grossMonthlyIncome >= inputs.monthlyRentToLandlord * 2} description={`Revenue is ${(results.grossMonthlyIncome / Math.max(inputs.monthlyRentToLandlord, 1)).toFixed(1)}× rent (aim for 2×+)`} />
          <RuleCheck label="Monthly Profit > $0" passes={results.monthlyProfit > 0} description="Airbnb revenue covers rent + expenses" />
          <RuleCheck label="Strong CoC Return" passes={results.cashOnCashReturn >= 1.0} description="100%+ CoC is common for arbitrage vs ownership" />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-amber-800 mb-2">⚠️ Important Considerations</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>→ Verify the landlord explicitly permits short-term subletting in the lease</li>
          <li>→ Edmonton requires short-term rental operators to hold a business licence</li>
          <li>→ If renting a condo, check strata bylaws — many prohibit short-term rentals</li>
          <li>→ Seasonality risk: Edmonton Airbnb peaks July–Sept, slowest Nov–Feb</li>
        </ul>
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

      <button onClick={() => setShowInputs(v => !v)} className="w-full text-sm text-blue-600 font-semibold py-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors">
        {showInputs ? "▲ Hide" : "▼ Adjust"} Assumptions
      </button>

      {showInputs && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
          <div>
            <SectionHeader title="Startup Costs (One-Time)" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Damage Deposit" value={inputs.damageDeposit} onChange={v => setInputs(p => ({ ...p, damageDeposit: v }))} prefix="$" step={500} hint="Usually first + last month rent" />
              <InputField label="Furniture & Setup" value={inputs.furnitureCost} onChange={v => setInputs(p => ({ ...p, furnitureCost: v }))} prefix="$" step={500} hint="Quality furniture = better reviews" />
              <InputField label="Initial Repairs" value={inputs.repairCosts} onChange={v => setInputs(p => ({ ...p, repairCosts: v }))} prefix="$" step={250} />
            </div>
          </div>
          <div>
            <SectionHeader title="Rent & Airbnb Revenue" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Monthly Rent to Landlord" value={inputs.monthlyRentToLandlord} onChange={v => setInputs(p => ({ ...p, monthlyRentToLandlord: v }))} prefix="$" step={50} hint="Your lease amount" />
              <InputField label="Nightly Rate on Airbnb" value={inputs.dailyRate} onChange={v => setInputs(p => ({ ...p, dailyRate: v }))} prefix="$" step={10} hint="Check Edmonton comps" />
              <InputField label="Cleaning Fee" value={inputs.dailyCleaningFee} onChange={v => setInputs(p => ({ ...p, dailyCleaningFee: v }))} prefix="$" step={5} hint="Per stay" />
              <InputField label="Nights Booked/Month" value={inputs.occupiedNightsPerMonth} onChange={v => setInputs(p => ({ ...p, occupiedNightsPerMonth: v }))} step={1} hint="18 = 60% occupancy" />
            </div>
          </div>
          <div>
            <SectionHeader title="Monthly Operating Expenses" hint="Utility costs you cover as the tenant" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Property Tax (if any)" value={inputs.expenses.monthlyTaxes} onChange={v => setExpense("monthlyTaxes", v)} prefix="$" step={25} />
              <InputField label="Gas/Electric" value={inputs.expenses.monthlyGasElectric} onChange={v => setExpense("monthlyGasElectric", v)} prefix="$" step={10} />
              <InputField label="Internet" value={inputs.expenses.monthlyInternet} onChange={v => setExpense("monthlyInternet", v)} prefix="$" step={10} />
              <InputField label="Cleaner Cost/Month" value={inputs.expenses.monthlyExtra} onChange={v => setExpense("monthlyExtra", v)} prefix="$" step={50} hint="Cleaner per turnover × stays" />
              <InputField label="Water/Sewer" value={inputs.expenses.monthlyWaterSewer} onChange={v => setExpense("monthlyWaterSewer", v)} prefix="$" step={10} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
