// PUT /api/bulletin/:id   edit a post
// DELETE /api/bulletin/:id delete a post

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { bulletinPost } from '@/lib/schema';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json(['Invalid JSON body.'], { status: 400 }); }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === 'string') set.title = body.title.trim();
  if (typeof body.body === 'string') set.body = body.body.trim();
  if (['all', 'bidder', 'county'].includes(String(body.audience))) set.audience = body.audience;
  if (body.pinned !== undefined) set.pinned = body.pinned ? 1 : 0;
  if (body.published !== undefined) set.published = body.published ? 1 : 0;

  await db.update(bulletinPost).set(set).where(eq(bulletinPost.id, id));
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;
  await db.delete(bulletinPost).where(eq(bulletinPost.id, id));
  return NextResponse.json({ success: true });
}
