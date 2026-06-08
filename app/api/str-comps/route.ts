import { NextRequest, NextResponse } from "next/server";

import { launchBrowser } from "@/lib/puppeteer";

export interface StrComp {
  title: string;
  subtitle: string;
  nightlyRate: number;
  beds: number | null;
  baths: number | null;
  rating: number | null;
  reviews: number;
}

export interface StrCompsResult {
  comps: StrComp[];
  stats: {
    count: number;
    avgNightly: number;
    medianNightly: number;
    minNightly: number;
    maxNightly: number;
    p25Nightly: number;
    p75Nightly: number;
    avgRating: number;
    avgReviews: number;
  };
  estimatedMonthlyRevenue: number;   // median × 21 nights (70% occupancy)
  occupancyAssumption: number;        // nights used for revenue estimate
  searchArea: string;
  beds: number;
}

function calcMedian(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function calcPct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return Math.round(s[lo] + (s[hi] - s[lo]) * (idx - lo));
}

// puppeteer-core v22+ throws on 4xx/5xx — catch and continue so the caller can try alternatives
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeGoto(page: any, url: string, opts: { waitUntil: string; timeout: number }) {
  try {
    await page.goto(url, opts);
  } catch (err) {
    if (err instanceof Error && /Unexpected status code|ERR_HTTP_RESPONSE_CODE/i.test(err.message)) {
      return false;
    }
    throw err;
  }
  return true;
}

