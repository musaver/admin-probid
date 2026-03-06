import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, property, propertyLinkedBidders } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const foundUser = await db
      .select({ id: user.id, type: user.type })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!foundUser || foundUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userType = foundUser[0].type;

    if (userType === 'county') {
      const properties = await db
        .select()
        .from(property)
        .where(eq(property.createdBy, id))
        .orderBy(desc(property.createdAt));

      return NextResponse.json({ userType: 'county', properties });
    }

    // Bidder: get linked properties with link status
    const linked = await db
      .select({
        property: property,
        linkStatus: propertyLinkedBidders.status,
        linkedAt: propertyLinkedBidders.linkedAt,
      })
      .from(propertyLinkedBidders)
      .innerJoin(property, eq(propertyLinkedBidders.propertyId, property.id))
      .where(eq(propertyLinkedBidders.bidderId, id))
      .orderBy(desc(propertyLinkedBidders.linkedAt));

    return NextResponse.json({ userType: 'bidder', properties: linked });
  } catch (error) {
    console.error('Error fetching user properties:', error);
    return NextResponse.json({ error: 'Failed to fetch user properties' }, { status: 500 });
  }
}
