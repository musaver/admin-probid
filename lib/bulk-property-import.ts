import { db } from "@/lib/db";
import { property, user as userTable } from "@/lib/schema";
import { eq, and, inArray, or } from "drizzle-orm";

export const VALID_PROPERTY_STATUSES = [
  "active",
  "sold",
  "withdrawn",
  "on_list",
  "sold_at_tax_sale",
  "redeemed",
  "voided",
  "cancelled",
  "deed_in_progress",
  "deed_issued",
  "redeemed_check_issued",
] as const;

export type ValidPropertyStatus = (typeof VALID_PROPERTY_STATUSES)[number];

export interface NormalizedBulkRow {
  title: string;
  parcelId?: string | null;
  saleId: string;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  minBid?: string | null;
  winningBid?: string | null;
  auctionStart?: Date | null;
  auctionEnd?: Date | null;
  owners: string[];
  status: ValidPropertyStatus;
  bidderEmail?: string | null;
  bidderNumber?: string | null;
}

function trimStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/** Spreadsheet rows use varying header spellings — resolve common aliases */
export function coerceRow(raw: Record<string, unknown>): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};
  const keyMap = Object.fromEntries(Object.keys(raw).map((k) => [k.toLowerCase().replace(/\s+/g, ""), k]));

  function get(...aliases: string[]): string | number | undefined {
    for (const a of aliases) {
      const norm = a.toLowerCase().replace(/\s+/g, "");
      const orig = keyMap[norm];
      if (orig !== undefined && raw[orig] !== undefined && raw[orig] !== null && String(raw[orig]).trim() !== "") {
        const val = raw[orig];
        if (typeof val === "number") return val;
        return String(val).trim();
      }
    }
    return undefined;
  }

  out["Title"] = get("Title", "DisplayTitle", "PropertyTitle") as string | undefined;
  out["Sale ID"] = get("Sale ID", "SaleID", "sale_id");
  out["Parcel ID"] = get("Parcel ID", "ParcelID", "ParcelId", "Map ID", "map_id");
  out["Address"] = get("Address");
  out["City"] = get("City");
  out["Zip Code"] = get("Zip Code", "Zip", "ZipCode", "ZIP");
  out["Minimum Bid"] = get("Minimum Bid", "Min Bid", "MinimumBid");
  out["Winning Bid"] = get("Winning Bid", "WinningBid");
  /* Column order in template: Bidder Email / Bidder Number after Winning Bid; then auction dates */
  out["Bidder Email"] = get(
    "Bidder Email",
    "BidderEmail",
    "Winning Bidder Email",
    "WinningBidderEmail"
  ) as string | undefined;
  out["Bidder Number"] = get(
    "Bidder Number",
    "BidderNumber",
    "Bidder No",
    "Winning Bidder Number",
    "WinningBidderNumber"
  ) as string | undefined;
  out["Auction Start Date"] = get(
    "Auction Start Date",
    "Auction Start",
    "Sale Date",
    "Tax Sale Date",
    "Auction Date",
    /* legacy column that stored this slot before rename */
    "Redemption End Date",
    "Redemption Period End",
    "End of Redemption",
    "RedemptionEnd"
  ) as string | undefined;
  out["Auction End Date"] = get(
    "Auction End Date",
    "Auction End",
    "AuctionClose",
    "Sale End",
    "AuctionEndDate"
  ) as string | undefined;
  out["Owners"] = get("Owners", "Owner");
  out["Status"] = get("Status", "Property Status", "Tax Sale Status");

  return out;
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseStatus(v: string | undefined): ValidPropertyStatus {
  const s = v?.toLowerCase().trim();
  if (s && (VALID_PROPERTY_STATUSES as readonly string[]).includes(s)) {
    return s as ValidPropertyStatus;
  }
  return "active";
}

