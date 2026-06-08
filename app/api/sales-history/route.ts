import { NextRequest, NextResponse } from "next/server";
import type { SaleRecord, SalesHistoryResult } from "@/types";

function buildHonestDoorUrl(address: string, city: string, province: string): string {
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

  return `https://www.honestdoor.com/property/${provSlug}/${citySlug}/${streetSlug}-${citySlug}-${provSlug}`;
}

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
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") ?? "";
    const city = searchParams.get("city") ?? "Edmonton";
    const province = searchParams.get("province") ?? "AB";

    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }

    const hdUrl = buildHonestDoorUrl(address, city, province);

    const res = await fetch(hdUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ sales: [], hdEstimate: null, address } satisfies SalesHistoryResult);
    }

    const html = await res.text();

    // HonestDoor is a Next.js app — try __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    let sales: SaleRecord[] = [];
    let hdEstimate: number | null = null;

    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        // Only worth searching if pageProps has content (not a client-side shell)
        const pageProps = nextData?.props?.pageProps;
        if (pageProps && Object.keys(pageProps).length > 2) {
          sales = findSalesData(nextData) ?? [];
          hdEstimate = findHdEstimate(nextData);
        }
      } catch { /* ignore parse errors */ }
    }

    // Text fallback: "Sold $X,XXX,XXX — Month YYYY"
    if (sales.length === 0) {
      const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const soldPattern = /sold[^$\n]*\$([\d,]+)[^\n]*?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4}-\d{2}-\d{2})/gi;
      let m: RegExpExecArray | null;
      while ((m = soldPattern.exec(bodyText)) !== null) {
        const price = parseInt(m[1].replace(/,/g, ""), 10);
        if (price > 50000) sales.push({ date: m[2].trim(), price });
      }
    }

    return NextResponse.json({ sales, hdEstimate, address } satisfies SalesHistoryResult);
  } catch (err) {
    console.error("[/api/sales-history]", err);
    return NextResponse.json({ sales: [], hdEstimate: null, address: "" } satisfies SalesHistoryResult);
  }
}
