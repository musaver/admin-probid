import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminUsers, adminRoles } from '@/lib/schema';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq, like, or, and, asc, desc, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const roleId = searchParams.get('roleId') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const direction = searchParams.get('direction') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = searchParams.get('pageSize') || '100';

    const whereClauses = [];
    if (search) {
      whereClauses.push(
        or(
          like(adminUsers.name, `%${search}%`),
          like(adminUsers.email, `%${search}%`)
        )
      );
    }
    if (roleId) {
      whereClauses.push(eq(adminUsers.roleId, roleId));
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    const totalResult = await db.select({ value: count() }).from(adminUsers).where(where);
    const total = totalResult[0].value;

    const sortColumn = (adminUsers as any)[sort] || adminUsers.createdAt;
    const rows = await db
      .select({
        admin: adminUsers,
        role: {
          id: adminRoles.id,
          name: adminRoles.name,
          permissions: adminRoles.permissions,
        },
      })
      .from(adminUsers)
      .leftJoin(adminRoles, eq(adminUsers.roleId, adminRoles.id))
      .where(where)
      .orderBy(direction === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(pageSize === 'all' ? 1000000 : parseInt(pageSize))
      .offset(pageSize === 'all' ? 0 : (page - 1) * parseInt(pageSize));

    const admins = rows.map(({ admin, role }) => ({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        roleId: admin.roleId,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
      role,
    }));

    return NextResponse.json({ admins, total });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, roleId } = await req.json();

    // Get the role information
    const [roleData] = await db
      .select()
      .from(adminRoles)
      .where(eq(adminRoles.id, roleId))
      .limit(1);

    if (!roleData) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const now = new Date();
    const newAdmin = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      roleId,
      role: roleData.name,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(adminUsers).values(newAdmin);

    // Return admin without password
    const { password: _, ...adminWithoutPassword } = newAdmin;

    return NextResponse.json(adminWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
