import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { property, propertyLinkedBidders, propertyAlerts, user } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { sendTextEmail } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const body = await req.json();
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();
    const bidderIds = body.bidderIds as string[] | null;

    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const [p] = await db
      .select({ id: property.id, address: property.address, title: property.title })
      .from(property)
      .where(eq(property.id, propertyId))
      .limit(1);

    if (!p) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    // Fetch linked bidders with emails
    const linked = await db
      .select({
        bidderId: propertyLinkedBidders.bidderId,
        email: user.email,
        name: user.name,
      })
      .from(propertyLinkedBidders)
      .leftJoin(user, eq(propertyLinkedBidders.bidderId, user.id))
      .where(eq(propertyLinkedBidders.propertyId, propertyId));

    let recipients = linked.filter(r => !!r.email);

    if (Array.isArray(bidderIds) && bidderIds.length > 0) {
      const allow = new Set(bidderIds);
      recipients = recipients.filter(r => allow.has(r.bidderId));
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }

    const propertyLabel = p.title || p.address || propertyId;
    const emailText = `Property: ${propertyLabel}\n\n${message}`;

    const sendResults: { email: string; ok: boolean; error?: string }[] = [];
    for (const r of recipients) {
      try {
        await sendTextEmail(r.email!, subject, emailText);
        sendResults.push({ email: r.email!, ok: true });
      } catch (e) {
        sendResults.push({
          email: r.email!,
          ok: false,
          error: e instanceof Error ? e.message : 'Failed',
        });
      }
    }

    const alertId = uuidv4();
    await db.insert(propertyAlerts).values({
      id: alertId,
      propertyId,
      sentByUserId: 'admin',
      subject,
      message,
      recipientCount: recipients.length,
      createdAt: new Date(),
    });

    const failed = sendResults.filter(r => !r.ok);
    return NextResponse.json({
      success: failed.length === 0,
      sent: sendResults.filter(r => r.ok).length,
      failed,
      alertId,
    });
  } catch (error) {
    console.error('Error sending alerts:', error);
    return NextResponse.json({ error: 'Failed to send alerts' }, { status: 500 });
  }
}
