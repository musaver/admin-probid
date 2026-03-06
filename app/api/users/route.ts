import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const allUsers = await db.select().from(user);
    return NextResponse.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date();

    const newUser = {
      id: uuidv4(),
      name: body.name || null,
      email: body.email,
      type: body.type || 'bidder',
      phone: body.phone || null,
      country: body.country || null,
      city: body.city || null,
      state: body.state || null,
      countyId: body.type === 'bidder' && body.countyId ? body.countyId : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(user).values(newUser as any);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