export function normalizeBulkRow(
  raw: Record<string, unknown>,
  opts: { statusOnly: boolean }
): { ok: true; row: NormalizedBulkRow } | { ok: false; error: string } {
  const p = coerceRow(raw);

  const parcelId = trimStr(p["Parcel ID"]) ?? null;
  const saleFromSheet = trimStr(p["Sale ID"]);
  const saleId =
    saleFromSheet ||
    (parcelId ? parcelId : null) ||
    null;

  if (!saleId) {
    return { ok: false, error: "Missing Sale ID (or Parcel ID to use as fallback)." };
  }

  if (opts.statusOnly) {
    if (!parcelId) {
      return { ok: false, error: "Status-only import requires Parcel ID for each row." };
    }
    const stRaw = trimStr(p["Status"]);
    if (!stRaw) {
      return { ok: false, error: "Status-only import requires Status on each row." };
    }
    return {
      ok: true,
      row: {
        title: trimStr(p["Title"]) || "(unchanged)",
        parcelId,
        saleId,
        status: parseStatus(stRaw),
        owners: [],
        address: null,
        city: null,
        zipCode: undefined,
        minBid: undefined,
        winningBid: undefined,
        auctionStart: null,
        auctionEnd: null,
        bidderEmail: null,
        bidderNumber: null,
      } satisfies NormalizedBulkRow,
    };
  }

  const title = trimStr(p["Title"]);
  if (!title) {
    return { ok: false, error: "Missing Title (or use status-only mode with Parcel ID + Sale ID)." };
  }

  let ownersArr: string[] = [];
  if (p["Owners"]) {
    ownersArr = String(p["Owners"])
      .split(/[;,]/)
      .map((o) => o.trim())
      .filter(Boolean);
  }

  return {
    ok: true,
    row: {
      title,
      parcelId,
      saleId,
      address: trimStr(p["Address"]) ?? null,
      city: trimStr(p["City"]) ?? null,
      zipCode: p["Zip Code"] !== undefined ? String(p["Zip Code"]) : undefined,
      minBid: p["Minimum Bid"] !== undefined ? String(p["Minimum Bid"]) : "0.00",
      winningBid: p["Winning Bid"] !== undefined ? String(p["Winning Bid"]) : "0.00",
      auctionStart: parseDate(trimStr(p["Auction Start Date"])),
      auctionEnd: parseDate(trimStr(p["Auction End Date"])),
      owners: ownersArr,
      status: parseStatus(trimStr(p["Status"])),
      bidderEmail: trimStr(p["Bidder Email"]) ?? null,
      bidderNumber: trimStr(p["Bidder Number"]) ?? null,
    },
  };
}

export function matchKey(parcelId: string, saleId: string): string {
  return `${parcelId.trim()}\t${saleId.trim()}`;
}

/** Load existing property ids for parcel IDs belonging to county (narrow in memory by sale id). */
export async function loadExistingByParcelSale(
  countyUserId: string,
  parcels: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (parcels.length === 0) return map;

  const rows = await db
    .select({
      id: property.id,
      parcelId: property.parcelId,
      saleId: property.saleId,
    })
    .from(property)
    .where(and(eq(property.createdBy, countyUserId), inArray(property.parcelId, parcels)));

  for (const r of rows) {
    const p = r.parcelId?.trim();
    const s = r.saleId?.trim();
    if (p && s) map.set(matchKey(p, s), r.id);
  }
  return map;
}

export type BidderLookupMaps = {
  byEmailLc: Map<string, string>;
  byNumber: Map<string, string>;
};

/** Prefetch bidder users referenced by email and/or bidder number */
export async function loadBidderLookupMaps(
  emailsLc: Set<string>,
  numbers: Set<string>
): Promise<BidderLookupMaps> {
  const byEmailLc = new Map<string, string>();
  const byNumber = new Map<string, string>();

  const emailArr = [...emailsLc].filter(Boolean);
  const numArr = [...numbers].filter(Boolean);
  if (emailArr.length === 0 && numArr.length === 0) {
    return { byEmailLc, byNumber };
  }

  const whereClause =
    emailArr.length && numArr.length
      ? and(eq(userTable.type, "bidder"), or(inArray(userTable.email, emailArr), inArray(userTable.bidderNumber, numArr)))
      : emailArr.length
        ? and(eq(userTable.type, "bidder"), inArray(userTable.email, emailArr))
        : and(eq(userTable.type, "bidder"), inArray(userTable.bidderNumber, numArr!));

  const rows = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      bidderNumber: userTable.bidderNumber,
    })
    .from(userTable)
    .where(whereClause);

  for (const u of rows) {
    const el = u.email.trim().toLowerCase();
    if (el) byEmailLc.set(el, u.id);
    const bn = u.bidderNumber?.trim();
    if (bn) byNumber.set(bn, u.id);
  }
  return { byEmailLc, byNumber };
}

export function resolveWinningBidderId(
  maps: BidderLookupMaps,
  email: string | null | undefined,
  bidderNumber: string | null | undefined
): { id: string | null; conflict?: string } {
  let byEmail: string | undefined;
  let byNum: string | undefined;
  const e = email?.trim().toLowerCase();
  const n = bidderNumber?.trim();

  if (e) byEmail = maps.byEmailLc.get(e);
  if (n) byNum = maps.byNumber.get(n);

  if (byEmail && byNum && byEmail !== byNum) {
    return {
      id: null,
      conflict: `Email maps to bidder ${byEmail.slice(0, 8)}… but bidder number maps to ${byNum.slice(0, 8)}…`,
    };
  }

  return { id: byEmail || byNum || null };
}
