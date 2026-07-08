// DigitalOcean Spaces storage helper (S3-compatible).
// Replaces @vercel/blob. Returns the same { url, pathname } shape the routes
// already persist to the DB, so no schema/consumer changes are needed.
//
// Required env vars:
//   SPACES_KEY        - Spaces access key ID
//   SPACES_SECRET     - Spaces secret access key
//   SPACES_BUCKET     - bucket (Space) name
//   SPACES_REGION     - e.g. "nyc3"
// Optional:
//   SPACES_ENDPOINT     - defaults to https://<region>.digitaloceanspaces.com
//   SPACES_CDN_ENDPOINT - public/CDN base for returned URLs (e.g. https://<bucket>.nyc3.cdn.digitaloceanspaces.com)

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const region = process.env.SPACES_REGION || "nyc3";
const bucket = process.env.SPACES_BUCKET || "";
const endpoint = process.env.SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;

// This Space keeps objects private (object ACLs are disabled), so files are served
// back to browsers through the app's /api/files proxy instead of a direct Spaces URL.
// Stored `url` = <base>/api/files/<key>. Base is empty (relative) by default so it
// resolves against whichever app origin renders it; set FILE_PUBLIC_BASE for absolute URLs.
const proxyBase = (process.env.FILE_PUBLIC_BASE || "").replace(/\/+$/, "");

function publicUrlFor(key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${proxyBase}/api/files/${encoded}`;
}

// Reuse one client across hot-reloads / warm instances.
const globalForS3 = globalThis as unknown as { _spacesClient?: S3Client };

export const spaces =
  globalForS3._spacesClient ??
  new S3Client({
    region,
    endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: process.env.SPACES_KEY || "",
      secretAccessKey: process.env.SPACES_SECRET || "",
    },
  });

globalForS3._spacesClient = spaces;

export function isSpacesConfigured(): boolean {
  return !!(process.env.SPACES_KEY && process.env.SPACES_SECRET && process.env.SPACES_BUCKET);
}

function withRandomSuffix(key: string): string {
  const slash = key.lastIndexOf("/");
  const dir = slash >= 0 ? key.slice(0, slash + 1) : "";
  const file = slash >= 0 ? key.slice(slash + 1) : key;
  const dot = file.lastIndexOf(".");
  const base = dot >= 0 ? file.slice(0, dot) : file;
  const ext = dot >= 0 ? file.slice(dot) : "";
  return `${dir}${base}-${randomUUID().slice(0, 8)}${ext}`;
}

export async function uploadToSpaces(
  key: string,
  body: ArrayBuffer | Uint8Array | Buffer,
  opts: { contentType?: string; addRandomSuffix?: boolean } = {}
): Promise<{ url: string; pathname: string }> {
  const finalKey = opts.addRandomSuffix ? withRandomSuffix(key) : key;
  const bodyBuf =
    body instanceof ArrayBuffer ? Buffer.from(new Uint8Array(body)) : Buffer.from(body as Uint8Array);

  // Only send a per-object ACL if explicitly enabled. Newer DO Spaces have object
  // ACLs disabled and reject "public-read" with "ACL configuration unsupported".
  // Public access is granted via a bucket-level policy instead (see scripts).
  const acl = process.env.SPACES_ACL as "public-read" | undefined;

  await spaces.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      Body: bodyBuf,
      ...(acl ? { ACL: acl } : {}),
      ContentType: opts.contentType,
    })
  );

  return { url: publicUrlFor(finalKey), pathname: finalKey };
}

// Fetch an object's bytes + content type (used by the /api/files proxy route).
export async function getObjectFromSpaces(
  key: string
): Promise<{ body: Uint8Array; contentType?: string } | null> {
  try {
    const res = await spaces.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await res.Body!.transformToByteArray();
    return { body, contentType: res.ContentType };
  } catch {
    return null;
  }
}

// Turn a stored value (proxy URL, direct URL, or bare key) back into the object key.
export function keyFromStored(urlOrKey: string): string {
  if (urlOrKey.includes("/api/files/")) {
    return decodeURIComponent(urlOrKey.split("/api/files/")[1] || "");
  }
  if (/^https?:\/\//i.test(urlOrKey)) {
    return decodeURIComponent(new URL(urlOrKey).pathname.replace(/^\//, ""));
  }
  return urlOrKey;
}

// Accepts a proxy URL, a direct public URL, or a bare object key.
export async function deleteFromSpaces(urlOrKey: string): Promise<void> {
  const key = keyFromStored(urlOrKey);
  if (!key) return;
  await spaces.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
