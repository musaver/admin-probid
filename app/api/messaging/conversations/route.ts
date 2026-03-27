import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, user, messages, property } from "@/lib/schema";
import { eq, desc, isNotNull } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const allConversations = await db
      .select()
      .from(conversations)
      .where(isNotNull(conversations.propertyId))
      .orderBy(desc(conversations.lastMessageAt));

    const enriched = await Promise.all(
      allConversations.map(async (conv) => {
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

        const unreadMessages = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.conversationId, conv.id));

        let propertyInfo = null;
        if (conv.propertyId) {
          const [prop] = await db
            .select({ id: property.id, title: property.title, address: property.address, saleId: property.saleId })
            .from(property)
            .where(eq(property.id, conv.propertyId))
            .limit(1);
          propertyInfo = prop || null;
        }

        return {
          ...conv,
          participant1: participant1 || null,
          participant2: participant2 || null,
          messageCount: unreadMessages.length,
          property: propertyInfo,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[ADMIN_CONVERSATIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
