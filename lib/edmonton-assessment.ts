const ASSESSMENT_URL = "https://data.edmonton.ca/resource/q7d6-ambg.json";
// Property Information dataset — may contain tax_levy field alongside assessment data
const PROPERTY_INFO_URL = "https://data.edmonton.ca/resource/dkk9-cj3x.json";

// Edmonton 2025 mill rates (municipal 7.63 + education 2.51 = 10.14 per $1,000 assessed)
export const EDMONTON_2025_MILL_RATE = 10.14;
export const EDMONTON_2025_MUNICIPAL_MILL_RATE = 7.63;
export const EDMONTON_2025_EDUCATION_MILL_RATE = 2.51;

export interface EdmontonPropertyData {
  assessedValue: number | null;
  annualTaxLevy: number | null;
  taxSource: "billed" | "estimated" | null;
}

function parseEdmontonAddress(address: string): { houseNumber: string; streetKeyword: string } | null {
  const cleaned = address
    .replace(/,?\s*(Edmonton|Calgary|Alberta|AB)\b.*/i, "")
    .trim()
    .toUpperCase();
  const match = cleaned.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;
  const houseNumber = match[1];
  const streetWords = match[2].split(/\s+/).filter(w => w.length > 2);
  const streetKeyword = streetWords[0] ?? match[2];
  return { houseNumber, streetKeyword };
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && v > 0) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

export async function fetchEdmontonPropertyData(address: string): Promise<EdmontonPropertyData> {
  const parsed = parseEdmontonAddress(address);
  if (!parsed) return { assessedValue: null, annualTaxLevy: null, taxSource: null };

  const { houseNumber, streetKeyword } = parsed;
  const where = `house_number='${houseNumber}' AND street_name like '%${streetKeyword}%'`;

  // Try Property Information dataset first — it may have a direct tax_levy field
  try {
    const url = `${PROPERTY_INFO_URL}?$where=${encodeURIComponent(where)}&$limit=5`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (res.ok) {
      const rows: Record<string, unknown>[] = await res.json();
      if (rows.length > 0) {
        const row = rows.find(r => r.house_number === houseNumber) ?? rows[0];
        const assessedValue = toNum(row.assessed_value);
        // Try multiple possible field names for the tax levy
        const annualTaxLevy =
          toNum(row.tax_levy) ??
          toNum(row.annual_levy) ??
          toNum(row.total_tax_levy) ??
          toNum(row.municipal_and_education_levy) ??
          toNum(row.property_tax_levy) ??
          null;

        if (assessedValue || annualTaxLevy) {
          // If levy wasn't in this dataset, derive it from assessed value + 2025 mill rate
          const derivedLevy = assessedValue
            ? Math.round(assessedValue * (EDMONTON_2025_MILL_RATE / 1000))
            : null;
          return {
            assessedValue,
            annualTaxLevy: annualTaxLevy ?? derivedLevy,
            taxSource: annualTaxLevy ? "billed" : "estimated",
          };
        }
      }
    }
  } catch { /* fall through to assessment dataset */ }

  // Fall back to assessment-only dataset
  try {
    const url = `${ASSESSMENT_URL}?$where=${encodeURIComponent(where)}&$limit=5`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return { assessedValue: null, annualTaxLevy: null, taxSource: null };

    const rows: Record<string, unknown>[] = await res.json();
    if (!rows.length) return { assessedValue: null, annualTaxLevy: null, taxSource: null };

    const exact = rows.find(r => r.house_number === houseNumber) ?? rows[0];
    const assessedValue = toNum(exact.assessed_value);
    const annualTaxLevy = assessedValue
      ? Math.round(assessedValue * (EDMONTON_2025_MILL_RATE / 1000))
      : null;

    return { assessedValue, annualTaxLevy, taxSource: assessedValue ? "estimated" : null };
  } catch {
    return { assessedValue: null, annualTaxLevy: null, taxSource: null };
  }
}

// Kept for backward compatibility — used by existing listing route
export async function fetchEdmontonAssessedValue(address: string): Promise<number | null> {
  const data = await fetchEdmontonPropertyData(address);
  return data.assessedValue;
}
