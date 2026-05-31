"use client";

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  isPercent?: boolean;
}

export default function InputField({
  label, value, onChange, prefix, suffix, step = 1, min = 0, hint, isPercent
}: InputFieldProps) {
  const displayValue = isPercent ? (value * 100).toFixed(2) : value;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseFloat(e.target.value);
    if (isNaN(raw)) return;
    onChange(isPercent ? raw / 100 : raw);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400">
        {prefix && <span className="pl-3 text-slate-500 text-sm font-medium">{prefix}</span>}
        <input
          type="number"
          value={displayValue}
          onChange={handleChange}
          step={isPercent ? "0.1" : step}
          min={min}
          className="flex-1 px-2 py-2 text-sm text-slate-800 font-medium outline-none bg-transparent min-w-0"
        />
        {suffix && <span className="pr-3 text-slate-500 text-sm font-medium">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
