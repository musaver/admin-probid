// Admin support inbox.
//   GET  /api/support               → list all threads (users who messaged) + unread counts
//   GET  /api/support?userId=<id>   → one user's full thread (marks their messages read)
//   POST /api/support {userId, body}→ admin replies to a user

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { supportMessage, user } from '@/lib/schema';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = new URL(req.url).searchParams.get('userId');

  // Single thread
  if (userId) {
    const messages = await db
      .select()
      .from(supportMessage)
      .where(eq(supportMessage.userId, userId))
      .orderBy(asc(supportMessage.createdAt));

    // Admin is reading → mark the user's messages as read.
    await db
      .update(supportMessage)
      .set({ isRead: 1 })
      .where(and(eq(supportMessage.userId, userId), eq(supportMessage.senderRole, 'user'), eq(supportMessage.isRead, 0)));

    const [u] = await db.select({ id: user.id, name: user.name, email: user.email, type: user.type }).from(user).where(eq(user.id, userId)).limit(1);
    return NextResponse.json({ messages, user: u || null });
  }

  // Thread list — one row per user, newest first, with unread (user) count + last message preview.
  const threads = await db
    .select({
      userId: supportMessage.userId,
      name: user.name,
      email: user.email,
      type: user.type,
      lastAt: sql<string>`MAX(${supportMessage.createdAt})`,
      unread: sql<number>`SUM(CASE WHEN ${supportMessage.senderRole} = 'user' AND ${supportMessage.isRead} = 0 THEN 1 ELSE 0 END)`,
      lastBody: sql<string>`(SELECT body FROM support_message sm2 WHERE sm2.user_id = ${supportMessage.userId} ORDER BY sm2.created_at DESC LIMIT 1)`,
    })
    .from(supportMessage)
    .leftJoin(user, eq(user.id, supportMessage.userId))
    .groupBy(supportMessage.userId, user.name, user.email, user.type)
    .orderBy(desc(sql`MAX(${supportMessage.createdAt})`));

  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  let body: { userId?: string; body?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const userId = (body.userId || '').trim();
  const text = (body.body || '').trim();
  if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });

  await db.insert(supportMessage).values({
    userId,
    senderRole: 'admin',
    body: text,
    isRead: 0,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
