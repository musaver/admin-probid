import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { and, eq, ne } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const foundUser = await db.query.user.findFirst({
      where: eq(user.id, id),
    });

    if (!foundUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(foundUser);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();

    if (data.bidderNumber) {
      const conflict = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.bidderNumber, data.bidderNumber), ne(user.id, id)))
        .limit(1);
      if (conflict.length > 0) {
        return NextResponse.json({ error: `Bidder number "${data.bidderNumber}" is already assigned to another user.` }, { status: 409 });
      }
    }

    if (data.email) {
      const emailConflict = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, data.email), ne(user.id, id)))
        .limit(1);
      if (emailConflict.length > 0) {
        return NextResponse.json({ error: `An account with the email "${data.email}" already exists.` }, { status: 409 });
      }
    }

    await db
      .update(user)
      .set(data)
      .where(eq(user.id, id));

    const updatedUser = await db.query.user.findFirst({
      where: eq(user.id, id),
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error(error);
    const msg = error?.message?.toLowerCase() || '';
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists')) {
      return NextResponse.json({ error: 'A user with this email or bidder number already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update user. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db
      .delete(user)
      .where(eq(user.id, id));

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
} 