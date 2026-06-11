// POST /api/change-requests/:id/approve
// Applies the requested field change to the property, marks the request approved,
// notifies the requester, writes an admin log, and queues the change for OwnMidwest.

import { NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { propertyChangeRequests, property, notifications, adminLogs } from '@/lib/schema';
import { enqueuePropertyToOwnMidwest } from '@/lib/sync/enqueue';
import { drainOutbox } from '@/lib/sync/drain';

const PROPERTY_STATUSES = [
  'active', 'sold', 'withdrawn', 'on_list', 'sold_at_tax_sale', 'redeemed',
  'voided', 'cancelled', 'deed_in_progress', 'deed_issued', 'redeemed_check_issued',
];

// Coerce the stored string newValue into the right shape for its property column.
function coerce(fieldName: string, raw: string): { value: unknown } | { error: string } {
  switch (fieldName) {
    case 'minBid':
    case 'winningBid': {
      const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
      if (isNaN(n)) return { error: `${fieldName} must be a number` };
      return { value: n.toFixed(2) };
    }
    case 'auctionEnd': {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return { error: 'auctionEnd must be a valid date' };
      return { value: d };
    }
    case 'owners': {
      try {
        const parsed = JSON.parse(raw);
        return { value: Array.isArray(parsed) ? parsed : [String(raw)] };
      } catch {
        return { value: [String(raw)] };
      }
    }
    case 'status': {
      if (!PROPERTY_STATUSES.includes(raw)) return { error: `invalid status "${raw}"` };
      return { value: raw };
    }
    default:
      return { value: String(raw) };
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  let note: string | null = null;
  try { note = (await req.json())?.reviewNote ?? null; } catch { /* body optional */ }

  const [cr] = await db.select().from(propertyChangeRequests).where(eq(propertyChangeRequests.id, id)).limit(1);
  if (!cr) return new NextResponse('Change request not found', { status: 404 });
  if (cr.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${cr.status}` }, { status: 409 });
  }

  const coerced = coerce(cr.fieldName, cr.newValue);
  if ('error' in coerced) return NextResponse.json({ error: coerced.error }, { status: 400 });

  const [prop] = await db.select().from(property).where(eq(property.id, cr.propertyId)).limit(1);
  if (!prop) return new NextResponse('Property not found', { status: 404 });

  // Merge this field into the recently-changed list (dedupe).
  const prevFields = Array.isArray(prop.lastChangedFields) ? (prop.lastChangedFields as string[]) : [];
  const lastChangedFields = Array.from(new Set([...prevFields, cr.fieldName]));
  const now = new Date();

  // 1. apply the change to the property
  await db.update(property).set({
    [cr.fieldName]: coerced.value,
    lastChangedAt: now,
    lastChangedFields,
    lastChangedBy: adminId,
    updatedAt: now,
  } as Record<string, unknown>).where(eq(property.id, cr.propertyId));

  // 2. mark the request approved
  await db.update(propertyChangeRequests).set({
    status: 'approved', reviewedByAdminId: adminId, reviewedAt: now, reviewNote: note,
  }).where(eq(propertyChangeRequests.id, id));

  // 3. notify the requester
  await db.insert(notifications).values({
    id: uuidv4(),
    userId: cr.requestedByUserId,
    type: 'status',
    title: 'Change request approved',
    message: `Your requested change to "${cr.fieldName}" was approved.`,
    href: `/property-details/${cr.propertyId}`,
    metadata: { changeRequestId: id, propertyId: cr.propertyId, fieldName: cr.fieldName },
    isRead: 0,
    createdAt: now,
  });

  // 4. admin audit log
  await db.insert(adminLogs).values({
    id: uuidv4(),
    adminId,
    action: 'change_request_approved',
    details: `field=${cr.fieldName} property=${cr.propertyId} request=${id}`,
    createdAt: now,
  });

  // 5. queue the change for OwnMidwest (reverse sync), delivered async after the response.
  try {
    const [updated] = await db.select().from(property).where(eq(property.id, cr.propertyId)).limit(1);
    const { queued } = await enqueuePropertyToOwnMidwest(updated as Record<string, unknown>, 'update_tax_sale', 'local');
    if (queued) after(async () => { try { await drainOutbox(); } catch (e) { console.error('[review-approve] drain failed', e); } });
  } catch (e) {
    console.error('[review-approve] enqueue failed (change still applied):', e);
  }

  return NextResponse.json({ success: true, applied: { field: cr.fieldName, value: coerced.value } });
}
