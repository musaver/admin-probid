// Drains the outbox: claims pending rows, pushes them to OwnMidwest, and
// handles success / validation-failure / retry-with-backoff. Safe to run
// concurrently — the atomic claim ensures a row is never sent twice.

import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { syncOutbox, syncStatusMap } from '@/lib/schema';
import { ownmidwest } from './ownmidwest-client';
import { buildTaxSaleBody, type PropertySnapshot } from './mapping';

const MAX_ATTEMPTS = 8;

function backoffMs(attempts: number): number {
  return Math.min(5 * 60_000, Math.pow(2, attempts) * 1000); // exponential, capped at 5 min
}

type OutboxRow = typeof syncOutbox.$inferSelect;
type Outcome = { id: string; status: string; reason?: string; http?: number };

async function markDead(id: string, reason: string): Promise<void> {
  await db.update(syncOutbox).set({ status: 'dead', lastError: reason }).where(eq(syncOutbox.id, id));
}

async function reschedule(id: string, attempts: number, error: string): Promise<void> {
  await db
    .update(syncOutbox)
    .set({ status: 'pending', nextAttemptAt: new Date(Date.now() + backoffMs(attempts)), lastError: error })
    .where(eq(syncOutbox.id, id));
}

async function deliver(row: OutboxRow): Promise<Outcome> {
  const snap = row.payload as PropertySnapshot;

  const built = await buildTaxSaleBody(snap);
  if (!built.ok) {
    await markDead(row.id, built.reason);
    return { id: row.id, status: 'dead', reason: built.reason };
  }

  // Decide Add vs Update based on whether the record already exists on their side.
  const map = await db
    .select({ omExists: syncStatusMap.omExists })
    .from(syncStatusMap)
    .where(eq(syncStatusMap.propertyId, snap.id))
    .limit(1);
  const exists = (map[0]?.omExists ?? 0) === 1;

  const res = exists ? await ownmidwest.updateTaxSale(built.body) : await ownmidwest.addTaxSale(built.body);

  if (res.ok) {
    await db.update(syncOutbox).set({ status: 'delivered', deliveredAt: new Date(), lastError: null }).where(eq(syncOutbox.id, row.id));
    await db
      .update(syncStatusMap)
      .set({ omExists: 1, lastOutboundHash: row.contentHash, lastSyncedAt: new Date() })
      .where(eq(syncStatusMap.propertyId, snap.id));
    return { id: row.id, status: 'delivered' };
  }

  // 400 = validation error on their side; won't fix itself.
  if (res.status === 400) {
    await markDead(row.id, `HTTP 400: ${res.text}`);
    return { id: row.id, status: 'dead', http: 400, reason: res.text };
  }

  // 401 / 5xx / network: retry later, or give up after MAX_ATTEMPTS.
  if (row.attempts >= MAX_ATTEMPTS) {
    await markDead(row.id, `gave up after ${row.attempts} attempts; last: HTTP ${res.status}`);
    return { id: row.id, status: 'dead', http: res.status, reason: 'max attempts' };
  }
  await reschedule(row.id, row.attempts, `HTTP ${res.status}: ${res.text}`);
  return { id: row.id, status: 'retry', http: res.status };
}

export async function drainOutbox(limit = 20): Promise<Outcome[]> {
  const now = new Date();
  const due = await db
    .select()
    .from(syncOutbox)
    .where(and(eq(syncOutbox.status, 'pending'), lte(syncOutbox.nextAttemptAt, now)))
    .limit(limit);

  const results: Outcome[] = [];
  for (const row of due) {
    // Atomic claim: flip pending -> in_flight only if still pending.
    const claim = await db
      .update(syncOutbox)
      .set({ status: 'in_flight', attempts: row.attempts + 1, lockedAt: new Date() })
      .where(and(eq(syncOutbox.id, row.id), eq(syncOutbox.status, 'pending')));
    const affected = (claim as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0;
    if (!affected) continue; // another worker claimed it first

    try {
      results.push(await deliver({ ...row, attempts: row.attempts + 1 }));
    } catch (e) {
      await reschedule(row.id, row.attempts + 1, String(e));
      results.push({ id: row.id, status: 'retry', reason: String(e) });
    }
  }
  return results;
}
