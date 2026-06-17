// Bulletin posts (admin).
//   GET  /api/bulletin   list all posts (incl. drafts) for the admin manager
//   POST /api/bulletin   create a post

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { bulletinPost } from '@/lib/schema';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const posts = await db.select().from(bulletinPost).orderBy(desc(bulletinPost.pinned), desc(bulletinPost.createdAt));
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return new NextResponse('Unauthorized', { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json(['Invalid JSON body.'], { status: 400 }); }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  const audience = ['all', 'bidder', 'county'].includes(String(body.audience)) ? String(body.audience) : 'all';
  if (!title || !text) return NextResponse.json(['Title and message are required.'], { status: 400 });

  const now = new Date();
  const row = {
    id: uuidv4(),
    title,
    body: text,
    audience: audience as 'all' | 'bidder' | 'county',
    pinned: body.pinned ? 1 : 0,
    published: body.published === false ? 0 : 1,
    createdByAdminId: adminId,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(bulletinPost).values(row);
  return NextResponse.json({ success: true, post: row }, { status: 201 });
}
