"use client";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  sentiment?: "positive" | "negative" | "neutral" | "warning";
  large?: boolean;
}

export default function MetricCard({ label, value, sub, sentiment = "neutral", large }: MetricCardProps) {
  const colors = {
    positive: "bg-emerald-50 border-emerald-200 text-emerald-700",
    negative: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    neutral: "bg-slate-50 border-slate-200 text-slate-700",
  };
  const valueColors = {
    positive: "text-emerald-800",
    negative: "text-red-800",
    warning: "text-amber-800",
    neutral: "text-slate-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[sentiment]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide opacity-70 mb-1`}>{label}</p>
      <p className={`font-bold ${large ? "text-3xl" : "text-xl"} ${valueColors[sentiment]}`}>{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}
