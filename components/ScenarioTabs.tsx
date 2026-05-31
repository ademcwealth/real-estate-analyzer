"use client";

import { useState } from "react";
import type { PropertyListing } from "@/types";
import LongTermRental from "@/components/scenarios/LongTermRental";
import AirbnbOwned from "@/components/scenarios/AirbnbOwned";
import AirbnbArbitrage from "@/components/scenarios/AirbnbArbitrage";
import FixAndFlip from "@/components/scenarios/FixAndFlip";

const TABS = [
  { id: "ltr", label: "Long-Term Rental", emoji: "🏠", sub: "Buy & rent out" },
  { id: "airbnb", label: "Airbnb (Own)", emoji: "🛏️", sub: "Buy & short-term rent" },
  { id: "arb", label: "Airbnb Arbitrage", emoji: "🔄", sub: "Lease & sublet" },
  { id: "flip", label: "Fix & Flip", emoji: "🔨", sub: "Buy, renovate, sell" },
] as const;

type TabId = typeof TABS[number]["id"];

interface Props {
  property: PropertyListing;
  externalRent?: number | null;
  externalNightly?: number | null;
  onClearRent?: () => void;
}

export default function ScenarioTabs({ property, externalRent, externalNightly, onClearRent }: Props) {
  const [active, setActive] = useState<TabId>("ltr");

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  return (
    <div>
      {/* Applied nightly rate banner */}
      {externalNightly && (
        <div className="mb-3 flex items-center justify-between bg-pink-50 border border-pink-200 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-pink-800">
            🏖️ Airbnb market rate of <strong>{fmt(externalNightly)}/night</strong> applied to Airbnb scenarios
          </span>
        </div>
      )}

      {/* Applied rent banner — shown when a comp rent has been selected */}
      {externalRent && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-blue-800">
            📌 Market rent of <strong>{fmt(externalRent)}/mo</strong> applied to all rental scenarios
          </span>
          <button
            onClick={onClearRent}
            className="text-blue-400 hover:text-blue-600 text-xs ml-4 font-semibold"
          >
            Clear ✕
          </button>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-1 min-w-[120px] flex flex-col items-center py-3 px-2 rounded-xl transition-all text-center ${
              active === tab.id
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            }`}
          >
            <span className="text-xl mb-0.5">{tab.emoji}</span>
            <span className="text-xs font-bold leading-tight">{tab.label}</span>
            <span className="text-xs opacity-60 leading-tight hidden md:block">{tab.sub}</span>
          </button>
        ))}
      </div>

      {/* Tab Content — externalRent prop flows directly to each scenario */}
      <div>
        {active === "ltr" && <LongTermRental property={property} externalRent={externalRent} />}
        {active === "airbnb" && <AirbnbOwned property={property} externalRent={externalRent} externalNightly={externalNightly} />}
        {active === "arb" && <AirbnbArbitrage property={property} externalRent={externalRent} />}
        {active === "flip" && <FixAndFlip property={property} />}
      </div>
    </div>
  );
}

export type { Props as ScenarioTabsProps };
