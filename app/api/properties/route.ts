import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { property, user, propertyLinkedBidders } from '@/lib/schema';
import { eq, desc, asc, count, like, or, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const countyId = searchParams.get('countyId') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const direction = searchParams.get('direction') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = searchParams.get('pageSize') || '100';

    const whereClauses = [];
    if (search) {
      whereClauses.push(
        or(
          like(property.title, `%${search}%`),
          like(property.address, `%${search}%`),
          like(property.saleId, `%${search}%`)
        )
      );
    }
    if (status !== 'all') {
      whereClauses.push(eq(property.status, status as any));
    }
    if (countyId) {
      whereClauses.push(eq(property.createdBy, countyId));
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    // Total count
    const totalResult = await db.select({ value: count() }).from(property).where(where);
    const total = totalResult[0].value;

    // Subquery for bidder counts
    const bidderCounts = db
      .select({
        propertyId: propertyLinkedBidders.propertyId,
        count: count().as('count'),
      })
      .from(propertyLinkedBidders)
      .groupBy(propertyLinkedBidders.propertyId)
      .as('bidder_counts');

    // Main query
    const sortColumn = (property as any)[sort] || property.createdAt;
    const allProperties = await db
      .select({
        property: property,
        creator: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        linkedBiddersCount: sql<number>`coalesce(${bidderCounts.count}, 0)`,
      })
      .from(property)
      .leftJoin(user, eq(property.createdBy, user.id))
      .leftJoin(bidderCounts, eq(property.id, bidderCounts.propertyId))
      .where(where)
      .orderBy(direction === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(pageSize === 'all' ? 1000000 : parseInt(pageSize))
      .offset(pageSize === 'all' ? 0 : (page - 1) * parseInt(pageSize));

    return NextResponse.json({ properties: allProperties, total });
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
      auctionStart: body.auctionStart ? new Date(body.auctionStart) : null,
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
