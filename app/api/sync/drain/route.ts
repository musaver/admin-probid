// POST /api/sync/drain
// Runs the outbox worker once (sends pending changes to OwnMidwest).
// Protect with the SYNC_DRAIN_TOKEN header so only your cron / you can trigger it.
//
// In production, point a scheduled job (e.g. Vercel Cron) at this endpoint every minute.

import { NextResponse } from 'next/server';
import { drainOutbox } from '@/lib/sync/drain';

export async function POST(req: Request) {
  const expected = process.env.SYNC_DRAIN_TOKEN;
  if (!expected) return NextResponse.json('Server missing SYNC_DRAIN_TOKEN config', { status: 401 });
  if (req.headers.get('x-drain-token') !== expected) {
    return NextResponse.json('Invalid drain token', { status: 401 });
  }

  try {
    const results = await drainOutbox(25);
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error('[sync/drain] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
