import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { property, propertyLinkedBidders, user as userTable } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";
import {
  normalizeBulkRow,
  loadExistingByParcelSale,
  loadBidderLookupMaps,
  resolveWinningBidderId,
  matchKey,
  type NormalizedBulkRow,
} from "@/lib/bulk-property-import";

const defaultVisibility = {
  minBid: true,
  currentBid: true,
  bidHistory: false,
  propertyStatus: true,
  bidderList: false,
  documents: true,
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const body = await req.json();
    const { properties, countyUserId, statusOnly: statusOnlyRaw } = body;
    const statusOnly = Boolean(statusOnlyRaw);

    if (!countyUserId) {
      return new NextResponse("County user is required", { status: 400 });
    }

    if (!Array.isArray(properties) || properties.length === 0) {
      return new NextResponse("No properties provided", { status: 400 });
    }

    const [countyUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.id, countyUserId), eq(userTable.type, "county")))
      .limit(1);

    if (!countyUser) {
      return new NextResponse("Invalid county user", { status: 400 });
    }

    type OkEntry = { kind: "ok"; index: number; row: NormalizedBulkRow };
    type SkipEntry = { kind: "skip"; index: number; message: string };

    const rowResults: Array<OkEntry | SkipEntry> = [];
    for (let index = 0; index < properties.length; index++) {
      const raw = properties[index] as Record<string, unknown>;
      const n = normalizeBulkRow(raw, { statusOnly });
      if (!n.ok) {
        rowResults.push({ kind: "skip", index, message: n.error });
        continue;
      }
      rowResults.push({ kind: "ok", index, row: n.row });
    }

    const parseErrors = rowResults.filter((r): r is SkipEntry => r.kind === "skip");
    const okRows = rowResults.filter((r): r is OkEntry => r.kind === "ok");

    const parcelIds = [
      ...new Set(
        okRows
          .map((r) => r.row.parcelId?.trim())
          .filter((p): p is string => Boolean(p && p.length > 0))
      ),
    ];

    const existingMap = await loadExistingByParcelSale(countyUserId, parcelIds);

    const emailsLc = new Set<string>();
    const numbers = new Set<string>();
      if (!statusOnly) {
      for (const r of okRows) {
        const row = r.row;
        if (row.bidderEmail?.trim())
          emailsLc.add(row.bidderEmail.trim().toLowerCase());
        if (row.bidderNumber?.trim()) numbers.add(row.bidderNumber.trim());
      }
    }

    const bidderMaps = await loadBidderLookupMaps(emailsLc, numbers);

    let inserted = 0;
    let updated = 0;
    let biddersLinked = 0;
    const warnings: { row: number; message: string }[] = [];
    const fatalRowErrors: { row: number; message: string }[] = parseErrors.map((e) => ({
      row: e.index + 2,
      message: e.message,
    }));

    function resolveLinkStatus(propertyStatus: string): "won" | "bidding" | "invited" {
      if (["sold", "sold_at_tax_sale", "deed_in_progress", "deed_issued", "redeemed", "redeemed_check_issued"].includes(propertyStatus)) {
        return "won";
      }
      if (propertyStatus === "active") return "bidding";
      return "invited"; // on_list, withdrawn, voided, cancelled
    }

    async function upsertLinkedBidder(propertyId: string, bidderId: string, propertyStatus: string) {
      const linkStatus = resolveLinkStatus(propertyStatus);
      const existing = await db
        .select({ id: propertyLinkedBidders.id })
        .from(propertyLinkedBidders)
        .where(and(eq(propertyLinkedBidders.propertyId, propertyId), eq(propertyLinkedBidders.bidderId, bidderId)))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(propertyLinkedBidders)
          .set({ status: linkStatus, linkedAt: new Date() })
          .where(eq(propertyLinkedBidders.id, existing[0].id));
      } else {
        await db.insert(propertyLinkedBidders).values({
          id: uuidv4(),
          propertyId,
          bidderId,
          status: linkStatus,
          linkedAt: new Date(),
        });
      }
      biddersLinked++;
    }

    for (const entry of okRows) {
      const sheetRow = entry.index + 2;
      const row = entry.row;
      const parcel = row.parcelId?.trim();
      const sale = row.saleId.trim();
      const maybeKey = parcel && sale ? matchKey(parcel, sale) : null;
      const existingId = maybeKey ? existingMap.get(maybeKey) : undefined;

      if (statusOnly) {
        if (!parcel) {
          fatalRowErrors.push({ row: sheetRow, message: "Status-only import requires Parcel ID." });
          continue;
        }
        if (!existingId) {
          fatalRowErrors.push({
            row: sheetRow,
            message: `No existing property for Parcel ID + Sale ID (${parcel} / ${sale}). Import full row first.`,
          });
          continue;
        }
        await db
          .update(property)
          .set({
            status: row.status,
            updatedAt: new Date(),
          })
          .where(eq(property.id, existingId));
        updated++;
        continue;
      }

      const win = resolveWinningBidderId(
        bidderMaps,
        row.bidderEmail,
        row.bidderNumber
      );
      if (win.conflict) {
        warnings.push({ row: sheetRow, message: `${win.conflict} — winning bidder left blank.` });
      }

      const winningBidderId = win.id;

      if (existingId) {
        await db
          .update(property)
          .set({
            title: row.title,
            address: row.address ?? null,
            city: row.city ?? null,
            zipCode: row.zipCode ? String(row.zipCode) : null,
            parcelId: row.parcelId ?? null,
            saleId: row.saleId,
            minBid: row.minBid ? String(row.minBid) : "0.00",
            winningBid: row.winningBid ? String(row.winningBid) : "0.00",
            winningBidderId: winningBidderId ?? null,
            owners: row.owners?.length ? row.owners : null,
            auctionStart: row.auctionStart ?? null,
            auctionEnd: row.auctionEnd ?? null,
            status: row.status,
            updatedAt: new Date(),
          })
          .where(eq(property.id, existingId));
        updated++;
        if (winningBidderId) {
          await upsertLinkedBidder(existingId, winningBidderId, row.status);
        }
      } else {
        const newPropertyId = uuidv4();
        await db.insert(property).values({
          id: newPropertyId,
          title: row.title,
          address: row.address ?? null,
          city: row.city ?? null,
          zipCode: row.zipCode ? String(row.zipCode) : null,
          parcelId: row.parcelId ?? null,
          saleId: row.saleId,
          minBid: row.minBid ? String(row.minBid) : "0.00",
          winningBid: row.winningBid ? String(row.winningBid) : "0.00",
          winningBidderId: winningBidderId ?? null,
          owners: row.owners?.length ? row.owners : null,
          auctionStart: row.auctionStart ?? null,
          auctionEnd: row.auctionEnd ?? null,
          createdBy: countyUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: row.status,
          visibilitySettings: defaultVisibility,
        });
        inserted++;
        if (winningBidderId) {
          await upsertLinkedBidder(newPropertyId, winningBidderId, row.status);
        }
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      biddersLinked,
      errors: fatalRowErrors,
      warnings,
      statusOnly,
    });
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return new NextResponse(error.message || "Internal Server Error", {
      status: 500,
    });
  }
}
