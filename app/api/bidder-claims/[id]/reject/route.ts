// POST /api/bidder-claims/:id/reject  { note: "why" }
// Marks a bidder claim rejected (links nothing) and emails the bidder.

import { NextResponse, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidderClaim, user } from '@/lib/schema';
import { sendTextEmail } from '@/lib/email';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  let note: string | null = null;
  try { note = (await req.json())?.note ?? null; } catch { /* ignore */ }
  if (!note || !String(note).trim()) {
    return NextResponse.json({ error: 'A reason for rejection is required.' }, { status: 400 });
  }

  const [claim] = await db.select().from(bidderClaim).where(eq(bidderClaim.id, id)).limit(1);
  if (!claim) return new NextResponse('Claim not found', { status: 404 });
  if (claim.status !== 'pending') return NextResponse.json({ error: `Claim is already ${claim.status}` }, { status: 409 });

  const now = new Date();
  await db.update(bidderClaim)
    .set({ status: 'rejected', reviewedByAdminId: adminId, reviewedAt: now, note })
    .where(eq(bidderClaim.id, id));

  after(async () => {
    try {
      const [b] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, claim.bidderUserId)).limit(1);
      if (b?.email) {
        await sendTextEmail(
          b.email,
          'Update on your BidBridge claim',
          `Hi ${b.name || ''},\n\nWe couldn't verify your recent claim. Reason: ${note}\n\nPlease double-check your bidder number and property details and submit again.`,
        );
      }
    } catch (e) { console.error('[bidder-reject] email failed', e); }
  });

  return NextResponse.json({ success: true });
}
