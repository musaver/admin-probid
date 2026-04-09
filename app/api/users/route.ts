import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';
import { like, or, and, eq, asc, desc, count, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
    const countyId = searchParams.get('countyId') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const direction = searchParams.get('direction') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = searchParams.get('pageSize') || '100';

    const whereClauses = [];
    if (search) {
      whereClauses.push(
        or(
          like(user.name, `%${search}%`),
          like(user.email, `%${search}%`),
          like(user.phone, `%${search}%`)
        )
      );
    }
    if (type !== 'all') {
      whereClauses.push(eq(user.type, type as any));
    }
    if (countyId) {
      whereClauses.push(eq(user.countyId, countyId));
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    // Total count
    const totalResult = await db.select({ value: count() }).from(user).where(where);
    const total = totalResult[0].value;

    // Data query
    const sortColumn = (user as any)[sort] || user.createdAt;
    const users = await db
      .select()
      .from(user)
      .where(where)
      .orderBy(direction === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(pageSize === 'all' ? 1000000 : parseInt(pageSize))
      .offset(pageSize === 'all' ? 0 : (page - 1) * parseInt(pageSize));

    return NextResponse.json({ users, total });
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
