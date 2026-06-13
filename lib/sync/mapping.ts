// Maps a BidBridge property into OwnMidwest's tax-sale payload, and resolves
// the bits that need lookups: county id and the reverse status mapping.

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { syncLookup, syncStatusMap, user } from '@/lib/schema';

export type PropertySnapshot = {
  id: string;
  parcelId: string | null;
  saleId: string | null;
  minBid: string | null;
  winningBid: string | null;
  winningBidderId: string | null;
  description: string | null;
  status: string | null;
  auctionEnd: string | Date | null;
  owners: unknown;        // JSON array of owner names, or string
  address: string | null;
  city: string | null;
  zipCode: string | null;
};

/** The OwnMidwest county id for a property (stored when it first synced FROM them). null if unknown. */
export async function resolveCountyId(propertyId: string): Promise<number | null> {
  const rows = await db
    .select({ omCountyId: syncStatusMap.omCountyId })
    .from(syncStatusMap)
    .where(eq(syncStatusMap.propertyId, propertyId))
    .limit(1);
  return rows[0]?.omCountyId ?? null;
}

/** The bidder number OwnMidwest expects in `bidderInfo`, taken from the winning bidder. null if none. */
export async function resolveBidderNumber(winningBidderId: string | null): Promise<string | null> {
  if (!winningBidderId) return null;
  const rows = await db
    .select({ bidderNumber: user.bidderNumber })
    .from(user)
    .where(eq(user.id, winningBidderId))
    .limit(1);
  return rows[0]?.bidderNumber ?? null;
}

/**
 * OwnMidwest's tax-sale APIs require a `competitorStatus`, but BidBridge doesn't model
 * competitors (it's not one of the 10 synced fields). We send a default: the env override
 * OWNMIDWEST_DEFAULT_COMPETITOR_STATUS if set, else the lowest seeded competitor_status id.
 * TODO: confirm with OwnMidwest whether a "none" value exists or this can be made optional.
 */
export async function resolveDefaultCompetitorStatus(): Promise<number | null> {
  const envVal = process.env.OWNMIDWEST_DEFAULT_COMPETITOR_STATUS;
  if (envVal && !Number.isNaN(Number(envVal))) return Number(envVal);
  const rows = await db
    .select({ omId: syncLookup.omId })
    .from(syncLookup)
    .where(eq(syncLookup.kind, 'competitor_status'))
    .orderBy(asc(syncLookup.omId))
    .limit(1);
  return rows[0]?.omId ?? null;
}

/** Reverse status mapping: BidBridge status value -> OwnMidwest taxSalesStatusId. null if unmapped. */
export async function resolveStatusId(bbStatus: string | null): Promise<number | null> {
  if (!bbStatus) return null;
  const rows = await db
    .select({ omId: syncLookup.omId })
    .from(syncLookup)
    .where(and(eq(syncLookup.kind, 'tax_status'), eq(syncLookup.bbValue, bbStatus)))
    .limit(1);
  return rows[0]?.omId ?? null;
}

export type TaxSaleBuildResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; reason: string };

/** Build the AddTaxSale / UpdateTaxSale body for OwnMidwest. */
export async function buildTaxSaleBody(p: PropertySnapshot): Promise<TaxSaleBuildResult> {
  if (!p.parcelId) return { ok: false, reason: 'property has no parcelId (mapId)' };

  const countyId = await resolveCountyId(p.id);
  if (countyId == null) return { ok: false, reason: 'no county mapping for this property (sync_status_map.om_county_id missing)' };

  const taxSalesStatusId = await resolveStatusId(p.status);
  if (taxSalesStatusId == null) return { ok: false, reason: `status "${p.status}" is not mapped to an OwnMidwest taxSalesStatusId` };

  // OwnMidwest requires both taxSaleDate and taxSaleYear. We derive them from the
  // property's auction date — fail fast (clear reason) if it's missing rather than
  // sending an incomplete payload that their API rejects.
  const date = p.auctionEnd ? new Date(p.auctionEnd) : null;
  if (!date || isNaN(date.getTime())) {
    return { ok: false, reason: 'property has no auction/sale date; OwnMidwest requires taxSaleDate + taxSaleYear' };
  }

  // OwnMidwest validation: "MinimumBid must be greater than 0".
  const minimumBid = p.minBid != null ? Number(p.minBid) : 0;
  if (!(minimumBid > 0)) {
    return { ok: false, reason: `minimumBid must be > 0 for OwnMidwest (got ${minimumBid})` };
  }

  // OwnMidwest validation: "MaximumBid must be greater than 0" and
  // "MaximumBid cannot be less than MinimumBid". When we have no winning bid,
  // fall back to the minimum so the payload is always valid.
  const winning = p.winningBid != null ? Number(p.winningBid) : 0;
  const maximumBid = winning > minimumBid ? winning : minimumBid;

  // OwnMidwest's UpdateTaxSale requires a non-empty bidderInfo (their "bidder number").
  // Maps to the winning bidder's user.bidder_number. Empty when there is no winning
  // bidder yet (e.g. still on the list) — OwnMidwest may reject Update in that case.
  const bidderInfo = (await resolveBidderNumber(p.winningBidderId)) ?? '';

  // OwnMidwest requires competitorStatus even though BidBridge doesn't track competitors.
  const competitorStatus = await resolveDefaultCompetitorStatus();

  const body: Record<string, unknown> = {
    mapId: p.parcelId,
    countyIDFK: countyId,
    taxSalesStatusId,
    minimumBid,
    maximumBid,
    bidderInfo,
    competitorStatus,
    notes: p.description ?? '',
    saleID: p.saleId ?? '',
    // "YYYY-MM-DDTHH:mm:ss" — match OwnMidwest's documented format (no milliseconds / Z).
    taxSaleDate: date.toISOString().slice(0, 19),
    taxSaleYear: date.getUTCFullYear(),
  };

  return { ok: true, body };
}

