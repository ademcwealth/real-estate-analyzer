"use client";

import { useMemo } from "react";
import type { PropertyListing } from "@/types";
import {
  calcLongTermRental,
  calcAirbnbOwned,
  calcAirbnbArbitrage,
  calcFixAndFlip,
} from "@/lib/calculations";
import {
  getDefaultMortgageInputs,
  getDefaultExpenses,
  getDefaultRent,
  getCityDefaults,
  FLIP_DEFAULTS,
} from "@/lib/defaults";

interface Props {
  propertyA: PropertyListing;
  propertyB: PropertyListing;
}

function fmtC(n: number) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function getScenarios(p: PropertyListing) {
  const mortgage = getDefaultMortgageInputs(p.price);
  const expenses = getDefaultExpenses(p.price, p.assessedValue, p.city, p.province);
  const rent = getDefaultRent(p.bedrooms, p.city, p.province);
  const city = getCityDefaults(p.city, p.province);

  const ltr = calcLongTermRental({
    mortgage,
    expenses,
    monthlyRents: [rent],
    laundryRevenue: 0,
    additionalRevenue: 0,
  });

  const airbnb = calcAirbnbOwned({
    mortgage,
    expenses,
    furnitureCost: city.airbnbFurnitureCost,
    dailyRate: city.airbnbDailyRate,
    dailyCleaningFee: city.airbnbCleaningFee,
    occupiedNightsPerMonth: city.airbnbNightsPerMonth,
    additionalGuestFee: 0,
    cleanerPercent: city.airbnbCleanerPercent,
  });

  const arb = calcAirbnbArbitrage({
    expenses: {
      ...expenses,
      monthlyTaxes: 0,
      maintenancePercent: 0,
      vacancyPercent: 0,
      managementPercent: 0,
    },
    damageDeposit: 2000,
    repairCosts: 1000,
    furnitureCost: 4000,
    monthlyRentToLandlord: rent,
    dailyRate: city.airbnbDailyRate,
    dailyCleaningFee: city.airbnbCleaningFee,
    occupiedNightsPerMonth: city.airbnbNightsPerMonth,
    additionalGuestFee: 0,
  });

  const flipExpenses = getDefaultExpenses(p.price, p.assessedValue, p.city, p.province);
  const flip = calcFixAndFlip({
    mortgage: { ...mortgage, repairCosts: FLIP_DEFAULTS.flipRepairCosts, interestRate: 0.08, loanTermYears: 1 },
    expenses: {
      monthlyTaxes: flipExpenses.monthlyTaxes,
      monthlyInsurance: flipExpenses.monthlyInsurance,
      monthlyTrash: 400,
      monthlyGasElectric: 400,
      monthlyInternet: 0,
      monthlyHOA: flipExpenses.monthlyHOA,
      monthlyWaterSewer: 200,
      monthlyHeat: 200,
      monthlyLawnSnow: 0,
      monthlyPhoneBill: 0,
      monthlyExtra: 0,
    },
    afterRepairValue: Math.round(p.price * FLIP_DEFAULTS.flipARVMultiplier),
    monthsUntilFlip: FLIP_DEFAULTS.flipMonthsHolding,
  });

  return { ltr, airbnb, arb, flip, rent, city };
}

type Winner = "a" | "b" | "tie";

function wins(a: number, b: number, higherIsBetter = true): Winner {
  const diff = Math.abs(a - b);
  if (diff < 0.001) return "tie";
  return higherIsBetter ? (a > b ? "a" : "b") : (a < b ? "a" : "b");
}

function WinBadge({ w, side }: { w: Winner; side: "a" | "b" }) {
  if (w === "tie") return <span className="text-xs text-slate-400">—</span>;
  if (w === side) return <span className="text-xs font-bold text-emerald-600">✓</span>;
  return null;
}

