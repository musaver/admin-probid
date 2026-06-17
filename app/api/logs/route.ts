// GET /api/logs — admin action log (admin_logs joined with the admin who did it).
// Returns an array of { log, admin } — the shape the /logs page renders.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { desc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminLogs, adminUsers } from '@/lib/schema';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rows = await db
    .select({
      log: adminLogs,
      admin: { id: adminUsers.id, name: adminUsers.name, email: adminUsers.email },
    })
    .from(adminLogs)
    .leftJoin(adminUsers, eq(adminLogs.adminId, adminUsers.id))
    .orderBy(desc(adminLogs.createdAt))
    .limit(300);

  return NextResponse.json(rows);
}
