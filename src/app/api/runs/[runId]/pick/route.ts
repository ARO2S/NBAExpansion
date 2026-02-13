import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateDraftPick } from "@/lib/draft-constraints";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json();
    const { playerId, fromTeamId, expansionRunTeamId } = body;
    if (
      typeof playerId !== "string" ||
      typeof fromTeamId !== "string" ||
      typeof expansionRunTeamId !== "string"
    ) {
      return NextResponse.json(
        { error: "playerId, fromTeamId, expansionRunTeamId required" },
        { status: 400 }
      );
    }

    const run = await prisma.draftRun.findUnique({
      where: { id: runId },
      include: {
        draftPicks: true,
        runTeams: true,
        season: true,
      },
    });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const contract = await prisma.contract.findFirst({
      where: {
        playerId,
        teamId: fromTeamId,
        seasonId: run.seasonId,
      },
    });
    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found for player/team" },
        { status: 400 }
      );
    }

    const expansionTeam = run.runTeams.find((t) => t.id === expansionRunTeamId);
    if (!expansionTeam) {
      return NextResponse.json(
        { error: "Expansion team not found" },
        { status: 400 }
      );
    }

    const teamsThatLost = new Set(run.draftPicks.map((p) => p.fromTeamId));
    const expansionPicks = run.draftPicks.filter(
      (p) => p.expansionRunTeamId === expansionRunTeamId
    );
    const nextPickNumber = run.draftPicks.length + 1;

    const { getDraftPoolForRun } = await import("@/lib/draft-pool");
    const pool = (await getDraftPoolForRun(runId)) ?? [];

    const rules = run.rulesSnapshotJson as any;
    const err = validateDraftPick(
      playerId,
      fromTeamId,
      expansionRunTeamId,
      pool,
      teamsThatLost,
      expansionPicks.length,
      rules,
      run.runTeams.filter((t) => t.userControls).length || 1
    );
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    await prisma.draftPick.create({
      data: {
        runId,
        pickNumber: nextPickNumber,
        expansionRunTeamId,
        fromTeamId,
        playerId,
        salaryAtPick: contract.salary,
      },
    });

    const totalPicks = run.draftPicks.length + 1;
    const allListsLocked = await (async () => {
      const lists = await prisma.protectionList.count({
        where: { runId, lockedAt: null },
      });
      return lists === 0;
    })();
    let newStatus = run.status;
    if (run.status === "protecting" && allListsLocked) {
      newStatus = "drafting";
    }
    const maxPicksPerTeam = Math.ceil(
      rules.expansionDraftMaxPicks / run.runTeams.length
    );
    const totalForThisTeam = expansionPicks.length + 1;
    if (totalForThisTeam >= maxPicksPerTeam) {
      const counts = await Promise.all(
        run.runTeams.map((t) =>
          prisma.draftPick.count({
            where: { runId, expansionRunTeamId: t.id },
          })
        )
      );
      const allAtMax = counts.every((c) => c >= maxPicksPerTeam);
      if (allAtMax) {
        newStatus = "complete";
      }
    }

    if (newStatus !== run.status) {
      await prisma.draftRun.update({
        where: { id: runId },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({
      ok: true,
      pickNumber: nextPickNumber,
      status: newStatus,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to record pick" },
      { status: 500 }
    );
  }
}
