// POST /api/bidder-claims/:id/verify
// Confirms a bidder claim: links every property that currently matches (number + county) to
// the bidder, marks the claim verified, and emails the bidder. Re-checks matches live, so
// results uploaded after the claim are picked up.

import { NextResponse, after } from 'next/server';
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

    if (m.match === 'matched' && m.propertyId) {
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

  await db.update(bidderClaim)
    .set({ status: 'verified', reviewedByAdminId: adminId, reviewedAt: now })
    .where(eq(bidderClaim.id, id));

  // Email the bidder (the only notification channel the client wants).
  after(async () => {
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
  });

  return NextResponse.json({ success: true, linked, total: items.length });
}
