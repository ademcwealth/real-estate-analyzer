"use client";

import { useState } from "react";
import type { PropertyListing, FixAndFlipInputs } from "@/types";
import { calcFixAndFlip } from "@/lib/calculations";
import { getDefaultMortgageInputs, getDefaultExpenses, FLIP_DEFAULTS } from "@/lib/defaults";
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

export default function FixAndFlip({ property }: { property: PropertyListing }) {
  const defaultARV = Math.round(property.price * FLIP_DEFAULTS.flipARVMultiplier);

  const [inputs, setInputs] = useState<FixAndFlipInputs>({
    mortgage: {
      ...getDefaultMortgageInputs(property.price),
      repairCosts: FLIP_DEFAULTS.flipRepairCosts,
      interestRate: 0.08,
      loanTermYears: 1,
    },
    expenses: (() => {
      const e = getDefaultExpenses(property.price, property.assessedValue, property.city, property.province);
      return {
        monthlyTaxes: e.monthlyTaxes,
        monthlyInsurance: e.monthlyInsurance,
        monthlyTrash: 400,
        monthlyGasElectric: 400,
        monthlyInternet: 0,
        monthlyHOA: e.monthlyHOA,
        monthlyWaterSewer: 200,
        monthlyHeat: 200,
        monthlyLawnSnow: 0,
        monthlyPhoneBill: 0,
        monthlyExtra: 0,
      };
    })(),
    afterRepairValue: defaultARV,
    monthsUntilFlip: FLIP_DEFAULTS.flipMonthsHolding,
  });
  const [showInputs, setShowInputs] = useState(false);

  const results = calcFixAndFlip(inputs);

  function setMortgage(key: keyof typeof inputs.mortgage, val: number) {
    setInputs(p => ({ ...p, mortgage: { ...p.mortgage, [key]: val } }));
  }
  function setExpense(key: keyof typeof inputs.expenses, val: number) {
    setInputs(p => ({ ...p, expenses: { ...p.expenses, [key]: val } }));
  }

  const profitSentiment = results.anticipatedProfit > 30000 ? "positive" : results.anticipatedProfit > 0 ? "warning" : "negative";
  const roiSentiment = results.roi >= 0.2 ? "positive" : results.roi > 0 ? "warning" : "negative";

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 flex items-center gap-4 ${results.isProfitable ? "bg-emerald-600" : "bg-red-600"}`}>
        <div className="text-4xl">{results.isProfitable ? "✅" : "❌"}</div>
        <div>
          <h2 className="text-white text-xl font-bold">{results.isProfitable ? "Deal Pencils Out" : "Deal Doesn't Pencil Out"}</h2>
          <p className="text-white/80 text-sm">Based on {inputs.monthsUntilFlip}-month hold, selling at {fmt(inputs.afterRepairValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Anticipated Profit" value={fmt(results.anticipatedProfit)} sub="after all costs + selling" sentiment={profitSentiment} large />
        <MetricCard label="ROI" value={fmtPct(results.roi)} sub="on capital invested" sentiment={roiSentiment} />
        <MetricCard label="Max Offer (70% Rule)" value={fmt(results.maxOfferForHome)} sub="70% ARV minus repairs" sentiment={inputs.mortgage.purchasePrice <= results.maxOfferForHome ? "positive" : "negative"} />
        <MetricCard label="Capital Needed" value={fmt(results.totalCapitalNeeded)} sub="down + closing + repairs" sentiment="neutral" />
      </div>

      {/* ARV Model */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-orange-600 uppercase mb-3 tracking-wider">Flip Economics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-orange-900">
          <div><p className="text-xs opacity-70">Buy Price</p><p className="font-bold">{fmt(inputs.mortgage.purchasePrice)}</p></div>
          <div><p className="text-xs opacity-70">Rehab Budget</p><p className="font-bold">{fmt(inputs.mortgage.repairCosts)}</p></div>
          <div><p className="text-xs opacity-70">ARV (Sell Price)</p><p className="font-bold">{fmt(inputs.afterRepairValue)}</p></div>
          <div><p className="text-xs opacity-70">Hold Period</p><p className="font-bold">{inputs.monthsUntilFlip} months</p></div>
        </div>
        <div className="mt-3 pt-3 border-t border-orange-200 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-orange-900">
          <div><p className="text-xs opacity-70">Total Holding Costs</p><p className="font-bold">{fmt(results.totalHoldingExpenses)}</p></div>
          <div><p className="text-xs opacity-70">Selling Costs (~5%)</p><p className="font-bold">{fmt(inputs.afterRepairValue * 0.05)}</p></div>
          <div><p className="text-xs opacity-70">Net Profit</p><p className={`font-bold ${results.anticipatedProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(results.anticipatedProfit)}</p></div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Investment Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <RuleCheck label="70% ARV Rule" passes={inputs.mortgage.purchasePrice <= results.maxOfferForHome} description={`Max offer: ${fmt(results.maxOfferForHome)} — you're paying ${fmt(inputs.mortgage.purchasePrice)}`} />
          <RuleCheck label="Profit > $0" passes={results.anticipatedProfit > 0} description={`Projected: ${fmt(results.anticipatedProfit)}`} />
          <RuleCheck label="ROI ≥ 20%" passes={results.roi >= 0.2} description={`Current ROI: ${fmtPct(results.roi)} — flips typically target 20%+`} />
          <RuleCheck label="Profit > $30,000" passes={results.anticipatedProfit >= 30000} description="Minimum threshold to justify execution risk" />
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

      {/* P&L Waterfall */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Profit & Loss Waterfall</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between font-semibold text-emerald-700"><span>After Repair Value (Sale Price)</span><span>{fmt(inputs.afterRepairValue)}</span></div>
          <div className="flex justify-between text-slate-600"><span>− Purchase Price</span><span className="text-red-600">({fmt(inputs.mortgage.purchasePrice)})</span></div>
          <div className="flex justify-between text-slate-600"><span>− Rehab Budget</span><span className="text-red-600">({fmt(inputs.mortgage.repairCosts)})</span></div>
          <div className="flex justify-between text-slate-600"><span>− Holding Costs ({inputs.monthsUntilFlip} mo)</span><span className="text-red-600">({fmt(results.totalHoldingExpenses)})</span></div>
          <div className="flex justify-between text-slate-600"><span>− Closing Costs (buy)</span><span className="text-red-600">({fmt(results.closingCosts)})</span></div>
          <div className="flex justify-between text-slate-600"><span>− Selling Costs (~5%)</span><span className="text-red-600">({fmt(inputs.afterRepairValue * 0.05)})</span></div>
          <div className="flex justify-between font-bold border-t pt-2 mt-2 text-base">
            <span>Anticipated Profit</span>
            <span className={results.anticipatedProfit >= 0 ? "text-emerald-700" : "text-red-700"}>{fmt(results.anticipatedProfit)}</span>
          </div>
        </div>
      </div>

      <button onClick={() => setShowInputs(v => !v)} className="w-full text-sm text-blue-600 font-semibold py-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors print:hidden">
        {showInputs ? "▲ Hide" : "▼ Adjust"} Assumptions
      </button>

      {showInputs && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
          <div>
            <SectionHeader title="Purchase & Financing" hint="Hard money / bridge loans are typical for flips" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Purchase Price" value={inputs.mortgage.purchasePrice} onChange={v => setMortgage("purchasePrice", v)} prefix="$" step={5000} />
              <InputField label="Down Payment" value={inputs.mortgage.downPaymentPercent} onChange={v => setMortgage("downPaymentPercent", v)} isPercent suffix="%" />
              <InputField label="Loan Interest Rate" value={inputs.mortgage.interestRate} onChange={v => setMortgage("interestRate", v)} isPercent suffix="%" hint="Hard money: 8–12%" />
              <InputField label="Rehab Budget" value={inputs.mortgage.repairCosts} onChange={v => setMortgage("repairCosts", v)} prefix="$" step={5000} />
              <InputField label="Closing Costs %" value={inputs.mortgage.closingCostsPercent} onChange={v => setMortgage("closingCostsPercent", v)} isPercent suffix="%" />
            </div>
          </div>
          <div>
            <SectionHeader title="Flip Strategy" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="After Repair Value (ARV)" value={inputs.afterRepairValue} onChange={v => setInputs(p => ({ ...p, afterRepairValue: v }))} prefix="$" step={5000} hint="Estimated sale price after renovation" />
              <InputField label="Months Until Flip" value={inputs.monthsUntilFlip} onChange={v => setInputs(p => ({ ...p, monthsUntilFlip: v }))} step={1} hint="Typical flip: 3–9 months" />
            </div>
          </div>
          <div>
            <SectionHeader title="Monthly Holding Costs" hint="Costs you pay every month while holding the property" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Property Tax" value={inputs.expenses.monthlyTaxes} onChange={v => setExpense("monthlyTaxes", v)} prefix="$" step={25} />
              <InputField label="Insurance" value={inputs.expenses.monthlyInsurance} onChange={v => setExpense("monthlyInsurance", v)} prefix="$" step={25} hint="Builder's risk insurance" />
              <InputField label="Utilities (Hydro/Gas)" value={inputs.expenses.monthlyGasElectric} onChange={v => setExpense("monthlyGasElectric", v)} prefix="$" step={50} />
              <InputField label="Water/Sewer" value={inputs.expenses.monthlyWaterSewer} onChange={v => setExpense("monthlyWaterSewer", v)} prefix="$" step={25} />
              <InputField label="Dumpster/Trash" value={inputs.expenses.monthlyTrash} onChange={v => setExpense("monthlyTrash", v)} prefix="$" step={50} hint="During active renovation" />
              <InputField label="Other Monthly" value={inputs.expenses.monthlyExtra} onChange={v => setExpense("monthlyExtra", v)} prefix="$" step={50} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
