// POST /api/change-requests/:id/reject  { reviewNote: "why" }
// Marks the request rejected (no change to the property) and notifies the requester.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { propertyChangeRequests, notifications } from '@/lib/schema';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  let note: string | null = null;
  try { note = (await req.json())?.reviewNote ?? null; } catch { /* ignore */ }
  if (!note || !String(note).trim()) {
    return NextResponse.json({ error: 'A review note explaining the rejection is required.' }, { status: 400 });
  }

  const [cr] = await db.select().from(propertyChangeRequests).where(eq(propertyChangeRequests.id, id)).limit(1);
  if (!cr) return new NextResponse('Change request not found', { status: 404 });
  if (cr.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${cr.status}` }, { status: 409 });
  }

  const now = new Date();
  await db.update(propertyChangeRequests).set({
    status: 'rejected', reviewedByAdminId: adminId, reviewedAt: now, reviewNote: note,
  }).where(eq(propertyChangeRequests.id, id));

  await db.insert(notifications).values({
    id: uuidv4(),
    userId: cr.requestedByUserId,
    type: 'status',
    title: 'Change request rejected',
    message: `Your requested change to "${cr.fieldName}" was rejected: ${note}`,
    href: `/property-details/${cr.propertyId}`,
    metadata: { changeRequestId: id, propertyId: cr.propertyId, fieldName: cr.fieldName },
    isRead: 0,
    createdAt: now,
  });

  return NextResponse.json({ success: true });
}