export async function GET(req: NextRequest) {
  let browser = null;
  try {
    const { searchParams } = new URL(req.url);
    const beds = parseInt(searchParams.get("beds") || "3");
    const city = searchParams.get("city") || "Edmonton";
    const province = searchParams.get("province") || "Alberta";
    // Bounding box: passed from geocoding, widens the search to the right metro area
    const neLat = parseFloat(searchParams.get("neLat") || "53.65");
    const neLng = parseFloat(searchParams.get("neLng") || "-113.30");
    const swLat = parseFloat(searchParams.get("swLat") || "53.40");
    const swLng = parseFloat(searchParams.get("swLng") || "-113.70");

    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    // Use a 7-night stay starting next month for reliable per-night pricing
    const checkin = new Date();
    checkin.setDate(1);
    checkin.setMonth(checkin.getMonth() + 1);
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + 7);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const bboxParams =
      `&ne_lat=${neLat}&ne_lng=${neLng}&sw_lat=${swLat}&sw_lng=${swLng}`;
    const stayParams =
      `&checkin=${fmt(checkin)}&checkout=${fmt(checkout)}`;
    const filterParams =
      `?refinement_paths%5B%5D=%2Fhomes&room_types%5B%5D=Entire+home%2Fapt&min_bedrooms=${beds}&max_bedrooms=${beds}`;

    // Try URL formats from most specific to least — Airbnb varies by region/IP
    const searchUrls = [
      `https://www.airbnb.ca/s/${encodeURIComponent(city)}--${encodeURIComponent(province)}--Canada/homes${filterParams}${stayParams}${bboxParams}`,
      `https://www.airbnb.ca/s/${encodeURIComponent(city)}--Canada/homes${filterParams}${stayParams}${bboxParams}`,
      `https://www.airbnb.ca/s/${encodeURIComponent(city)}/homes${filterParams}${stayParams}${bboxParams}`,
      `https://www.airbnb.com/s/${encodeURIComponent(city)}--${encodeURIComponent(province)}--Canada/homes${filterParams}${stayParams}${bboxParams}`,
    ];

    let navigated = false;
    for (const searchUrl of searchUrls) {
      const ok = await safeGoto(page, searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
      if (ok) { navigated = true; break; }
    }
    if (!navigated) {
      // All URLs failed — last attempt with no waitUntil restriction
      await page.goto(searchUrls[0], { waitUntil: "load", timeout: 20000 }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 2000));

    const niobeListings: StrComp[] = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const txt = s.textContent || "";
        if (!txt.includes("niobeClientData") || txt.length < 50000) continue;
        try {
          const parsed = JSON.parse(txt);
          for (const entry of parsed.niobeClientData || []) {
            if (!Array.isArray(entry) || !entry[0]?.includes("StaysSearch")) continue;
            const sr =
              entry[1]?.data?.presentation?.staysSearch?.results?.searchResults;
            if (!sr) continue;

            return sr.map((r: Record<string, unknown>) => {
              // Nightly rate from price breakdown line "7 nights × $X"
              let nightlyRate: number | null = null;
              try {
                type PriceItem = { description?: string };
                const priceDetails = ((r.structuredDisplayPrice as Record<string, unknown>)
                  ?.explanationData as Record<string, unknown>)
                  ?.priceDetails as Array<{ items?: PriceItem[] }> | undefined;
                const items: PriceItem[] = priceDetails?.[0]?.items || [];
                const nightItem = items.find(
                  (i: PriceItem) => i.description?.includes("night")
                );
                if (nightItem?.description) {
                  const m = nightItem.description.match(/\$([\d,.]+)/);
                  if (m) nightlyRate = parseFloat(m[1].replace(",", ""));
                }
              } catch { /* ignore */ }

              // Rating / reviews
              const rStr = (r.avgRatingLocalized as string) || "";
              const rMatch = rStr.match(/([\d.]+)\s*\((\d+)\)/);
              const rating = rMatch ? parseFloat(rMatch[1]) : null;
              const reviews = rMatch ? parseInt(rMatch[2]) : 0;

              // Beds/baths from structuredContent
              let beds: number | null = null;
              let baths: number | null = null;
              try {
                const str = JSON.stringify(r.structuredContent || {});
                const bedM = str.match(/"([\d]+)\s*bedroom/);
                const bathM = str.match(/"([\d.]+)\s*bath/);
                if (bedM) beds = parseInt(bedM[1]);
                if (bathM) baths = parseFloat(bathM[1]);
              } catch { /* ignore */ }

              return {
                title: (r.title as string) || (r.nameLocalized as string) || "",
                subtitle: (r.subtitle as string) || "",
                nightlyRate,
                beds,
                baths,
                rating,
                reviews,
              };
            }).filter((l: StrComp) => l.nightlyRate && l.nightlyRate > 50);
          }
        } catch { /* ignore */ }
      }
      return [];
    });

    // Fallback: if niobeClientData returned nothing, scrape visible price text from listing cards
    let listings: StrComp[] = niobeListings;
    if (listings.length === 0) {
      const domListings: StrComp[] = await page.evaluate(() => {
        const results: { title: string; subtitle: string; nightlyRate: number | null; beds: number | null; baths: number | null; rating: number | null; reviews: number }[] = [];
        // Each listing card is a <div> containing an aria-label with the price
        const cards = Array.from(document.querySelectorAll('[data-testid="card-container"], [itemprop="itemListElement"]'));
        for (const card of cards) {
          const text = card.textContent || "";
          // Price: "$123 per night" or "$123 / night" or "$123/night"
          const priceM = text.match(/\$([\d,]+)\s*(?:per|\/)\s*night/i) || text.match(/\$([\d,]+)\s*night/i);
          const nightlyRate = priceM ? parseFloat(priceM[1].replace(",", "")) : null;
          if (!nightlyRate || nightlyRate < 30) continue;
          // Rating: "4.85 (123 reviews)" or "4.85"
          const ratingM = text.match(/([\d.]{3,4})\s*\((\d+)\)/);
          const titleEl = card.querySelector("div[data-testid='listing-card-title'], [id*='title']");
          results.push({
            title: titleEl?.textContent?.trim() || "",
            subtitle: "",
            nightlyRate,
            beds: null,
            baths: null,
            rating: ratingM ? parseFloat(ratingM[1]) : null,
            reviews: ratingM ? parseInt(ratingM[2]) : 0,
          });
        }
        return results;
      });
      listings = domListings.filter((l) => l.nightlyRate && l.nightlyRate > 50) as StrComp[];
    }

    if (listings.length === 0) {
      return NextResponse.json(
        { error: `No Airbnb listings found for ${beds}-bed in ${city}. Airbnb may be blocking the request — try again.` },
        { status: 404 }
      );
    }

    const rates = listings.map((l) => l.nightlyRate).filter(Boolean) as number[];
    const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    const med = calcMedian(rates);

    // Edmonton Airbnb occupancy benchmark: ~65–70% (≈19–21 nights/month)
    const OCCUPANCY_NIGHTS = 20;
    const estimatedMonthlyRevenue = Math.round(med * OCCUPANCY_NIGHTS);

    const ratings = listings.map((l) => l.rating).filter(Boolean) as number[];
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
        : 0;
    const avgReviews = Math.round(
      listings.reduce((a, b) => a + b.reviews, 0) / listings.length
    );

    return NextResponse.json({
      comps: listings.slice(0, 30),
      stats: {
        count: rates.length,
        avgNightly: avg,
        medianNightly: med,
        minNightly: rates[0] ? Math.round(Math.min(...rates)) : 0,
        maxNightly: rates.length ? Math.round(Math.max(...rates)) : 0,
        p25Nightly: calcPct(rates, 25),
        p75Nightly: calcPct(rates, 75),
        avgRating,
        avgReviews,
      },
      estimatedMonthlyRevenue,
      occupancyAssumption: OCCUPANCY_NIGHTS,
      searchArea: `${city} (${beds} bed, entire home)`,
      beds,
    } as StrCompsResult);
  } catch (err) {
    console.error("[/api/str-comps]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error — please try again" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
