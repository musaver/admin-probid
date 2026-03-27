import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages, conversations, user } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return new NextResponse("Missing conversationId", { status: 400 });
    }

    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conv) return new NextResponse("Conversation not found", { status: 404 });

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    // Enrich with sender info
    const enriched = await Promise.all(
      msgs.map(async (msg) => {
        const [sender] = await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, msg.senderId))
          .limit(1);
        return { ...msg, sender: sender || null };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[ADMIN_MESSAGES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
