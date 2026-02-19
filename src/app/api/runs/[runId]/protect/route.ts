import { NextRequest, NextResponse } from "next/server";
import { toggleProtectionAndPersist, setTeamDirection } from "@/app/actions/protectionList";
import type { TeamDirection } from "@/lib/scoring/rules-schema";

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

/** PUT /api/runs/[runId]/protect — update team direction */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json();
    const { teamId, teamDirection } = body;
    if (typeof teamId !== "string") {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }
    const validDirections = ["rebuild", "neutral", "contend"];
    if (!validDirections.includes(teamDirection)) {
      return NextResponse.json(
        { error: "teamDirection must be rebuild | neutral | contend" },
        { status: 400 }
      );
    }
    const result = await setTeamDirection(runId, teamId, teamDirection as TeamDirection);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, teamDirection });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update protection" },
      { status: 500 }
    );
  }
}
