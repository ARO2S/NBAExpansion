import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json();
    const { protectionListId, teamId } = body;

    if (typeof protectionListId === "string") {
      const pl = await prisma.protectionList.findFirst({
        where: { id: protectionListId, runId },
      });
      if (!pl) {
        return NextResponse.json(
          { error: "Protection list not found" },
          { status: 404 }
        );
      }
      await prisma.protectionList.update({
        where: { id: protectionListId },
        data: { lockedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (typeof teamId === "string") {
      const run = await prisma.draftRun.findUnique({
        where: { id: runId },
      });
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });
      if (!team || team.seasonId !== run.seasonId) {
        return NextResponse.json(
          { error: "Team not found or wrong season" },
          { status: 404 }
        );
      }
      const pl = await prisma.protectionList.findFirst({
        where: { runId, teamId },
      });
      if (pl) {
        await prisma.protectionList.update({
          where: { id: pl.id },
          data: { lockedAt: new Date() },
        });
      } else {
        const existing = await prisma.teamProtectionLock.findUnique({
          where: { runId_teamId: { runId, teamId } },
        });
        if (!existing) {
          await prisma.teamProtectionLock.create({
            data: { runId, teamId },
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "protectionListId or teamId required" },
      { status: 400 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to lock" },
      { status: 500 }
    );
  }
}
