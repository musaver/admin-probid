// POST /api/sync/seed-lookup
// Pulls counties + tax-sale/competitor statuses from OwnMidwest and (re)populates
// sync_lookup, the id-translation table both sync directions depend on.
//
// Protect with the SYNC_DRAIN_TOKEN header. Safe to re-run — manual bbValue mappings
// are preserved. Run once after setup, and again whenever OwnMidwest adds a status/county.
//
// Response includes which tax statuses could NOT be auto-mapped to a BidBridge status —
// those need a bbValue set by hand (UPDATE sync_lookup SET bb_value=... WHERE id=...).

import { NextResponse } from 'next/server';
import { seedLookup } from '@/lib/sync/seed-lookup';

export async function POST(req: Request) {
  const expected = process.env.SYNC_DRAIN_TOKEN;
  if (!expected) return NextResponse.json('Server missing SYNC_DRAIN_TOKEN config', { status: 401 });
  if (req.headers.get('x-drain-token') !== expected) {
    return NextResponse.json('Invalid token', { status: 401 });
  }

  try {
    const report = await seedLookup();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[sync/seed-lookup] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
