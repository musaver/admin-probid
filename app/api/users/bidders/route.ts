import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { and, eq, like, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.trim() || '';

    const whereClause = q
      ? and(
          eq(user.type, 'bidder'),
          or(
            like(user.name, `%${q}%`),
            like(user.email, `%${q}%`),
            like(user.phone, `%${q}%`),
            like(user.bidderNumber, `%${q}%`)
          )
        )
      : eq(user.type, 'bidder');

    const bidders = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bidderNumber: user.bidderNumber,
      })
      .from(user)
      .where(whereClause)
      .limit(50);

    return NextResponse.json(bidders);
  } catch (error) {
    console.error('Error searching bidders:', error);
    return NextResponse.json({ error: 'Failed to search bidders' }, { status: 500 });
  }
}
