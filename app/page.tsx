"use client";

import { useState } from "react";
import type { PropertyListing } from "@/types";
import PropertyCard from "@/components/PropertyCard";
import ScenarioTabs from "@/components/ScenarioTabs";
import RentalComps from "@/components/RentalComps";
import STRComps from "@/components/STRComps";
import SalesHistory from "@/components/SalesHistory";
import RecentProperties, { saveToHistory } from "@/components/RecentProperties";

const PLACEHOLDER_URL = "https://www.realtor.ca/real-estate/27165448/10709-74-avenue-nw-edmonton";

const EMPTY_PROPERTY: PropertyListing = {
  address: "",
  price: 500000,
  bedrooms: 3,
  bathrooms: 2,
  propertyType: "Residential",
  city: "Edmonton",
  province: "AB",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<PropertyListing | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualProp, setManualProp] = useState<PropertyListing>(EMPTY_PROPERTY);
  const [appliedRent, setAppliedRent] = useState<number | null>(null);
  const [appliedNightly, setAppliedNightly] = useState<number | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setProperty(null);
    setManualMode(false);

    try {
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.listing) {
        if (data.warning) setWarning(data.warning);
        setProperty(data.listing);
        saveToHistory(data.listing);
      } else if (data.manualEntry) {
        // Pre-fill the manual form with any address hint extracted from the URL
        if (data.addressHint) {
          setManualProp(p => ({ ...p, address: data.addressHint }));
        }
        setError(data.error);
        setManualMode(true);
      } else {
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualProp.address && manualProp.price > 0) {
      setProperty(manualProp);
      saveToHistory(manualProp);
      setManualMode(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">RE</div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight text-base">Canadian RE Analyzer</h1>
              <p className="text-xs text-slate-400">Canadian real estate investment analysis</p>
            </div>
          </div>
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-1 font-semibold">For educational use only</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero + URL Input */}
        {!property && !manualMode && (
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Is this property worth buying?
            </h2>
            <p className="text-slate-500 text-lg mb-8 max-w-2xl mx-auto">
              Paste a Canadian MLS listing URL and get instant analysis across 4 investment strategies — long-term rental, Airbnb, arbitrage, and fix &amp; flip.
            </p>

            <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto">
              <div className="flex gap-2 bg-white border-2 border-slate-200 rounded-2xl p-2 shadow-sm focus-within:border-blue-400 transition-colors">
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder={PLACEHOLDER_URL}
                  className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-slate-700 placeholder:text-slate-300"
                />
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-colors whitespace-nowrap"
                >
                  {loading ? "Loading (~15s)…" : "Analyze →"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Supports realtor.ca listing URLs</p>
            </form>

            {error && (
              <div className="max-w-2xl mx-auto mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                <p className="text-sm text-amber-800 font-semibold mb-1">⚠️ Could not fetch listing automatically</p>
                <p className="text-sm text-amber-700">{error}</p>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setManualMode(true)}
                className="text-sm text-blue-500 hover:text-blue-700 underline"
              >
                Or enter property details manually →
              </button>
            </div>

            <RecentProperties
              onSelect={(p) => { setProperty(p); setError(null); setWarning(null); }}
            />
          </div>
        )}

        {/* Manual Entry Form */}
        {manualMode && !property && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-lg mb-1">Enter Property Details</h3>
              <p className="text-sm text-slate-500 mb-5">Fill in the key property details to run the analysis.</p>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Address</label>
                  <input
                    type="text"
                    value={manualProp.address}
                    onChange={e => setManualProp(p => ({ ...p, address: e.target.value }))}
                    placeholder="123 Main St, Edmonton, AB"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Listing Price ($)</label>
                    <input
                      type="number"
                      value={manualProp.price}
                      onChange={e => setManualProp(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      min={0}
                      step={1000}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Bedrooms</label>
                    <select
                      value={manualProp.bedrooms}
                      onChange={e => setManualProp(p => ({ ...p, bedrooms: parseInt(e.target.value) }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n === 0 ? "Studio/Bachelor" : `${n} bedroom${n > 1 ? "s" : ""}`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Bathrooms</label>
                    <input
                      type="number"
                      value={manualProp.bathrooms}
                      onChange={e => setManualProp(p => ({ ...p, bathrooms: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Property Type</label>
                    <select
                      value={manualProp.propertyType}
                      onChange={e => setManualProp(p => ({ ...p, propertyType: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {["Residential", "Condo/Strata", "Duplex", "Triplex", "Multi-family", "Commercial"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    Run Analysis →
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50"
                  >
                    Back
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {property && (
          <div>
            {warning && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 print:hidden">
                ⚠️ {warning}
              </div>
            )}

            {/* Toolbar — hidden when printing */}
            <div className="flex items-center justify-between mb-4 print:hidden">
              <button
                onClick={() => { setProperty(null); setUrl(""); setError(null); setWarning(null); setAppliedRent(null); setAppliedNightly(null); }}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                ← Analyze another property
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 border border-slate-300 rounded-xl px-4 py-2 hover:bg-slate-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Save as PDF
              </button>
            </div>

            <PropertyCard property={property} />

            {/* HonestDoor sales history — hidden when printing */}
            <div className="print:hidden">
              <SalesHistory property={property} />
            </div>

            {/* Long-term rental comps — hidden when printing */}
            <div className="mb-4 print:hidden">
              <RentalComps
                property={property}
                onUseRent={(rent) => setAppliedRent(rent)}
              />
            </div>

            {/* Short-term rental (Airbnb) comps — hidden when printing */}
            <div className="mb-6 print:hidden">
              <STRComps
                property={property}
                onUseRevenue={(_monthlyRevenue, nightlyRate) => setAppliedNightly(nightlyRate)}
              />
            </div>

            <ScenarioTabs
              property={property}
              externalRent={appliedRent}
              externalNightly={appliedNightly}
              onClearRent={() => setAppliedRent(null)}
            />

            <div className="mt-8 bg-slate-100 rounded-xl p-4 text-xs text-slate-500 text-center print:mt-4">
              <strong>Disclaimer:</strong> This tool uses estimated market defaults and should not be relied on as professional financial or investment advice.
              Always verify rent estimates, tax rates, and market conditions with a licensed real estate professional before making investment decisions.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
