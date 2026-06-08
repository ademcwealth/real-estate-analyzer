import { NextRequest, NextResponse } from "next/server";
import { launchBrowser } from "@/lib/puppeteer";

// Listing types that represent entire rentable units (not rooms or shared spaces)
const WHOLE_UNIT_TYPES = new Set([
  "apartment", "basement", "town_house_community", "town_house",
  "house", "multi_unit", "single_family_home", "condo",
  "main_floor", "home_community", "fourplex", "duplex", "triplex",
  "semi_detached", "detached",
]);

// Minimum reasonable monthly rent per bedroom count (filters out rooms-for-rent)
const MIN_RENT_BY_BEDS: Record<number, number> = {
  1: 750, 2: 1000, 3: 1200, 4: 1500, 5: 1800,
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

async function geocodeNeighbourhood(
  address: string
): Promise<{ neighbourhood: string | null; city: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1&countrycodes=ca`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RE-Analyzer/1.0 (real-estate-investment-tool)" },
      signal: AbortSignal.timeout(5000),
    });
    const results = await res.json();
    if (!results?.length) return { neighbourhood: null, city: "Edmonton" };
    const addr = results[0].address;
    return {
      neighbourhood: addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? null,
      city: addr.city ?? addr.town ?? addr.municipality ?? "Edmonton",
    };
  } catch {
    return { neighbourhood: null, city: "Edmonton" };
  }
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

const GQL = `query RentalListingSearch($first: PositiveInt, $place: PlaceInput!, $filters: RentalListingsConnectionFilterSet) {
  rentalListings(first: $first, place: $place, filters: $filters) {
    meta { totalCount }
    edges {
      node {
        id type listingType rentRange bedsRange bathsRange sizeRange
        address { cityName street neighbourhoodName postalCode }
        floorPlans { beds baths sqft rent size }
      }
    }
  }
}`;

/** Fire one GraphQL search via the Puppeteer page context */
async function runSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  headers: Record<string, string>,
  namedArea: string,
  radiusM: number,
  bedsFilter: number[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(
    async (
      h: Record<string, string>,
      gql: string,
      na: string,
      rm: number,
      bf: number[]
    ) => {
      const body = {
        operationName: "RentalListingSearch",
        query: gql,
        variables: {
          first: 200,
          place: { namedAreaDistance: { distance: rm, namedArea: na } },
          filters: { beds: bf },
        },
      };
      // Retry once on empty/bad body
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("https://rentals.ca/graphql", {
            method: "POST", headers: h, body: JSON.stringify(body),
          });
          const text = await res.text();
          if (text && text.trim()) return JSON.parse(text);
        } catch { /* ignore, retry */ }
      }
      return null; // both attempts failed — signal caller
    },
    headers, GQL, namedArea, radiusM, bedsFilter
  );
}

// puppeteer-core v22+ throws on 4xx/5xx status codes — catch and continue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeGoto(page: any, url: string, opts: { waitUntil: string; timeout: number }) {
  try {
    await page.goto(url, opts);
  } catch (err) {
    if (err instanceof Error && /Unexpected status code|ERR_HTTP_RESPONSE_CODE/i.test(err.message)) {
      return; // page may still have partial DOM — caller decides whether to continue
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  let browser = null;
  try {
    const { searchParams } = new URL(req.url);
    const rawCity = searchParams.get("city") || "Edmonton";
    const beds = parseInt(searchParams.get("beds") || "3");
    const address = searchParams.get("address") || "";

    // Geocode to get neighbourhood (runs server-side, no Puppeteer needed)
    const { neighbourhood, city: geocodedCity } = address
      ? await geocodeNeighbourhood(address)
      : { neighbourhood: null, city: rawCity };

    const city = geocodedCity.toLowerCase();
    const province = "ab";

    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    // Capture session headers from the page's own GraphQL request
    let realHeaders: Record<string, string> = {};
    await page.setRequestInterception(true);
    page.on("request", (r: { url: () => string; method: () => string; headers: () => Record<string, string>; continue: () => void }) => {
      if (r.url().includes("graphql") && r.method() === "POST") {
        realHeaders = r.headers();
      }
      r.continue();
    });

    // Try multiple URL formats — rentals.ca city slugs vary and some return 404 from non-CA IPs
    const citySlug = city.replace(/\s+/g, "-");
    const candidateUrls = [
      `https://rentals.ca/${citySlug}?bd-mn=${beds}&bd-mx=${beds}`,
      `https://rentals.ca/${citySlug}-ab?bd-mn=${beds}&bd-mx=${beds}`,
      `https://rentals.ca/${citySlug}`,
      `https://rentals.ca/`,
    ];
    for (const navUrl of candidateUrls) {
      await safeGoto(page, navUrl, { waitUntil: "networkidle2", timeout: 25000 });
      await new Promise((r) => setTimeout(r, 1500));
      if (realHeaders["content-type"] || realHeaders["x-csrf-token"]) break;
    }

    // Search strategies: neighbourhood-first, expand to city as fallback
    const strategies: Array<{ namedArea: string; radiusM: number; label: string }> = [];
    if (neighbourhood) {
      strategies.push({ namedArea: `${neighbourhood}, ${city}, ${province}, ca`, radiusM: 3000, label: `${neighbourhood} (3 km)` });
      strategies.push({ namedArea: `${neighbourhood}, ${city}, ${province}, ca`, radiusM: 5000, label: `${neighbourhood} (5 km)` });
    }
    strategies.push({ namedArea: `${city}, ${province}, ca`, radiusM: 5000, label: `${city} (5 km)` });
    strategies.push({ namedArea: `${city}, ${province}, ca`, radiusM: 15000, label: `${city} (15 km)` });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawResult: any = null;
    let usedLabel = strategies[strategies.length - 1].label;

    for (const strategy of strategies) {
      const r = await runSearch(page, realHeaders, strategy.namedArea, strategy.radiusM, [beds]);
      if (!r || r.errors) continue;
      const count: number = r?.data?.rentalListings?.meta?.totalCount ?? 0;
      rawResult = r;
      usedLabel = strategy.label;
      if (count >= 8) break; // good enough — stop expanding
    }

    const edges: Array<{
      node: {
        type: string; listingType: string;
        rentRange: number[]; bedsRange: number[]; bathsRange: number[]; sizeRange: number[];
        address: { cityName: string; street: string; neighbourhoodName: string | null; postalCode: string };
        floorPlans: Array<{ beds: number; baths: number; sqft: number | null; rent: number; size: number | null }>;
      };
    }> = rawResult?.data?.rentalListings?.edges || [];

    const minRent = MIN_RENT_BY_BEDS[beds] ?? beds * 400;
    const comps: RentalComp[] = [];

    for (const { node } of edges) {
      const listingType = node.listingType || "";
      if (listingType.includes("room") || listingType.includes("shared")) continue;
      const nodeType = node.type || "";
      if (nodeType && !WHOLE_UNIT_TYPES.has(nodeType)) continue;

      for (const fp of node.floorPlans) {
        if (Math.floor(fp.beds) !== beds) continue;
        if (fp.rent <= 0 || fp.rent < minRent) continue;
        comps.push({
          address: node.address.street || "Address not listed",
          neighbourhood: node.address.neighbourhoodName,
          beds: Math.floor(fp.beds),
          baths: fp.baths,
          sqft: fp.size || fp.sqft || null,
          rent: fp.rent,
          listingType,
        });
      }
    }

    if (comps.length === 0) {
      return NextResponse.json(
        { error: `No ${beds}-bedroom rental listings found near ${usedLabel}. Try a different bedroom count.` },
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
      city, neighbourhood, searchArea: usedLabel, beds,
    } as RentalCompsResult);

  } catch (err) {
    console.error("[/api/rentals] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error — please try again" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore close errors */ }
    }
  }
}
