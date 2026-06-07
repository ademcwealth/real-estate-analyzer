"use client";

import { useEffect, useRef, useState } from "react";
import type { PropertyListing } from "@/types";
import type { StrCompsResult, StrComp } from "@/app/api/str-comps/route";

interface Props {
  property: PropertyListing;
  onUseRevenue: (monthlyRevenue: number, nightlyRate: number) => void;
}

function fmt(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}
function fmtDec(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
}
function stars(r: number | null) {
  if (!r) return "—";
  return "★ " + r.toFixed(2);
}

// Edmonton fallback bbox
const EDMONTON_BBOX = { neLat: "53.716", neLng: "-113.316", swLat: "53.395", swLng: "-113.715" };

async function geocodeCityBbox(city: string): Promise<typeof EDMONTON_BBOX> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=ca`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RE-Analyzer/1.0 (real-estate-investment-tool)" },
      signal: AbortSignal.timeout(5000),
    });
    const results = await res.json();
    const bb: string[] | undefined = results?.[0]?.boundingbox;
    if (!bb || bb.length < 4) return EDMONTON_BBOX;
    // Nominatim boundingbox: [minLat, maxLat, minLng, maxLng]
    return { swLat: bb[0], neLat: bb[1], swLng: bb[2], neLng: bb[3] };
  } catch {
    return EDMONTON_BBOX;
  }
}

export default function STRComps({ property, onUseRevenue }: Props) {
  const [data, setData] = useState<StrCompsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [beds, setBeds] = useState(property.bedrooms);
  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const bboxRef = useRef<typeof EDMONTON_BBOX | null>(null);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    // Geocode city bbox first, then fetch comps with real coordinates
    geocodeCityBbox(property.city).then(bbox => {
      bboxRef.current = bbox;
      fetchComps(beds);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchComps(targetBeds: number) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const bbox = bboxRef.current ?? EDMONTON_BBOX;
      const params = new URLSearchParams({
        beds: String(targetBeds),
        city: property.city,
        province: property.province || "Alberta",
        neLat: bbox.neLat, neLng: bbox.neLng,
        swLat: bbox.swLat, swLng: bbox.swLng,
      });
      const res = await fetch(`/api/str-comps?${params}`, { signal: controller.signal });
      const text = await res.text();
      if (!text || text.trim() === "") throw new Error("Empty response — please retry");
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(json.error || "Failed to load STR data");
      setData(json);
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load Airbnb data");
    } finally {
      setLoading(false);
    }
  }

  function handleBedChange(b: number) {
    setBeds(b);
    hasFetched.current = true;
    fetchComps(b);
  }

  const rateBarMax = data ? data.stats.maxNightly : 1;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏖️</span>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Live Airbnb Comps</h3>
            <p className="text-xs text-slate-400">
              {data
                ? `${data.stats.count} active ${beds}-bed entire-home listings · ${data.searchArea}`
                : loading
                ? `Fetching Airbnb listings for ${property.city}…`
                : "Airbnb short-term rental market data"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {[1, 2, 3, 4, 5].map((b) => (
            <button
              key={b}
              onClick={() => handleBedChange(b)}
              disabled={loading}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                beds === b ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
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
            <svg className="animate-spin h-4 w-4 text-pink-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Fetching live Airbnb listings…
          </div>
        </div>
      )}

      {/* Error */}
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
          {/* Nightly rate stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
            {[
              { label: "Avg Nightly", value: fmt(data.stats.avgNightly), highlight: true },
              { label: "Median Nightly", value: fmt(data.stats.medianNightly) },
              { label: "Low (P25)", value: fmt(data.stats.p25Nightly) },
              { label: "High (P75)", value: fmt(data.stats.p75Nightly) },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</p>
                <p className={`text-lg font-bold ${s.highlight ? "text-pink-700" : "text-slate-800"}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Monthly revenue estimate */}
          <div className="px-5 py-3 bg-pink-50 border-t border-pink-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-pink-700">
                Estimated monthly Airbnb revenue ({data.occupancyAssumption} nights/mo · 65% occupancy):{" "}
                <strong>{fmt(data.estimatedMonthlyRevenue)}/mo</strong>
              </p>
              <p className="text-xs text-pink-500 mt-0.5">
                Avg rating: <strong>{stars(data.stats.avgRating)}</strong> ·
                Avg reviews/listing: <strong>{data.stats.avgReviews}</strong> ·
                Range: {fmt(data.stats.minNightly)}–{fmt(data.stats.maxNightly)}/night
              </p>
            </div>
            <button
              onClick={() => onUseRevenue(data.estimatedMonthlyRevenue, data.stats.medianNightly)}
              className="text-xs bg-pink-600 hover:bg-pink-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Use in Airbnb scenarios →
            </button>
          </div>

          {/* Listings table */}
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
                      <th className="text-left px-4 py-2 font-semibold">Listing</th>
                      <th className="text-center px-4 py-2 font-semibold">Beds</th>
                      <th className="text-center px-4 py-2 font-semibold">Baths</th>
                      <th className="text-center px-4 py-2 font-semibold">Rating</th>
                      <th className="text-center px-4 py-2 font-semibold">Reviews</th>
                      <th className="text-right px-4 py-2 font-semibold">Nightly</th>
                      <th className="text-right px-4 py-2 font-semibold">Est. Mo. Rev.</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.comps.map((comp: StrComp, i: number) => {
                      const barWidth = Math.round((comp.nightlyRate / rateBarMax) * 100);
                      const moRevenue = Math.round(comp.nightlyRate * data.occupancyAssumption);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 max-w-[200px]">
                            <p className="font-medium text-slate-700 truncate">{comp.title || "—"}</p>
                            <p className="text-slate-400 truncate">{comp.subtitle}</p>
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600">{comp.beds ?? "—"}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{comp.baths ?? "—"}</td>
                          <td className="px-4 py-2 text-center text-amber-600 font-medium">{stars(comp.rating)}</td>
                          <td className="px-4 py-2 text-center text-slate-500">{comp.reviews}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 bg-slate-100 rounded-full h-1.5 hidden md:block">
                                <div className="bg-pink-400 h-1.5 rounded-full" style={{ width: `${barWidth}%` }} />
                              </div>
                              {fmtDec(comp.nightlyRate)}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-slate-500">{fmt(moRevenue)}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => onUseRevenue(moRevenue, comp.nightlyRate)}
                              className="text-pink-500 hover:text-pink-700 font-semibold whitespace-nowrap"
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
