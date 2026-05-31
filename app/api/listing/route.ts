import { NextRequest, NextResponse } from "next/server";
import type { PropertyListing } from "@/types";
import { fetchEdmontonAssessedValue } from "@/lib/edmonton-assessment";

const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

async function scrapeWithPuppeteer(listingUrl: string): Promise<PropertyListing> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require("puppeteer-core");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await puppeteer.launch && browser.newPage
      ? await browser.newPage()
      : null;
    if (!page) throw new Error("Could not open page");

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    await page.goto(listingUrl, { waitUntil: "networkidle2", timeout: 30000 });
    // Extra wait for React hydration
    await new Promise((r) => setTimeout(r, 2000));

    const raw = await page.evaluate(() => {
      const bodyText = document.body.innerText ?? "";
      const title = document.title ?? "";
      // H1 can have child spans without whitespace — collect them with spaces
      const h1El = document.querySelector("h1");
      const h1 = h1El
        ? Array.from(h1El.childNodes)
            .map((n) => n.textContent?.trim())
            .filter(Boolean)
            .join(", ")
        : "";
      return { bodyText, title, h1 };
    });

    // Check if listing no longer exists
    if (raw.h1.toLowerCase().includes("no longer exists") || raw.h1.toLowerCase().includes("not found")) {
      throw new Error("Listing no longer active");
    }

    const text = raw.bodyText;

    // --- Price ---
    const priceMatch = text.match(/\$([\d,]+)/);
    const price = priceMatch ? parseNum(priceMatch[1]) : 0;

    // --- Address: from H1 (normalise spacing) ---
    const address = raw.h1.replace(/\s+/g, " ").trim() || slugToAddress(listingUrl);

    // --- Bedrooms: "3 Bedrooms" or "3\nBedrooms" ---
    const bedsMatch = text.match(/(\d+)\s*\n?\s*Bedrooms?/i);
    const bedrooms = bedsMatch ? parseInt(bedsMatch[1]) : 3;

    // --- Bathrooms: "2 Bathrooms" ---
    const bathsMatch = text.match(/(\d+\.?\d*)\s*\n?\s*Bathrooms?/i);
    const bathrooms = bathsMatch ? parseFloat(bathsMatch[1]) : 2;

    // --- Square footage ---
    const sqftMatch = text.match(/([\d,]+)\s*\n?\s*Square\s*Feet/i) ||
      text.match(/Square\s+Footage\s+([\d,]+)/i) ||
      text.match(/([\d,]+)\s*sqft/i);
    const sqft = sqftMatch ? parseNum(sqftMatch[1]) : undefined;

    // --- MLS number — matches e.g. E4490844, C1234567, X9876543 ---
    const mlsMatch = text.match(/MLS[®°\s#]*Number[:\s]*([A-Z]\d{6,8})/i) ||
      raw.title.match(/[-–]\s*([A-Z]\d{6,8})\s*\|/);
    const mlsNumber = mlsMatch ? mlsMatch[1] : undefined;

    // --- Property type ---
    const typeMatch = text.match(/Property\s+Type\s*\n?\s*([^\n]+)/i);
    const buildingMatch = text.match(/Building\s+Type\s*\n?\s*([^\n]+)/i);
    const propertyType = typeMatch?.[1]?.trim() ?? buildingMatch?.[1]?.trim() ?? "Residential";

    // --- City & province — extract from page title which is reliably formatted ---
    // Title pattern: "For sale: 123 Main St, Edmonton, Alberta T5R1B7 - E4490844 | REALTOR.ca"
    const titleCityMatch = raw.title.match(/,\s*([A-Za-z\s]+),\s*(Alberta|British Columbia|Ontario|Quebec|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Prince Edward Island|Newfoundland)\s+[A-Z]\d/i);
    const PROVINCE_CODES: Record<string, string> = {
      Alberta: "AB", "British Columbia": "BC", Ontario: "ON", Quebec: "QC",
      Manitoba: "MB", Saskatchewan: "SK", "Nova Scotia": "NS",
      "New Brunswick": "NB", "Prince Edward Island": "PE", Newfoundland: "NL",
    };
    const city = titleCityMatch?.[1]?.trim() ?? "Edmonton";
    const provinceFull = titleCityMatch?.[2]?.trim() ?? "Alberta";
    const province = PROVINCE_CODES[provinceFull] ?? "AB";

    // --- Description ---
    const descMatch = text.match(/Listing\s+Description\s*\n([\s\S]{50,600}?)(?:\n\n|\nProperty\s+Summary)/i);
    const description = descMatch?.[1]?.trim().substring(0, 500);

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
      description,
    };
  } finally {
    await browser.close();
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
    const listing = await scrapeWithPuppeteer(listingUrl);

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
          "Property loaded but price could not be read automatically — please confirm it below.",
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
        error:
          "Could not fetch the listing automatically. Enter the details below.",
        manualEntry: true,
        addressHint: slugToAddress(url),
      },
      { status: 422 }
    );
  }
}
