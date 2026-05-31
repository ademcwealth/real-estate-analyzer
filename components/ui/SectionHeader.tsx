"use client";

export default function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-b border-slate-200 pb-2 mb-4">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
