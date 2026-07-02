// GET /api/badge-counts — cheap counts for the sidebar badges.
// Three simple COUNT(*) queries (no heavy per-row work), so it's light to poll.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { and, count, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { propertyChangeRequests, bidderClaim, supportMessage } from '@/lib/schema';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const [review, verify, support] = await Promise.all([
    db.select({ c: count() }).from(propertyChangeRequests).where(eq(propertyChangeRequests.status, 'pending')),
    db.select({ c: count() }).from(bidderClaim).where(eq(bidderClaim.status, 'pending')),
    db.select({ c: count() }).from(supportMessage).where(and(eq(supportMessage.senderRole, 'user'), eq(supportMessage.isRead, 0))),
  ]);

  return NextResponse.json({
    review: Number(review[0]?.c || 0),
    verify: Number(verify[0]?.c || 0),
    support: Number(support[0]?.c || 0),
  });
}
