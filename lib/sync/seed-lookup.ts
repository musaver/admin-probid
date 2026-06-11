// Seeds / refreshes the sync_lookup table from OwnMidwest's GetAll* endpoints.
// Both sync directions translate OwnMidwest integer ids <-> BidBridge values through
// this table, so it must be populated before status sync works either way.
//
// Safe to re-run: an already-mapped bbValue is preserved (we never clobber a manual
// mapping); only the name/timestamp refresh and empty bbValues get auto-filled.

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { syncLookup } from '@/lib/schema';
import { ownmidwest } from './ownmidwest-client';

type Kind = 'county' | 'tax_status' | 'competitor_status';
type OmLookupRow = { id: number; name: string };

// BidBridge property.status enum values — keep in sync with schema.ts `property.status`.
const BB_STATUSES = [
  'active', 'sold', 'withdrawn', 'on_list', 'sold_at_tax_sale', 'redeemed',
  'voided', 'cancelled', 'deed_in_progress', 'deed_issued', 'redeemed_check_issued',
] as const;

/** "On List" -> "on_list", "Deed Issued" -> "deed_issued", etc. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Best-effort auto-map of an OwnMidwest status name to a BidBridge enum value. null if no exact match. */
function autoMapStatus(omName: string): string | null {
  const n = normalize(omName);
  return (BB_STATUSES as readonly string[]).includes(n) ? n : null;
}

function parseRows(text: string): OmLookupRow[] {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(json)) return [];
  return json
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && 'id' in r)
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? '') }));
}

async function upsertRow(kind: Kind, omId: number, omName: string, autoBbValue: string | null) {
  const existing = await db
    .select({ id: syncLookup.id, bbValue: syncLookup.bbValue })
    .from(syncLookup)
    .where(and(eq(syncLookup.kind, kind), eq(syncLookup.omId, omId)))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    const bbValue = row.bbValue ?? autoBbValue; // never overwrite an existing (manual) mapping
    await db.update(syncLookup)
      .set({ omName, bbValue, updatedAt: new Date() })
      .where(eq(syncLookup.id, row.id));
    return bbValue;
  }

  await db.insert(syncLookup).values({
    id: `${kind}-${omId}`,
    kind, omId, omName, bbValue: autoBbValue, updatedAt: new Date(),
  });
  return autoBbValue;
}

export type SeedReport = {
  counties: number;
  taxStatuses: { total: number; mapped: number; unmapped: { omId: number; omName: string }[] };
  competitorStatuses: number;
};

/** Pull counties + statuses from OwnMidwest and (re)populate sync_lookup. */
export async function seedLookup(): Promise<SeedReport> {
  // 1. Counties — bbValue defaults to the county id itself ("county number = county id").
  //    (Matching currently uses sync_status_map.om_county_id; this row is informational.)
  const countyRes = await ownmidwest.getAllCounty();
  if (!countyRes.ok) throw new Error(`GetAllCounty failed (${countyRes.status}): ${countyRes.text}`);
  const counties = parseRows(countyRes.text);
  for (const c of counties) await upsertRow('county', c.id, c.name, String(c.id));

  // 2. Tax-sale statuses — auto-map by normalized name; unmatched ones need a manual bbValue.
  const statusRes = await ownmidwest.getAllTaxSalesStatus();
  if (!statusRes.ok) throw new Error(`GetAllTaxSalesStatus failed (${statusRes.status}): ${statusRes.text}`);
  const statuses = parseRows(statusRes.text);
  const unmapped: { omId: number; omName: string }[] = [];
  let mapped = 0;
  for (const s of statuses) {
    const bbValue = await upsertRow('tax_status', s.id, s.name, autoMapStatus(s.name));
    if (bbValue) mapped++; else unmapped.push({ omId: s.id, omName: s.name });
  }

  // 3. Competitor statuses — stored for reference; no BidBridge equivalent yet.
  let competitorStatuses = 0;
  const compRes = await ownmidwest.getAllCompetitorStatus();
  if (compRes.ok) {
    const comps = parseRows(compRes.text);
    for (const c of comps) await upsertRow('competitor_status', c.id, c.name, null);
    competitorStatuses = comps.length;
  }

  return { counties: counties.length, taxStatuses: { total: statuses.length, mapped, unmapped }, competitorStatuses };
}
