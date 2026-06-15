// Live re-match of a claimed property against current data. Used by the admin verification
// page + verify action so results uploaded AFTER a claim was submitted are reflected.

import { eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { property, syncStatusMap } from '@/lib/schema';

export type LiveMatch = {
  propertyId: string | null;
  title: string | null;
  recordedNumber: string | null; // the property's winning bidder number (from OwnMidwest), if uploaded
  countyId: number | null;
  match: 'matched' | 'mismatch' | 'not_found';
};

export async function liveMatch(enteredValue: string, omCountyId: number, bidderNumber: string): Promise<LiveMatch> {
  const [prop] = await db
    .select({ id: property.id, title: property.title, num: property.winningBidderNumber, county: syncStatusMap.omCountyId })
    .from(property)
    .leftJoin(syncStatusMap, eq(syncStatusMap.propertyId, property.id))
    .where(or(eq(property.parcelId, enteredValue), eq(property.saleId, enteredValue)))
    .limit(1);

  if (!prop) return { propertyId: null, title: null, recordedNumber: null, countyId: null, match: 'not_found' };
  if (prop.num == null || prop.num === '') {
    return { propertyId: prop.id, title: prop.title, recordedNumber: null, countyId: prop.county, match: 'not_found' };
  }
  const numberMatches = String(prop.num) === String(bidderNumber);
  const countyMatches = prop.county == null || prop.county === omCountyId;
  return {
    propertyId: prop.id,
    title: prop.title,
    recordedNumber: String(prop.num),
    countyId: prop.county,
    match: numberMatches && countyMatches ? 'matched' : 'mismatch',
  };
}
