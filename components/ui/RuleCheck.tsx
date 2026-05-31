"use client";

interface RuleCheckProps {
  label: string;
  passes: boolean;
  description?: string;
}

export default function RuleCheck({ label, passes, description }: RuleCheckProps) {
  return (
    <div className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${passes ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
      <span className={`text-base mt-0.5 flex-shrink-0 ${passes ? "text-emerald-600" : "text-red-500"}`}>
        {passes ? "✓" : "✗"}
      </span>
      <div>
        <span className={`font-semibold ${passes ? "text-emerald-800" : "text-red-800"}`}>{label}</span>
        {description && <p className={`text-xs mt-0.5 ${passes ? "text-emerald-700" : "text-red-700"} opacity-80`}>{description}</p>}
      </div>
    </div>
  );
}
