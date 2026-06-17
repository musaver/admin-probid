// Admin Sync Status — view the outbound queue and retry failed pushes.
//   GET  /api/sync/outbox          recent outbox rows (joined with the property)
//   POST /api/sync/outbox          retry: reset dead/stuck rows → pending, then drain.
//        body { id?: string }      retry a single row, or all dead rows if omitted.
// Auth: admin session (not the drain token — this is the in-panel tool).

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { desc, eq, inArray } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { syncOutbox, property } from '@/lib/schema';
import { drainOutbox } from '@/lib/sync/drain';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rows = await db
    .select({
      id: syncOutbox.id,
      operation: syncOutbox.operation,
      status: syncOutbox.status,
      attempts: syncOutbox.attempts,
      lastError: syncOutbox.lastError,
      createdAt: syncOutbox.createdAt,
      deliveredAt: syncOutbox.deliveredAt,
      propertyTitle: property.title,
      parcelId: property.parcelId,
    })
    .from(syncOutbox)
    .leftJoin(property, eq(syncOutbox.aggregateId, property.id))
    .orderBy(desc(syncOutbox.createdAt))
    .limit(100);

  // quick counts for the header
  const counts = { pending: 0, in_flight: 0, delivered: 0, dead: 0 } as Record<string, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return NextResponse.json({ rows, counts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let id: string | undefined;
  try { id = (await req.json())?.id; } catch { /* no body = retry all dead */ }

  const now = new Date();
  if (id) {
    await db.update(syncOutbox)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: now, lastError: null })
      .where(eq(syncOutbox.id, id));
  } else {
    await db.update(syncOutbox)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: now, lastError: null })
      .where(inArray(syncOutbox.status, ['dead']));
  }

  const results = await drainOutbox(50);
  return NextResponse.json({ ok: true, processed: results.length, results });
}
