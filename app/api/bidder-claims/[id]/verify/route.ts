// POST /api/bidder-claims/:id/verify
// Confirms a bidder claim and links properties to the bidder.
//
// Body (optional): { itemIds?: string[] }
//   - itemIds given  → ADMIN MANUAL mode: link exactly those claim items the admin ticked
//     (as long as the item resolves to a real property), regardless of auto-match result.
//   - no itemIds     → AUTO mode: link only items whose number currently matches.
//
// Honest status: the claim is marked "verified" and the bidder emailed ONLY if at least one
// property was actually linked. If nothing links, the claim stays "pending" (no false
// "verified" email) so the admin can set the Winning Bidder # / tick items and try again.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidderClaim, bidderClaimItem, propertyLinkedBidders, user } from '@/lib/schema';
import { liveMatch } from '@/lib/bidder-match';
import { sendTextEmail } from '@/lib/email';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  // Optional body: which items to force-link (admin's checkboxes).
  let selectedIds: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.itemIds)) selectedIds = body.itemIds.map(String);
  } catch { /* no body → auto mode */ }

  const [claim] = await db.select().from(bidderClaim).where(eq(bidderClaim.id, id)).limit(1);
  if (!claim) return new NextResponse('Claim not found', { status: 404 });
  if (claim.status !== 'pending') return NextResponse.json({ error: `Claim is already ${claim.status}` }, { status: 409 });

  const items = await db.select().from(bidderClaimItem).where(eq(bidderClaimItem.claimId, id));
  const now = new Date();
  let linked = 0;

  for (const it of items) {
    const m = await liveMatch(it.enteredValue, claim.omCountyId, claim.bidderNumber);
    // Persist the latest match result + resolved property on the item.
    await db.update(bidderClaimItem)
      .set({ resolvedPropertyId: m.propertyId, matchStatus: m.match })
      .where(eq(bidderClaimItem.id, it.id));

    // Decide whether to link this item:
    //  - manual mode: admin ticked it AND it resolves to a real property
    //  - auto mode:   it auto-matched
    const shouldLink = selectedIds
      ? selectedIds.includes(it.id) && !!m.propertyId
      : m.match === 'matched' && !!m.propertyId;

    if (shouldLink && m.propertyId) {
      const [existing] = await db
        .select({ id: propertyLinkedBidders.id })
        .from(propertyLinkedBidders)
        .where(and(eq(propertyLinkedBidders.propertyId, m.propertyId), eq(propertyLinkedBidders.bidderId, claim.bidderUserId)))
        .limit(1);
      if (!existing) {
        await db.insert(propertyLinkedBidders).values({
          id: uuidv4(),
          propertyId: m.propertyId,
          bidderId: claim.bidderUserId,
          status: 'won',
          linkedAt: now,
        });
      }
      linked++;
    }
  }

  // Honest status: only mark verified + email if something actually linked.
  if (linked === 0) {
    return NextResponse.json({
      success: false,
      linked: 0,
      total: items.length,
      message: 'No properties were linked, so the claim is still pending. Set the Winning Bidder # on the property (or tick the properties to link), then verify again.',
    });
  }

  await db.update(bidderClaim)
    .set({ status: 'verified', reviewedByAdminId: adminId, reviewedAt: now })
    .where(eq(bidderClaim.id, id));

  // Email the bidder (the only notification channel the client wants). Awaited so it reliably
  // sends; wrapped so an email failure never fails the verification.
  try {
    const [b] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, claim.bidderUserId)).limit(1);
    if (b?.email) {
      await sendTextEmail(
        b.email,
        'Your BidBridge properties are verified',
        `Hi ${b.name || ''},\n\nYour winning bids have been verified and ${linked} propert${linked === 1 ? 'y is' : 'ies are'} now visible in your BidBridge account.\n\nThank you.`,
      );
    }
  } catch (e) { console.error('[bidder-verify] email failed', e); }

  return NextResponse.json({ success: true, linked, total: items.length });
}
