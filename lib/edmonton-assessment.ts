const SOCRATA_URL = "https://data.edmonton.ca/resource/q7d6-ambg.json";

function parseEdmontonAddress(address: string): { houseNumber: string; streetKeyword: string } | null {
  // Strip city/province suffix: "10709 74 Avenue NW, Edmonton, Alberta T5R 1B7"
  const cleaned = address
    .replace(/,?\s*(Edmonton|Calgary|Alberta|AB)\b.*/i, "")
    .trim()
    .toUpperCase();

  // First token must be all-digits house number
  const match = cleaned.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  const houseNumber = match[1];
  // Use first meaningful word of the street name as the keyword (avoids directional suffix mismatch)
  const streetWords = match[2].split(/\s+/).filter(w => w.length > 2);
  const streetKeyword = streetWords[0] ?? match[2];

  return { houseNumber, streetKeyword };
}

export async function fetchEdmontonAssessedValue(address: string): Promise<number | null> {
  const parsed = parseEdmontonAddress(address);
  if (!parsed) return null;

  const { houseNumber, streetKeyword } = parsed;

  const where = `house_number='${houseNumber}' AND street_name like '%${streetKeyword}%'`;
  const url = `${SOCRATA_URL}?$where=${encodeURIComponent(where)}&$limit=5`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const rows: Array<{ assessed_value?: string; house_number?: string; street_name?: string }> = await res.json();
    if (!rows.length) return null;

    // If multiple rows, pick the one whose house_number matches exactly
    const exact = rows.find(r => r.house_number === houseNumber) ?? rows[0];
    const val = parseInt(exact.assessed_value ?? "", 10);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}
