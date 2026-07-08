// GET /api/files/<key...> — streams a private object from DigitalOcean Spaces.
// Files are stored private (this Space has object ACLs disabled), so they are served
// back through this proxy. Public read, matching the old Vercel Blob public-URL behavior.

import { NextResponse } from "next/server";
import { getObjectFromSpaces } from "@/lib/spaces";

export async function GET(_req: Request, props: { params: Promise<{ key: string[] }> }) {
  const { key } = await props.params;
  const objectKey = (key || []).join("/");
  if (!objectKey) return new NextResponse("Not found", { status: 404 });

  const obj = await getObjectFromSpaces(objectKey);
  if (!obj) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(obj.body), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
