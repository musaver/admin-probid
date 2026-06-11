// GET /api/change-requests  — admin Review Center queue.
// Lists change requests with the property + requester joined, newest first.
// Filters: ?status=pending|approved|rejected|all  &role=bidder|county  &propertyId=...

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { and, desc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { propertyChangeRequests, property, user } from '@/lib/schema';

const FIELD_LABELS: Record<string, string> = {
  parcelId: 'Map Number', saleId: 'Sale ID', minBid: 'Minimum Bid', winningBid: 'Maximum Bid',
  status: 'Tax Sale Status', address: 'Property Address', owners: 'Owner Name', auctionEnd: 'Tax Sale Date',
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') || 'pending';
  const role = sp.get('role') || '';
  const propertyId = sp.get('propertyId') || '';

  const filters = [];
  if (status && status !== 'all') filters.push(eq(propertyChangeRequests.status, status as 'pending' | 'approved' | 'rejected'));
  if (role === 'bidder' || role === 'county') filters.push(eq(propertyChangeRequests.requestedByRole, role));
  if (propertyId) filters.push(eq(propertyChangeRequests.propertyId, propertyId));

  const rows = await db
    .select({
      request: propertyChangeRequests,
      property: { id: property.id, title: property.title, saleId: property.saleId, address: property.address },
      requester: { id: user.id, name: user.name, email: user.email, bidderNumber: user.bidderNumber },
    })
    .from(propertyChangeRequests)
    .leftJoin(property, eq(propertyChangeRequests.propertyId, property.id))
    .leftJoin(user, eq(propertyChangeRequests.requestedByUserId, user.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(propertyChangeRequests.createdAt));

  const data = rows.map((r) => ({ ...r, label: FIELD_LABELS[r.request.fieldName] ?? r.request.fieldName }));
  return NextResponse.json({ requests: data });
}
