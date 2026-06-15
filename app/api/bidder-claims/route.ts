// GET /api/bidder-claims — admin Bidder Verification queue.
// Lists claims with the bidder, county, and a LIVE match per claimed property
// (re-checked now, so results uploaded after the claim are reflected).
// Filters: ?status=pending|verified|rejected|all

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { desc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidderClaim, bidderClaimItem, user, syncLookup } from '@/lib/schema';
import { liveMatch } from '@/lib/bidder-match';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const status = new URL(req.url).searchParams.get('status') || 'pending';

  const claims = await db
    .select({
      claim: bidderClaim,
      bidder: { id: user.id, name: user.name, email: user.email },
    })
    .from(bidderClaim)
    .leftJoin(user, eq(bidderClaim.bidderUserId, user.id))
    .where(status === 'all' ? undefined : eq(bidderClaim.status, status as 'pending' | 'verified' | 'rejected'))
    .orderBy(desc(bidderClaim.createdAt));

  // county id -> name
  const counties = await db.select({ omId: syncLookup.omId, name: syncLookup.omName })
    .from(syncLookup).where(eq(syncLookup.kind, 'county'));
  const countyName = (id: number) => counties.find((c) => c.omId === id)?.name || `County ${id}`;

  const data = await Promise.all(
    claims.map(async ({ claim, bidder }) => {
      const items = await db.select().from(bidderClaimItem).where(eq(bidderClaimItem.claimId, claim.id));
      const matched = await Promise.all(
        items.map(async (it) => ({
          id: it.id,
          enteredValue: it.enteredValue,
          ...(await liveMatch(it.enteredValue, claim.omCountyId, claim.bidderNumber)),
        })),
      );
      return { ...claim, countyName: countyName(claim.omCountyId), bidder, items: matched };
    }),
  );

  return NextResponse.json({ claims: data });
}