function MetricRow({
  label,
  a,
  b,
  w,
}: {
  label: string;
  a: string;
  b: string;
  w: Winner;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">{label}</td>
      <td className={`py-2 px-4 text-sm font-semibold text-center ${w === "a" ? "text-emerald-700" : "text-slate-700"}`}>
        {a} <WinBadge w={w} side="a" />
      </td>
      <td className={`py-2 px-4 text-sm font-semibold text-center ${w === "b" ? "text-emerald-700" : "text-slate-700"}`}>
        {b} <WinBadge w={w} side="b" />
      </td>
    </tr>
  );
}

function VerdictRow({ labelA, labelB }: { labelA: boolean; labelB: boolean }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-4 text-xs text-slate-500">Verdict</td>
      <td className="py-2 px-4 text-center">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${labelA ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {labelA ? "Profitable" : "Not profitable"}
        </span>
      </td>
      <td className="py-2 px-4 text-center">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${labelB ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {labelB ? "Profitable" : "Not profitable"}
        </span>
      </td>
    </tr>
  );
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <tr className="bg-slate-50">
      <td colSpan={3} className="pt-5 pb-2 px-1">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{emoji} {title}</span>
      </td>
    </tr>
  );
}

export default function CompareView({ propertyA, propertyB }: Props) {
  const a = useMemo(() => getScenarios(propertyA), [propertyA]);
  const b = useMemo(() => getScenarios(propertyB), [propertyB]);

  const fmt = fmtC;

  // Overall winner counts
  const scenarios = [
    { name: "Long-Term Rental", metricA: a.ltr.monthlyCashflow, metricB: b.ltr.monthlyCashflow },
    { name: "Airbnb (Own)", metricA: a.airbnb.monthlyCashflow, metricB: b.airbnb.monthlyCashflow },
    { name: "Airbnb Arbitrage", metricA: a.arb.monthlyProfit, metricB: b.arb.monthlyProfit },
    { name: "Fix & Flip", metricA: a.flip.anticipatedProfit, metricB: b.flip.anticipatedProfit },
  ];
  const winsA = scenarios.filter(s => s.metricA > s.metricB).length;
  const winsB = scenarios.filter(s => s.metricB > s.metricA).length;

  const shortAddr = (addr: string) => addr.split(",")[0];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Property Headers */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-slate-50 border-b border-slate-200">
        {[propertyA, propertyB].map((p, i) => (
          <div key={i} className="px-5 py-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Property {i === 0 ? "A" : "B"}</p>
            <p className="font-bold text-slate-900 text-sm leading-tight">{shortAddr(p.address)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {p.price.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
              {" · "}{p.bedrooms}bd / {p.bathrooms}ba
            </p>
          </div>
        ))}
      </div>

      {/* Summary banner */}
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-blue-700">
          Using market defaults for {propertyA.city} and {propertyB.city === propertyA.city ? "same city" : propertyB.city} — adjust individual scenarios for precise numbers
        </p>
        <div className="flex gap-4 text-xs font-bold">
          <span className={winsA >= winsB ? "text-emerald-700" : "text-slate-500"}>A wins {winsA}/4</span>
          <span className={winsB > winsA ? "text-emerald-700" : "text-slate-500"}>B wins {winsB}/4</span>
        </div>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full px-5">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-3 pl-5 text-xs text-slate-400 font-semibold uppercase w-36">Metric</th>
              <th className="py-3 px-4 text-xs text-slate-600 font-bold text-center">{shortAddr(propertyA.address)}</th>
              <th className="py-3 px-4 text-xs text-slate-600 font-bold text-center">{shortAddr(propertyB.address)}</th>
            </tr>
          </thead>
          <tbody className="pl-5">
            <SectionHeader emoji="🏠" title="Long-Term Rental" />
            <MetricRow label="Monthly Cashflow" a={fmt(a.ltr.monthlyCashflow)} b={fmt(b.ltr.monthlyCashflow)} w={wins(a.ltr.monthlyCashflow, b.ltr.monthlyCashflow)} />
            <MetricRow label="CAP Rate" a={fmtPct(a.ltr.capRate)} b={fmtPct(b.ltr.capRate)} w={wins(a.ltr.capRate, b.ltr.capRate)} />
            <MetricRow label="Cash-on-Cash" a={fmtPct(a.ltr.cashOnCashReturn)} b={fmtPct(b.ltr.cashOnCashReturn)} w={wins(a.ltr.cashOnCashReturn, b.ltr.cashOnCashReturn)} />
            <MetricRow label="Capital Needed" a={fmt(a.ltr.totalCapitalNeeded)} b={fmt(b.ltr.totalCapitalNeeded)} w={wins(a.ltr.totalCapitalNeeded, b.ltr.totalCapitalNeeded, false)} />
            <VerdictRow labelA={a.ltr.isProfitable} labelB={b.ltr.isProfitable} />

            <SectionHeader emoji="🛏️" title="Airbnb (Own)" />
            <MetricRow label="Monthly Cashflow" a={fmt(a.airbnb.monthlyCashflow)} b={fmt(b.airbnb.monthlyCashflow)} w={wins(a.airbnb.monthlyCashflow, b.airbnb.monthlyCashflow)} />
            <MetricRow label="CAP Rate" a={fmtPct(a.airbnb.capRate)} b={fmtPct(b.airbnb.capRate)} w={wins(a.airbnb.capRate, b.airbnb.capRate)} />
            <MetricRow label="Cash-on-Cash" a={fmtPct(a.airbnb.cashOnCashReturn)} b={fmtPct(b.airbnb.cashOnCashReturn)} w={wins(a.airbnb.cashOnCashReturn, b.airbnb.cashOnCashReturn)} />
            <MetricRow label="Capital Needed" a={fmt(a.airbnb.totalCapitalNeeded)} b={fmt(b.airbnb.totalCapitalNeeded)} w={wins(a.airbnb.totalCapitalNeeded, b.airbnb.totalCapitalNeeded, false)} />
            <VerdictRow labelA={a.airbnb.isProfitable} labelB={b.airbnb.isProfitable} />

            <SectionHeader emoji="🔄" title="Airbnb Arbitrage" />
            <MetricRow label="Monthly Profit" a={fmt(a.arb.monthlyProfit)} b={fmt(b.arb.monthlyProfit)} w={wins(a.arb.monthlyProfit, b.arb.monthlyProfit)} />
            <MetricRow label="Cash-on-Cash" a={fmtPct(a.arb.cashOnCashReturn)} b={fmtPct(b.arb.cashOnCashReturn)} w={wins(a.arb.cashOnCashReturn, b.arb.cashOnCashReturn)} />
            <MetricRow label="Startup Capital" a={fmt(a.arb.totalCapitalNeeded)} b={fmt(b.arb.totalCapitalNeeded)} w={wins(a.arb.totalCapitalNeeded, b.arb.totalCapitalNeeded, false)} />
            <VerdictRow labelA={a.arb.isProfitable} labelB={b.arb.isProfitable} />

            <SectionHeader emoji="🔨" title="Fix & Flip" />
            <MetricRow label="Anticipated Profit" a={fmt(a.flip.anticipatedProfit)} b={fmt(b.flip.anticipatedProfit)} w={wins(a.flip.anticipatedProfit, b.flip.anticipatedProfit)} />
            <MetricRow label="ROI" a={fmtPct(a.flip.roi)} b={fmtPct(b.flip.roi)} w={wins(a.flip.roi, b.flip.roi)} />
            <MetricRow label="Max Offer (70% Rule)" a={fmt(a.flip.maxOfferForHome)} b={fmt(b.flip.maxOfferForHome)} w="tie" />
            <MetricRow label="Capital Needed" a={fmt(a.flip.totalCapitalNeeded)} b={fmt(b.flip.totalCapitalNeeded)} w={wins(a.flip.totalCapitalNeeded, b.flip.totalCapitalNeeded, false)} />
            <VerdictRow labelA={a.flip.isProfitable} labelB={b.flip.isProfitable} />
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
        Comparison uses city market defaults. Open each property&apos;s full analysis to tune assumptions.
      </div>
    </div>
  );
}
