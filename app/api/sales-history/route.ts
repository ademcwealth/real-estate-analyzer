import { NextRequest, NextResponse } from "next/server";
import type { SaleRecord, SalesHistoryResult } from "@/types";
import { launchBrowser } from "@/lib/puppeteer";

function buildHonestDoorUrl(address: string, city: string, province: string): string {
  // Strip city/province/postal from the address string to get just the street part
  const streetPart = address
    .replace(/,?\s*(edmonton|calgary|red deer|lethbridge|st\.?\s*albert|sherwood park|grande prairie|airdrie|spruce grove|leduc|alberta|british columbia|ontario|quebec|manitoba|saskatchewan|nova scotia|new brunswick|prince edward island|newfoundland|AB|BC|ON|QC|MB|SK|NS|NB|PE|NL)\b.*/gi, "")
    .trim();

  const streetSlug = streetPart
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const provSlug = province.toLowerCase();

  // HonestDoor URL pattern: /property/{province}/{city}/{street}-{city}-{province}
  return `https://www.honestdoor.com/property/${provSlug}/${citySlug}/${streetSlug}-${citySlug}-${provSlug}`;
}

// Recursively search for an array that looks like sale/transaction records
function findSalesData(obj: unknown, depth = 0): SaleRecord[] | null {
  if (depth > 8 || !obj || typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return null;
    const first = obj[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const keys = Object.keys(first as object).map((k) => k.toLowerCase());
      const hasDateField = keys.some((k) =>
        ["date", "sold", "sale", "transfer", "recorded", "closing"].some((t) => k.includes(t))
      );
      const hasPriceField = keys.some((k) =>
        ["price", "amount", "value", "cost"].some((t) => k.includes(t))
      );
      if (hasDateField && hasPriceField) {
        const records = parseSaleRecords(obj);
        if (records.length > 0) return records;
      }
    }
    for (const item of obj) {
      const found = findSalesData(item, depth + 1);
      if (found && found.length > 0) return found;
    }
    return null;
  }

  const o = obj as Record<string, unknown>;
  // Check likely transaction key names first
  const txKeys = [
    "transactions", "sales", "soldHistory", "saleHistory",
    "propertyHistory", "transferHistory", "landTitleHistory", "priceHistory",
    "propertyTransactions", "titleTransfers",
  ];
  for (const key of txKeys) {
    if (Array.isArray(o[key])) {
      const result = findSalesData(o[key], depth + 1);
      if (result && result.length > 0) return result;
    }
  }
  // General recursion through all values
  for (const val of Object.values(o)) {
    const found = findSalesData(val, depth + 1);
    if (found && found.length > 0) return found;
  }
  return null;
}

function parseSaleRecords(arr: unknown[]): SaleRecord[] {
  const records: SaleRecord[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;

    let date = "";
    for (const key of ["date", "saleDate", "soldDate", "transferDate", "recordedDate", "closingDate", "transactionDate"]) {
      if (typeof o[key] === "string" && (o[key] as string).length >= 4) {
        date = o[key] as string;
        break;
      }
    }

    let price = 0;
    for (const key of ["amount", "price", "soldPrice", "salePrice", "value", "transferAmount", "consideration"]) {
      if (typeof o[key] === "number" && (o[key] as number) > 0) {
        price = o[key] as number;
        break;
      }
      if (typeof o[key] === "string") {
        const n = parseFloat((o[key] as string).replace(/[^0-9.]/g, ""));
        if (!isNaN(n) && n > 0) { price = n; break; }
      }
    }

    if (date && price > 10000) {
      records.push({
        date,
        price,
        type: typeof o.type === "string" ? o.type
          : typeof o.transactionType === "string" ? o.transactionType
          : undefined,
      });
    }
  }
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function findHdEstimate(obj: unknown, depth = 0): number | null {
  if (depth > 8 || !obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findHdEstimate(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const o = obj as Record<string, unknown>;
  const estimateKeys = [
    "honestDoorPrice", "hdPrice", "estimatedValue", "estimate",
    "avm", "avmValue", "automatedValuation", "honestDoorValue",
    "honestdoorPrice", "hdEstimate",
  ];
  for (const key of estimateKeys) {
    if (typeof o[key] === "number" && (o[key] as number) > 50000) {
      return o[key] as number;
    }
  }
  for (const val of Object.values(o)) {
    const found = findHdEstimate(val, depth + 1);
    if (found) return found;
  }
  return null;
}

export async function GET(req: NextRequest) {
  let browser = null;
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") ?? "";
    const city = searchParams.get("city") ?? "Edmonton";
    const province = searchParams.get("province") ?? "AB";

    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }

    const hdUrl = buildHonestDoorUrl(address, city, province);

    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    // Suppress images/fonts to speed up load
    await page.setRequestInterception(true);
    page.on("request", (r: { resourceType: () => string; abort: () => void; continue: () => void }) => {
      if (["image", "font", "media"].includes(r.resourceType())) r.abort();
      else r.continue();
    });

    await page.goto(hdUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { nextData, bodyText }: { nextData: any; bodyText: string } = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      let nextData = null;
      try { nextData = el?.textContent ? JSON.parse(el.textContent) : null; } catch { /* ignore */ }
      return { nextData, bodyText: document.body.innerText ?? "" };
    });

    // Check if this looks like a real property page (not 404 or home)
    const isPropertyPage =
      !bodyText.toLowerCase().includes("page not found") &&
      !bodyText.toLowerCase().includes("no results") &&
      (bodyText.includes("Sold") || bodyText.includes("Transaction") ||
       bodyText.includes("HonestDoor Price") || bodyText.includes("assessed"));

    if (!isPropertyPage) {
      // Return empty — address didn't match a HonestDoor listing
      return NextResponse.json({ sales: [], hdEstimate: null, address } satisfies SalesHistoryResult);
    }

    let sales: SaleRecord[] = [];
    let hdEstimate: number | null = null;

    if (nextData) {
      sales = findSalesData(nextData) ?? [];
      hdEstimate = findHdEstimate(nextData);
    }

    // DOM text fallback: extract "Sold $X,XXX,XXX — Month YYYY" patterns
    if (sales.length === 0 && bodyText) {
      const soldPattern = /sold[^$\n]*\$([\d,]+)[^\n]*?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4}-\d{2}-\d{2})/gi;
      let m: RegExpExecArray | null;
      while ((m = soldPattern.exec(bodyText)) !== null) {
        const price = parseInt(m[1].replace(/,/g, ""), 10);
        if (price > 50000) {
          sales.push({ date: m[2].trim(), price });
        }
      }
    }

    // Fallback: look for HD estimate in visible text
    if (!hdEstimate) {
      const estimateMatch = bodyText.match(/honestdoor\s+price[^\d$]*\$([\d,]+)/i);
      if (estimateMatch) {
        const n = parseInt(estimateMatch[1].replace(/,/g, ""), 10);
        if (n > 50000) hdEstimate = n;
      }
    }

    return NextResponse.json({ sales, hdEstimate, address } satisfies SalesHistoryResult);
  } catch (err) {
    console.error("[/api/sales-history]", err);
    // Return empty rather than 500 — this is best-effort enrichment
    return NextResponse.json({ sales: [], hdEstimate: null, address: "" } satisfies SalesHistoryResult);
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
