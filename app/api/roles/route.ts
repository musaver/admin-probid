import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminRoles } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '@/lib/api-auth';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const roles = await db.select().from(adminRoles);
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { name, permissions } = await req.json();

    const now = new Date();
    const newRole = {
      id: uuidv4(),
      name,
      permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(adminRoles).values(newRole);

    return NextResponse.json(newRole, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
