// GET /api/activity — admin view of bidder/county activity (logins etc.).
// Filters: ?eventType=login|logout|...  &userId=...   (limit 300, newest first)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { and, desc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { userActivityLog, user } from '@/lib/schema';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const sp = new URL(req.url).searchParams;
  const eventType = sp.get('eventType') || '';
  const userId = sp.get('userId') || '';

  const filters = [];
  if (eventType) filters.push(eq(userActivityLog.eventType, eventType as 'login' | 'logout' | 'bid_submitted' | 'suggestion_submitted' | 'profile_updated' | 'property_viewed' | 'property_edited'));
  if (userId) filters.push(eq(userActivityLog.userId, userId));

  const rows = await db
    .select({
      activity: userActivityLog,
      actor: { id: user.id, name: user.name, email: user.email, type: user.type },
    })
    .from(userActivityLog)
    .leftJoin(user, eq(userActivityLog.userId, user.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(userActivityLog.createdAt))
    .limit(300);

  return NextResponse.json({ activity: rows });
}
