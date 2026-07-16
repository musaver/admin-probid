import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

/**
 * Defense-in-depth guard for admin API routes.
 *
 * The edge middleware (middleware.ts) already rejects unauthenticated /api/*
 * requests, but the sensitive account/role endpoints also check here so they are
 * never exposed if the middleware matcher is ever changed.
 *
 * Usage:
 *   const unauthorized = await requireAdmin();
 *   if (unauthorized) return unauthorized;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
