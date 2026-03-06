import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, propertyLinkedBidders } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bidders = await db
      .select({
        id: propertyLinkedBidders.id,
        status: propertyLinkedBidders.status,
        linkedAt: propertyLinkedBidders.linkedAt,
        bidder: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          bidderNumber: user.bidderNumber,
        },
      })
      .from(propertyLinkedBidders)
      .innerJoin(user, eq(propertyLinkedBidders.bidderId, user.id))
      .where(eq(propertyLinkedBidders.propertyId, id))
      .orderBy(desc(propertyLinkedBidders.linkedAt));

    return NextResponse.json(bidders);
  } catch (error) {
    console.error('Error fetching property bidders:', error);
    return NextResponse.json({ error: 'Failed to fetch property bidders' }, { status: 500 });
  }
}
