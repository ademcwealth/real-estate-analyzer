"use client";

import { useEffect, useRef, useState } from "react";
import type { PropertyListing } from "@/types";
import type { RentalCompsResult, RentalComp } from "@/app/api/rentals/route";

interface Props {
  property: PropertyListing;
  onUseRent: (rent: number) => void;
}

function TypeBadge({ listingType }: { listingType: string }) {
  const raw = listingType.split(":").pop() ?? "";
  const label = raw.replace(/-/g, " ").replace(/_/g, " ");
  const isBasement = raw.includes("basement");
  const isHouse = raw.includes("house") || raw.includes("single") || raw.includes("duplex") || raw.includes("triplex");
  const isCondo = raw.includes("condo");

  const style = isBasement
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : isHouse
    ? "bg-green-50 text-green-700 border-green-200"
    : isCondo
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <span className={`inline-block border rounded-md px-1.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {label || "apt"}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

export default function RentalComps({ property, onUseRent }: Props) {
  const [data, setData] = useState<RentalCompsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [beds, setBeds] = useState(property.bedrooms);

  // Prevent React 18 Strict Mode from firing two simultaneous Puppeteer fetches
  const hasFetched = useRef(false);
  // Hold a reference to the current AbortController so bed-filter changes cancel the in-flight request
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchComps(beds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchComps(targetBeds: number) {
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    // Keep showing previous data while refreshing
    try {
      const params = new URLSearchParams({
        city: property.city,
        beds: String(targetBeds),
        address: property.address,
      });
      const res = await fetch(`/api/rentals?${params}`, { signal: controller.signal });
      const text = await res.text();
      if (!text || text.trim() === "") throw new Error("Empty response — please try again");
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(json.error || "Failed to load comps");
      setData(json);
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // cancelled — ignore
      setError(e instanceof Error ? e.message : "Failed to load rental data");
    } finally {
      setLoading(false);
    }
  }

  function handleBedChange(newBeds: number) {
    setBeds(newBeds);
    fetchComps(newBeds);
  }

  const rentBarMax = data ? data.stats.max : 1;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏘️</span>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Live Rental Comps</h3>
            <p className="text-xs text-slate-400">
              {data
                ? `${data.stats.count} active ${beds}-bed listings · ${data.searchArea}`
                : `Locating comps near ${property.address.split(',')[0]}…`}
            </p>
          </div>
        </div>

        {/* Beds toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {[1, 2, 3, 4, 5].map((b) => (
            <button
              key={b}
              onClick={() => handleBedChange(b)}
              disabled={loading}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                beds === b
                  ? "bg-white shadow text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {b}bd
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-5 py-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Fetching live rentals from rentals.ca…
          </div>
        </div>
      )}

      {/* Error — only shown when no data is available */}
      {error && !loading && !data && (
        <div className="px-5 py-4 bg-red-50 flex items-center justify-between gap-4">
          <span className="text-sm text-red-700">⚠️ {error}</span>
          <button
            onClick={() => { hasFetched.current = true; fetchComps(beds); }}
            className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      {data && !loading && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
            {[
              { label: "Avg Rent", value: fmt(data.stats.avg), highlight: true },
              { label: "Median", value: fmt(data.stats.median) },
              { label: "Low (P25)", value: fmt(data.stats.p25) },
              { label: "High (P75)", value: fmt(data.stats.p75) },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</p>
                <p className={`text-lg font-bold ${s.highlight ? "text-blue-700" : "text-slate-800"}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Use average button */}
          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-blue-700">
              {beds}-bed market rent near <strong>{data.searchArea}</strong>: avg <strong>{fmt(data.stats.avg)}/mo</strong>
              {" "}· Range: {fmt(data.stats.min)} – {fmt(data.stats.max)}
            </p>
            <button
              onClick={() => onUseRent(data.stats.median)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Use median ({fmt(data.stats.median)}) in scenarios →
            </button>
          </div>

          {/* Listings table toggle */}
          <div className="border-t border-slate-100">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full px-5 py-2.5 text-xs text-slate-500 font-semibold hover:bg-slate-50 flex items-center justify-between transition-colors"
            >
              <span>{expanded ? "Hide" : "Show"} all {data.comps.length} comparable listings</span>
              <span>{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2 font-semibold">Address</th>
                      <th className="text-left px-4 py-2 font-semibold">Neighbourhood</th>
                      <th className="text-left px-4 py-2 font-semibold">Type</th>
                      <th className="text-center px-4 py-2 font-semibold">Beds</th>
                      <th className="text-center px-4 py-2 font-semibold">Baths</th>
                      <th className="text-right px-4 py-2 font-semibold">Sq Ft</th>
                      <th className="text-right px-4 py-2 font-semibold">Rent/mo</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.comps.map((comp: RentalComp, i: number) => {
                      const barWidth = Math.round((comp.rent / rentBarMax) * 100);
                      const isAvg = Math.abs(comp.rent - data.stats.avg) < 75;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 text-slate-700">{comp.address}</td>
                          <td className="px-4 py-2 text-slate-400">{comp.neighbourhood || "—"}</td>
                          <td className="px-4 py-2">
                            <TypeBadge listingType={comp.listingType} />
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600">{comp.beds}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{comp.baths}</td>
                          <td className="px-4 py-2 text-right text-slate-500">
                            {comp.sqft ? comp.sqft.toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            <div className="flex items-center justify-end gap-2">
                              {/* Mini rent bar */}
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 hidden md:block">
                                <div
                                  className="bg-blue-400 h-1.5 rounded-full"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className={isAvg ? "text-blue-700" : ""}>
                                {fmt(comp.rent)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => onUseRent(comp.rent)}
                              className="text-blue-500 hover:text-blue-700 font-semibold whitespace-nowrap"
                            >
                              Use ↗
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