export function snapshotOf(p: Record<string, unknown>): PropertySnapshot {
  return {
    id: String(p.id),
    parcelId: (p.parcelId as string) ?? null,
    saleId: (p.saleId as string) ?? null,
    minBid: (p.minBid as string) ?? null,
    winningBid: (p.winningBid as string) ?? null,
    winningBidderId: (p.winningBidderId as string) ?? null,
    description: (p.description as string) ?? null,
    status: (p.status as string) ?? null,
    auctionEnd: (p.auctionEnd as string | Date) ?? null,
    owners: p.owners ?? null,
    address: (p.address as string) ?? null,
    city: (p.city as string) ?? null,
    zipCode: (p.zipCode as string) ?? null,
  };
}

/** First owner name from the snapshot's owners (JSON array or string). '' if none. */
function firstOwnerName(owners: unknown): string {
  if (Array.isArray(owners)) return owners.length ? String(owners[0]) : '';
  if (typeof owners === 'string') {
    try { const arr = JSON.parse(owners); return Array.isArray(arr) ? String(arr[0] ?? '') : owners; }
    catch { return owners; }
  }
  return '';
}

/** Build the UpdatePropertyOwnerInfo body. OwnMidwest requires FullName, City, ZipCode. */
export async function buildOwnerBody(p: PropertySnapshot): Promise<TaxSaleBuildResult> {
  if (!p.parcelId) return { ok: false, reason: 'property has no parcelId (mapId)' };
  const countyId = await resolveCountyId(p.id);
  if (countyId == null) return { ok: false, reason: 'no county mapping (sync_status_map.om_county_id missing)' };

  const fullName = firstOwnerName(p.owners);
  if (!fullName) return { ok: false, reason: 'owner update needs an owner name (FullName required by OwnMidwest)' };
  if (!p.city || !p.zipCode) return { ok: false, reason: 'owner update needs city + zipCode (required by OwnMidwest)' };

  const parts = fullName.trim().split(/\s+/);
  const body: Record<string, unknown> = {
    mapId: p.parcelId,
    countyIDFK: countyId,
    fullName,
    firstName: parts[0] ?? '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    street: p.address ?? '',
    city: p.city,
    zipCode: p.zipCode,
  };
  return { ok: true, body };
}

/** Build the UpdatePropertyAddress body. OwnMidwest requires Location, City, ZipCode. */
export async function buildAddressBody(p: PropertySnapshot): Promise<TaxSaleBuildResult> {
  if (!p.parcelId) return { ok: false, reason: 'property has no parcelId (mapId)' };
  const countyId = await resolveCountyId(p.id);
  if (countyId == null) return { ok: false, reason: 'no county mapping (sync_status_map.om_county_id missing)' };
  if (!p.city || !p.zipCode) return { ok: false, reason: 'address update needs city + zipCode (required by OwnMidwest)' };

  // OwnMidwest requires a `location` (BidBridge has no separate field) — use the street address.
  const streetAddress = p.address ?? '';
  const body: Record<string, unknown> = {
    mapId: p.parcelId,
    countyIDFK: countyId,
    location: streetAddress || p.city,
    streetAddress,
    city: p.city,
    zipCode: p.zipCode,
  };
  return { ok: true, body };
}
