// GET /api/files/<key...> — streams a private object from DigitalOcean Spaces.
// Files are stored private; this proxy serves them back. Admins may view any file
// (reviewing bidder identity documents is part of their job), but the request MUST
// carry a valid admin session — the /api middleware enforces this, and requireAdmin()
// re-checks here as defense-in-depth. Responses are marked private so no shared/CDN
// cache can retain them.

import { NextResponse } from "next/server";
import { getObjectFromSpaces } from "@/lib/spaces";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(_req: Request, props: { params: Promise<{ key: string[] }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { key } = await props.params;
  const objectKey = (key || []).join("/");
  if (!objectKey) return new NextResponse("Not found", { status: 404 });

  const obj = await getObjectFromSpaces(objectKey);
  if (!obj) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(obj.body), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
