// GET /api/counties — the OwnMidwest counties (id + name) for admin dropdowns/filters.
// Sourced from sync_lookup (seeded from OwnMidwest's GetAllCounty).

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { asc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { syncLookup } from '@/lib/schema';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rows = await db
    .select({ omId: syncLookup.omId, name: syncLookup.omName })
    .from(syncLookup)
    .where(eq(syncLookup.kind, 'county'))
    .orderBy(asc(syncLookup.omName));

  return NextResponse.json({ counties: rows });
}
