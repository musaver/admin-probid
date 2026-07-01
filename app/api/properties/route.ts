import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { property, user, propertyLinkedBidders, syncLookup } from '@/lib/schema';
import { eq, desc, asc, count, like, or, and, sql, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const countyId = searchParams.get('countyId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
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
      whereClauses.push(eq(property.omCountyId, Number(countyId)));
    }
    // Date range on when the property was added (createdAt), matching the "Created At" column.
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) whereClauses.push(gte(property.createdAt, d));
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); whereClauses.push(lte(property.createdAt, d)); }
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
        countyName: syncLookup.omName,
        linkedBiddersCount: sql<number>`coalesce(${bidderCounts.count}, 0)`,
      })
      .from(property)
      .leftJoin(user, eq(property.createdBy, user.id))
      .leftJoin(bidderCounts, eq(property.id, bidderCounts.propertyId))
      .leftJoin(syncLookup, and(eq(syncLookup.kind, 'county'), eq(syncLookup.omId, property.omCountyId)))
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
      omCountyId: body.omCountyId ?? null,
      visibilitySettings: body.visibilitySettings || null,
      status: body.status || 'active',
      countyStatus: body.countyStatus || null, // county-only workflow status (not synced)
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
