import { NextRequest, NextResponse } from "next/server";
import { toggleProtectionAndPersist } from "@/app/actions/protectionList";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json();
    const { itemId, isProtected, teamId, playerId } = body;
    if (typeof isProtected !== "boolean") {
      return NextResponse.json(
        { error: "isProtected (boolean) required" },
        { status: 400 }
      );
    }
    if (typeof itemId === "string") {
      const { prisma } = await import("@/lib/db");
      const item = await prisma.protectionListItem.findFirst({
        where: { id: itemId },
        include: { protectionList: true },
      });
      if (!item || item.protectionList.runId !== runId) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      if (item.protectionList.lockedAt) {
        return NextResponse.json(
          { error: "Protection list is locked" },
          { status: 400 }
        );
      }
      await prisma.protectionListItem.update({
        where: { id: itemId },
        data: { isProtected },
      });
      return NextResponse.json({ ok: true });
    }
    if (typeof teamId === "string" && typeof playerId === "string") {
      const result = await toggleProtectionAndPersist(
        runId,
        teamId,
        playerId,
        isProtected
      );
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "Either itemId or (teamId + playerId) required" },
      { status: 400 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update protection" },
      { status: 500 }
    );
  }
}
