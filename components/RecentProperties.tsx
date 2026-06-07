"use client";

import { useEffect, useState } from "react";
import type { PropertyListing } from "@/types";

const STORAGE_KEY = "re_analyzer_history";
const MAX_ENTRIES = 8;

export interface HistoryEntry {
  property: PropertyListing;
  savedAt: number;
}

function fmt(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function saveToHistory(property: PropertyListing) {
  try {
    const existing = loadHistory();
    // Deduplicate by address — move to front if already present
    const filtered = existing.filter(e => e.property.address !== property.address);
    const updated: HistoryEntry[] = [
      { property, savedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore — private browsing may block localStorage */ }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

interface Props {
  onSelect: (property: PropertyListing) => void;
}

export default function RecentProperties({ onSelect }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="mt-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Recent Analyses</h3>
        <button
          onClick={() => { localStorage.removeItem(STORAGE_KEY); setHistory([]); }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {history.map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry.property)}
            className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between gap-3 group"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">
                {entry.property.address}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {fmt(entry.property.price)} · {entry.property.bedrooms}bd / {entry.property.bathrooms}ba · {entry.property.propertyType}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-slate-400">{timeAgo(entry.savedAt)}</span>
              <span className="text-slate-300 group-hover:text-blue-400 text-sm">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
