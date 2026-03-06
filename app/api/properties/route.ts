import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { property, user, propertyLinkedBidders } from '@/lib/schema';
import { eq, desc, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const allProperties = await db
      .select({
        property: property,
        creator: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(property)
      .leftJoin(user, eq(property.createdBy, user.id))
      .orderBy(desc(property.createdAt));

    const bidderCounts = await db
      .select({
        propertyId: propertyLinkedBidders.propertyId,
        count: count(),
      })
      .from(propertyLinkedBidders)
      .groupBy(propertyLinkedBidders.propertyId);

    const countMap = new Map(bidderCounts.map(r => [r.propertyId, r.count]));

    const result = allProperties.map(row => ({
      ...row,
      linkedBiddersCount: countMap.get(row.property.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date();

    const newProperty = {
      id: uuidv4(),
      title: body.title || `Property ${body.saleId}`,
      description: body.description || null,
      address: body.address || null,
      parcelId: body.parcelId || null,
      saleId: body.saleId,
      city: body.city || null,
      zipCode: body.zipCode || null,
      squareFeet: body.squareFeet ? Number(body.squareFeet) : null,
      yearBuilt: body.yearBuilt ? Number(body.yearBuilt) : null,
      lotSize: body.lotSize || null,
      owners: body.owners || null,
      auctionEnd: body.auctionEnd ? new Date(body.auctionEnd) : null,
      minBid: body.minBid || null,
      winningBid: body.winningBid || null,
      winningBidderId: body.winningBidderId || null,
      visibilitySettings: body.visibilitySettings || null,
      status: body.status || 'active',
      createdBy: body.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(property).values(newProperty as any);

    return NextResponse.json(newProperty, { status: 201 });
  } catch (error) {
    console.error('Error creating property:', error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
