import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { propertyLinkedBidders } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const body = await req.json();
    const { bidderId, status = 'invited' } = body;

    if (!bidderId) {
      return NextResponse.json({ error: 'bidderId is required' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(propertyLinkedBidders)
      .where(
        and(
          eq(propertyLinkedBidders.propertyId, propertyId),
          eq(propertyLinkedBidders.bidderId, bidderId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Bidder already linked' }, { status: 400 });
    }

    const linkId = uuidv4();
    await db.insert(propertyLinkedBidders).values({
      id: linkId,
      propertyId,
      bidderId,
      status,
      linkedAt: new Date(),
    });

    return NextResponse.json({ linkId }, { status: 201 });
  } catch (error) {
    console.error('Error linking bidder:', error);
    return NextResponse.json({ error: 'Failed to link bidder' }, { status: 500 });
  }
}
