// Writes a change to the outbox so the worker can push it to OwnMidwest.
// Call this right after a property is created/updated in the admin app.

import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { syncOutbox } from '@/lib/schema';
import { snapshotOf, type PropertySnapshot } from './mapping';

export type OutboxOperation = 'add_tax_sale' | 'update_tax_sale';

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Queue a property change for delivery to OwnMidwest.
 * - origin 'ownmidwest' is skipped (prevents the change we just received from
 *   them being echoed straight back — no infinite loop).
 * - duplicate identical changes are ignored via the unique idempotency key.
 */
export async function enqueuePropertyToOwnMidwest(
  propertyRow: Record<string, unknown>,
  operation: OutboxOperation = 'update_tax_sale',
  origin: 'local' | 'ownmidwest' = 'local',
): Promise<{ queued: boolean; reason?: string }> {
  if (origin === 'ownmidwest') return { queued: false, reason: 'echo suppressed' };

  const snap: PropertySnapshot = snapshotOf(propertyRow);
  if (!snap.parcelId) return { queued: false, reason: 'no parcelId' };

  const contentHash = sha256(snap);
  const idempotencyKey = `bb-${operation}-${snap.id}-${contentHash.slice(0, 12)}`;

  try {
    await db.insert(syncOutbox).values({
      id: crypto.randomUUID(),
      aggregateType: 'property',
      aggregateId: snap.id,
      operation,
      payload: snap,
      idempotencyKey,
      contentHash,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
      createdAt: new Date(),
    });
    return { queued: true };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { queued: false, reason: 'identical change already queued' };
    }
    throw err;
  }
}
