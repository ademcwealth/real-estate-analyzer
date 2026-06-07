"use client";

import { useEffect, useRef, useState } from "react";
import type { PropertyListing, SaleRecord, SalesHistoryResult } from "@/types";

interface Props {
  property: PropertyListing;
}

function fmt(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatDate(raw: string): string {
  // Try to parse and format the date nicely
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw; // return as-is if unparseable
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function PriceChange({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  const pct = ((delta / previous) * 100).toFixed(1);
  const positive = delta >= 0;
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {positive ? "+" : ""}{fmt(delta)} ({positive ? "+" : ""}{pct}%)
    </span>
  );
}

export default function SalesHistory({ property }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesHistoryResult | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const params = new URLSearchParams({
      address: property.address,
      city: property.city,
      province: property.province,
    });

    fetch(`/api/sales-history?${params}`)
      .then((r) => r.json())
      .then((d: SalesHistoryResult) => setData(d))
      .catch(() => setData({ sales: [], hdEstimate: null, address: property.address }))
      .finally(() => setLoading(false));
  }, [property.address, property.city, property.province]);

  const sales: SaleRecord[] = data?.sales ?? [];
  const hdEstimate = data?.hdEstimate ?? null;
  const hasData = sales.length > 0 || hdEstimate !== null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Sales History</h3>
          <p className="text-xs text-slate-400 mt-0.5">via HonestDoor</p>
        </div>
        {hdEstimate !== null && (
          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">HD Estimate</p>
            <p className="text-lg font-bold text-indigo-600">{fmt(hdEstimate)}</p>
            {property.price > 0 && (
              <p className={`text-xs font-semibold ${hdEstimate >= property.price ? "text-emerald-600" : "text-red-500"}`}>
                {hdEstimate >= property.price
                  ? `+${fmt(hdEstimate - property.price)} vs asking`
                  : `${fmt(hdEstimate - property.price)} vs asking`}
              </p>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
          Looking up sales history…
        </div>
      )}

      {!loading && !hasData && (
        <p className="text-sm text-slate-400 py-2">
          No sales history found for this address on HonestDoor.
        </p>
      )}

      {!loading && sales.length > 0 && (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />

          <ul className="space-y-4">
            {sales.map((sale, i) => {
              const next = sales[i + 1]; // older sale
              return (
                <li key={i} className="flex gap-4 items-start pl-6 relative">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-2 ring-slate-300 bg-white" />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-slate-900 text-base">{fmt(sale.price)}</span>
                      {sale.type && (
                        <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-medium capitalize">
                          {sale.type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(sale.date)}</p>
                    {next && (
                      <div className="mt-1">
                        <PriceChange current={sale.price} previous={next.price} />
                        <span className="text-xs text-slate-400 ml-1">vs prior sale</span>
                      </div>
                    )}
                  </div>

                  {/* Appreciation rate between this and next sale */}
                  {next && (() => {
                    const years =
                      (new Date(sale.date).getTime() - new Date(next.date).getTime()) /
                      (1000 * 60 * 60 * 24 * 365.25);
                    if (years < 0.1) return null;
                    const cagr = (Math.pow(sale.price / next.price, 1 / years) - 1) * 100;
                    return (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400">CAGR</p>
                        <p className={`text-sm font-bold ${cagr >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {cagr >= 0 ? "+" : ""}{cagr.toFixed(1)}%/yr
                        </p>
                        <p className="text-xs text-slate-400">{years.toFixed(1)} yrs</p>
                      </div>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!loading && hdEstimate === null && sales.length === 0 && (
        <p className="text-xs text-slate-400 mt-1">
          HonestDoor covers most Alberta properties — the address may not be indexed yet.
        </p>
      )}
    </div>
  );
}
