import { NextRequest, NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { property, user, notifications, propertyLinkedBidders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { enqueuePropertyToOwnMidwest } from '@/lib/sync/enqueue';
import { drainOutbox } from '@/lib/sync/drain';

// The fields whose direct admin edits should trigger the "recently changed" highlight + notify.
const TRACKED_FIELDS = ['parcelId', 'saleId', 'minBid', 'winningBid', 'status', 'address', 'owners', 'auctionEnd'];
const normVal = (v: unknown): string =>
  v == null ? '' : v instanceof Date ? new Date(v).toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const found = await db
      .select()
      .from(property)
      .where(eq(property.id, id))
      .limit(1);

    if (!found || found.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    return NextResponse.json(found[0]);
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json({ error: 'Failed to get property' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();

    data.updatedAt = new Date();

    // Diff against the current row to find which tracked fields actually changed,
    // so the admin's direct edit drives the recently-changed highlight + notifications.
    const [current] = await db.select().from(property).where(eq(property.id, id)).limit(1);
    const changedFields = current
      ? TRACKED_FIELDS.filter((f) => f in data && normVal(data[f]) !== normVal((current as Record<string, unknown>)[f]))
      : [];

    if (changedFields.length > 0) {
      const session = await getServerSession(authOptions);
      const adminId = (session?.user as { id?: string } | undefined)?.id ?? null;
      const prev = Array.isArray(current?.lastChangedFields) ? (current!.lastChangedFields as string[]) : [];
      data.lastChangedFields = Array.from(new Set([...prev, ...changedFields]));
      data.lastChangedAt = new Date();
      data.lastChangedBy = adminId;
    }

    await db
      .update(property)
      .set(data)
      .where(eq(property.id, id));

    const updated = await db
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
      .where(eq(property.id, id))
      .limit(1);

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Notify all linked bidders that the admin changed this property.
    if (changedFields.length > 0) {
      try {
        const linked = await db
          .select({ bidderId: propertyLinkedBidders.bidderId })
          .from(propertyLinkedBidders)
          .where(eq(propertyLinkedBidders.propertyId, id));
        const now = new Date();
        for (const l of linked) {
          await db.insert(notifications).values({
            id: uuidv4(),
            userId: l.bidderId,
            type: 'status',
            title: 'Property updated',
            message: `A property you're linked to was updated (${changedFields.join(', ')}).`,
            href: `/property-details/${id}`,
            metadata: { propertyId: id, fields: changedFields },
            isRead: 0,
            createdAt: now,
          });
        }
      } catch (e) {
        console.error('[admin-edit] notify linked bidders failed:', e);
      }
    }

    // Queue this change to be pushed to OwnMidwest (reverse sync), then deliver it
    // asynchronously — "immediate but async" (Option 2): the save returns right away
    // and the push to OwnMidwest happens after the response via after(), so there is
    // NO cron. The outbox + idempotency key guarantee each change is sent exactly once.
    // origin defaults to 'local'; pass 'ownmidwest' only when applying an inbound change.
    try {
      const { queued } = await enqueuePropertyToOwnMidwest(
        updated[0].property as Record<string, unknown>,
        'update_tax_sale',
        data.__origin === 'ownmidwest' ? 'ownmidwest' : 'local',
      );
      if (queued) {
        after(async () => {
          try {
            await drainOutbox();
          } catch (e) {
            console.error('[reverse-sync] async drain failed (row stays pending until next change):', e);
          }
        });
      }
    } catch (e) {
      console.error('[reverse-sync] enqueue failed (property still saved):', e);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating property:', error);
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(property).where(eq(property.id, id));
    return NextResponse.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }
}
