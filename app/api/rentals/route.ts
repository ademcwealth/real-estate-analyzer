import { NextRequest, NextResponse } from "next/server";

// Kijiji location IDs for major Canadian cities (c37 = apartments/condos category)
const KIJIJI_LOCATIONS: Record<string, string> = {
  edmonton: "1700203",
  calgary: "1700199",
  "red deer": "1700283",
  lethbridge: "1700282",
  "fort mcmurray": "1700289",
  "grande prairie": "1700288",
  airdrie: "1700280",
  "spruce grove": "1700285",
  leduc: "1700281",
  "st. albert": "1700284",
  vancouver: "1700023",
  victoria: "1700277",
  kelowna: "1700228",
  abbotsford: "1700225",
  toronto: "1700273",
  ottawa: "1700185",
  hamilton: "1700212",
  london: "1700214",
  kingston: "1700269",
  windsor: "1700216",
  winnipeg: "1700192",
  saskatoon: "1700286",
  regina: "1700274",
  halifax: "1700255",
};

export interface RentalComp {
  address: string;
  neighbourhood: string | null;
  beds: number;
  baths: number;
  sqft: number | null;
  rent: number;
  listingType: string;
}

export interface RentalCompsResult {
  comps: RentalComp[];
  stats: {
    count: number; avg: number; median: number;
    min: number; max: number; p25: number; p75: number;
  };
  city: string;
  neighbourhood: string | null;
  searchArea: string;
  beds: number;
}

function calcMedian(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function calcPercentile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return Math.round(s[lo] + (s[hi] - s[lo]) * (idx - lo));
}

// Minimum reasonable monthly rent per bedroom count (filters rooms-for-rent)
const MIN_RENT: Record<number, number> = { 1: 700, 2: 900, 3: 1100, 4: 1400, 5: 1700 };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCity = (searchParams.get("city") || "Edmonton").trim();
    const beds = parseInt(searchParams.get("beds") || "3");

    const cityLower = rawCity.toLowerCase();
    const citySlug = cityLower.replace(/\s+/g, "-");
    const locationId = KIJIJI_LOCATIONS[cityLower];

    const kijijiUrl = locationId
      ? `https://www.kijiji.ca/b-apartments-condos/${citySlug}/c37l${locationId}`
      : `https://www.kijiji.ca/b-apartments-condos/${citySlug}/c37`;

    const res = await fetch(kijijiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Rental data not available for ${rawCity}. Kijiji returned ${res.status}.` },
        { status: 404 }
      );
    }

    const html = await res.text();

    // Kijiji embeds listing data as JSON-LD (schema.org)
    const ldMatch = html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ldMatch) {
      return NextResponse.json(
        { error: `Could not parse rental listings for ${rawCity}.` },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ldData: any;
    try { ldData = JSON.parse(ldMatch[1]); } catch {
      return NextResponse.json({ error: "Failed to parse Kijiji listing data." }, { status: 500 });
    }

    const items: Array<Record<string, unknown>> =
      (ldData?.itemListElement ?? []).map((i: Record<string, unknown>) => i.item ?? i);

    const minRent = MIN_RENT[beds] ?? beds * 380;
    const comps: RentalComp[] = [];

    for (const item of items) {
      const listingBeds = parseFloat(String(item.numberOfBedrooms ?? "0"));
      if (Math.floor(listingBeds) !== beds) continue;

      const rent = parseFloat(String((item.offers as Record<string, unknown>)?.price ?? "0"));
      if (!rent || rent < minRent || rent > 15000) continue;

      const baths = parseFloat(String(item.numberOfBathroomsTotal ?? "1")) || 1;
      const sqftVal = parseFloat(String((item.floorSize as Record<string, unknown>)?.value ?? "0"));
      const sqft = sqftVal > 0 ? sqftVal : null;

      const addrObj = item.address as Record<string, unknown> | string | undefined;
      const address = typeof addrObj === "string"
        ? addrObj
        : (addrObj as Record<string, unknown>)?.streetAddress as string
          ?? String(addrObj ?? "").split(",")[0]
          ?? "Address not listed";

      comps.push({
        address: address.trim() || "Address not listed",
        neighbourhood: null,
        beds,
        baths,
        sqft,
        rent,
        listingType: String(item["@type"] ?? "apartment").toLowerCase(),
      });
    }

    if (comps.length === 0) {
      return NextResponse.json(
        { error: `No ${beds}-bedroom listings found on Kijiji for ${rawCity}. Try a different bedroom count.` },
        { status: 404 }
      );
    }

    comps.sort((a, b) => a.rent - b.rent);
    const rents = comps.map((c) => c.rent);
    const avg = Math.round(rents.reduce((s, r) => s + r, 0) / rents.length);

    return NextResponse.json({
      comps: comps.slice(0, 40),
      stats: {
        count: comps.length, avg,
        median: calcMedian(rents),
        min: rents[0], max: rents[rents.length - 1],
        p25: calcPercentile(rents, 25), p75: calcPercentile(rents, 75),
      },
      city: rawCity, neighbourhood: null,
      searchArea: `${rawCity} (via Kijiji)`,
      beds,
    } as RentalCompsResult);

  } catch (err) {
    console.error("[/api/rentals] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error — please try again" },
      { status: 500 }
    );
  }
}
