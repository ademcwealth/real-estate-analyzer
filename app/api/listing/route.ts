import { NextRequest, NextResponse } from "next/server";
import type { PropertyListing } from "@/types";
import { fetchEdmontonAssessedValue } from "@/lib/edmonton-assessment";
import { launchBrowser } from "@/lib/puppeteer";

const PROVINCE_CODES: Record<string, string> = {
  Alberta: "AB", "British Columbia": "BC", Ontario: "ON", Quebec: "QC",
  Manitoba: "MB", Saskatchewan: "SK", "Nova Scotia": "NS",
  "New Brunswick": "NB", "Prince Edward Island": "PE", Newfoundland: "NL",
};

function extractListingId(url: string): string | null {
  const match = url.match(/\/real-estate\/(\d+)/);
  if (match) return match[1];
  const mlsMatch = url.match(/^(\d{7,9})$/);
  if (mlsMatch) return mlsMatch[1];
  return null;
}

function slugToAddress(url: string): string {
  const match = url.match(/\/real-estate\/\d+\/([^?#]+)/);
  if (!match) return "";
  return match[1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function parseNum(s: string): number {
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Try to extract structured data from realtor.ca's embedded Next.js JSON blob
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFromNextData(data: any, listingUrl: string): PropertyListing | null {
  try {
    // Walk common paths where realtor.ca stores listing data
    const props =
      data?.props?.pageProps?.listingData ??
      data?.props?.pageProps?.listing ??
      data?.props?.pageProps?.property ??
      data?.props?.pageProps;

    if (!props) return null;

    const price =
      props.ListPrice ?? props.listPrice ?? props.Price ?? props.price ?? 0;
    const address =
      props.Address?.AddressText ??
      props.address?.fullAddress ??
      props.StreetAddress ??
      slugToAddress(listingUrl);
    const bedrooms =
      props.BedroomsTotal ?? props.Bedrooms ?? props.bedrooms ?? 3;
    const bathrooms =
      props.BathroomsTotal ?? props.Bathrooms ?? props.bathrooms ?? 2;
    const sqft =
      props.BuildingSizeInterior ?? props.SquareFootage ?? props.sqft ?? undefined;
    const propertyType =
      props.PropertyType ?? props.propertyType ?? props.BuildingType ?? "Residential";
    const city =
      props.Address?.City ?? props.city ?? "Edmonton";
    const provinceFull =
      props.Address?.ProvinceCode ?? props.Address?.Province ?? props.province ?? "Alberta";
    const province = PROVINCE_CODES[provinceFull] ?? provinceFull ?? "AB";
    const mlsNumber =
      props.MlsNumber ?? props.mlsNumber ?? props.ListingKey ?? undefined;
    const description =
      props.PublicRemarks ?? props.description ?? props.Description ?? undefined;

    if (!price && !address) return null;

    return {
      address: String(address),
      price: Number(price),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      sqft: sqft ? Number(sqft) : undefined,
      propertyType: String(propertyType),
      city: String(city),
      province: String(province).substring(0, 2).toUpperCase(),
      mlsNumber: mlsNumber ? String(mlsNumber) : undefined,
      description: description ? String(description).substring(0, 500) : undefined,
    };
  } catch {
    return null;
  }
}

function parseFromText(text: string, title: string, listingUrl: string): PropertyListing {
  // --- Price ---
  const priceMatch = text.match(/\$([\d,]+)/);
  const price = priceMatch ? parseNum(priceMatch[1]) : 0;

  // --- Address: slug from URL as best available source in plain HTML ---
  const address = slugToAddress(listingUrl);

  // --- Bedrooms ---
  const bedsMatch = text.match(/(\d+)\s*Bedrooms?/i);
  const bedrooms = bedsMatch ? parseInt(bedsMatch[1]) : 3;

  // --- Bathrooms ---
  const bathsMatch = text.match(/(\d+\.?\d*)\s*Bathrooms?/i);
  const bathrooms = bathsMatch ? parseFloat(bathsMatch[1]) : 2;

  // --- Square footage ---
  const sqftMatch =
    text.match(/([\d,]+)\s*Square\s*Feet/i) ||
    text.match(/Square\s+Footage\s+([\d,]+)/i) ||
    text.match(/([\d,]+)\s*sqft/i);
  const sqft = sqftMatch ? parseNum(sqftMatch[1]) : undefined;

  // --- MLS number ---
  const mlsMatch =
    text.match(/MLS[®°\s#]*Number[:\s]*([A-Z]\d{6,8})/i) ||
    title.match(/[-–]\s*([A-Z]\d{6,8})\s*\|/);
  const mlsNumber = mlsMatch ? mlsMatch[1] : undefined;

  // --- Property type ---
  const typeMatch = text.match(/Property\s+Type\s*[:\s]+([A-Za-z /]+?)(?:\s{2,}|$)/i);
  const propertyType = typeMatch?.[1]?.trim() ?? "Residential";

  // --- City & province from page title ---
  // "For sale: 123 Main St, Edmonton, Alberta T5R1B7 - E4490844 | REALTOR.ca"
  const titleCityMatch = title.match(
    /,\s*([A-Za-z\s]+),\s*(Alberta|British Columbia|Ontario|Quebec|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Prince Edward Island|Newfoundland)\s+[A-Z]\d/i
  );
  const city = titleCityMatch?.[1]?.trim() ?? "Edmonton";
  const provinceFull = titleCityMatch?.[2]?.trim() ?? "Alberta";
  const province = PROVINCE_CODES[provinceFull] ?? "AB";

  return {
    address,
    price,
    bedrooms,
    bathrooms,
    sqft,
    propertyType,
    city,
    province,
    mlsNumber,
    description: undefined,
  };
}

async function scrapeWithFetch(listingUrl: string): Promise<PropertyListing> {
  const res = await fetch(listingUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
    // Vercel functions have a 10s default — give it up to 25s
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from realtor.ca`);
  }

  const html = await res.text();

  // Check for "no longer active" in raw HTML
  if (
    /listing[^<]*no longer (exists|available|active)/i.test(html) ||
    /This listing is no longer/i.test(html)
  ) {
    throw new Error("Listing no longer active");
  }

  // --- Extract page title ---
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

  // --- Try __NEXT_DATA__ blob first (realtor.ca is a Next.js app) ---
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const parsed = parseFromNextData(nextData, listingUrl);
      if (parsed && (parsed.price > 0 || parsed.address)) return parsed;
    } catch {
      // fall through
    }
  }

  // --- Fallback: strip HTML and apply regex patterns ---
  const text = stripHtml(html);
  return parseFromText(text, title, listingUrl);
}

async function scrapeWithPuppeteer(listingUrl: string): Promise<PropertyListing> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    // Block images/fonts/media to speed up load
    await page.setRequestInterception(true);
    page.on("request", (r: { resourceType: () => string; abort: () => void; continue: () => void }) => {
      if (["image", "font", "media", "stylesheet"].includes(r.resourceType())) r.abort();
      else r.continue();
    });

    await page.goto(listingUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { nextData, bodyText }: { nextData: any; bodyText: string } = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      let nextData = null;
      try { nextData = el?.textContent ? JSON.parse(el.textContent) : null; } catch { /* ignore */ }
      return { nextData, bodyText: document.body.innerText ?? "" };
    });

    if (nextData) {
      const parsed = parseFromNextData(nextData, listingUrl);
      if (parsed && parsed.price > 0) return parsed;
    }

    // Fallback: parse visible text
    const titleMatch = bodyText.match(/for sale[:\s]+(.+)/i);
    const title = titleMatch?.[1] ?? "";
    return parseFromText(bodyText, title, listingUrl);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const listingId = extractListingId(url);
  if (!listingId) {
    return NextResponse.json(
      {
        error:
          "Please use a realtor.ca URL like: https://www.realtor.ca/real-estate/12345678/address",
        manualEntry: true,
        addressHint: slugToAddress(url),
      },
      { status: 400 }
    );
  }

  const listingUrl = url.startsWith("http")
    ? url
    : `https://www.realtor.ca/real-estate/${listingId}`;

  try {
    let listing = await scrapeWithFetch(listingUrl);

    // If plain fetch was blocked (Incapsula) and returned price=0, retry with Puppeteer
    if (listing.price === 0) {
      try {
        const puppeteerListing = await scrapeWithPuppeteer(listingUrl);
        if (puppeteerListing.price > 0) listing = puppeteerListing;
      } catch {
        // Puppeteer fallback failed — keep the fetch result, show price editor
      }
    }

    // Enrich with actual assessed value from Edmonton Open Data (best-effort)
    if (listing.city.toLowerCase().includes("edmonton")) {
      const assessedValue = await fetchEdmontonAssessedValue(listing.address);
      if (assessedValue) listing.assessedValue = assessedValue;
    }

    if (listing.price === 0) {
      return NextResponse.json({
        listing,
        partial: true,
        warning:
          "Property loaded but price could not be read automatically — please enter it below.",
      });
    }

    return NextResponse.json({ listing });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Scrape error:", msg);

    if (msg.includes("no longer active")) {
      return NextResponse.json(
        {
          error:
            "This listing is no longer active on realtor.ca. Enter the details manually if you have them.",
          manualEntry: true,
          addressHint: slugToAddress(url),
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: "Could not fetch the listing automatically. Enter the details below.",
        manualEntry: true,
        addressHint: slugToAddress(url),
      },
      { status: 422 }
    );
  }
}
