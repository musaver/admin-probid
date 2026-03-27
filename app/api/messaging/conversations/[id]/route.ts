import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, user, property } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!conv) return new NextResponse("Not found", { status: 404 });

    const [participant1] = await db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .where(eq(user.id, conv.participant1Id))
      .limit(1);

    const [participant2] = await db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .where(eq(user.id, conv.participant2Id))
      .limit(1);

    let propertyInfo = null;
    if (conv.propertyId) {
      const [prop] = await db
        .select({ id: property.id, title: property.title, address: property.address, saleId: property.saleId })
        .from(property)
        .where(eq(property.id, conv.propertyId))
        .limit(1);
      propertyInfo = prop || null;
    }

    return NextResponse.json({
      ...conv,
      participant1: participant1 || null,
      participant2: participant2 || null,
      property: propertyInfo,
    });
  } catch (error) {
    console.error("[ADMIN_CONVERSATION_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
