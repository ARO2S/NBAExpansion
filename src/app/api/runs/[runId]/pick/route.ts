import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    const [run, contract] = await Promise.all([
      prisma.draftRun.findUnique({
        where: { id: runId },
        include: {
          draftPicks: true,
          runTeams: true,
          season: true,
        },
      }),
      prisma.contract.findFirst({
        where: { playerId, teamId: fromTeamId },
        include: { team: true },
      }),
    ]);

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (!contract || contract.team.seasonId !== run.seasonId) {
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
    if (teamsThatLost.has(fromTeamId)) {
      return NextResponse.json(
        { error: "This team has already lost a player in this expansion draft." },
        { status: 400 }
      );
    }

    const rules = run.rulesSnapshotJson as any;
    const expansionTeamsCount = run.runTeams.filter((t) => t.userControls).length || 1;
    const maxPicks =
      expansionTeamsCount === 1
        ? rules.expansionDraftMaxPicks
        : Math.ceil(rules.expansionDraftMaxPicks / expansionTeamsCount);

    const expansionPicks = run.draftPicks.filter(
      (p) => p.expansionRunTeamId === expansionRunTeamId
    );
    if (expansionPicks.length >= maxPicks) {
      return NextResponse.json(
        { error: `Expansion team has reached maximum picks (${maxPicks}).` },
        { status: 400 }
      );
    }

    const isProtected = await isPlayerProtected(runId, run.seasonId, fromTeamId, playerId);
    if (isProtected) {
      return NextResponse.json(
        { error: "Player is not available in the draft pool." },
        { status: 400 }
      );
    }

    if (rules.uFAExemptFromProtection && contract.isUFAAfterSeason) {
      // UFAs are always draftable, skip option checks
    } else if (
      !rules.allowDraftingPlayersWithOptions &&
      (contract.hasPlayerOption || contract.hasTeamOption)
    ) {
      return NextResponse.json(
        { error: "Player is not available in the draft pool." },
        { status: 400 }
      );
    }

    const nextPickNumber = run.draftPicks.length + 1;
    const pick = await prisma.draftPick.create({
      data: {
        runId,
        pickNumber: nextPickNumber,
        expansionRunTeamId,
        fromTeamId,
        playerId,
        salaryAtPick: contract.salary,
      },
      include: {
        player: true,
        fromTeam: true,
        expansionRunTeam: true,
      },
    });

    let newStatus = run.status;
    if (run.status === "protecting") {
      const unlockedCount = await prisma.protectionList.count({
        where: { runId, lockedAt: null },
      });
      if (unlockedCount === 0) newStatus = "drafting";
    }

    const totalForThisTeam = expansionPicks.length + 1;
    if (totalForThisTeam >= maxPicks) {
      const pickCounts = run.draftPicks.reduce<Record<string, number>>((acc, p) => {
        acc[p.expansionRunTeamId] = (acc[p.expansionRunTeamId] ?? 0) + 1;
        return acc;
      }, {});
      pickCounts[expansionRunTeamId] = (pickCounts[expansionRunTeamId] ?? 0) + 1;

      const allAtMax = run.runTeams.every(
        (t) => (pickCounts[t.id] ?? 0) >= maxPicks
      );
      if (allAtMax) newStatus = "complete";
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
      pick: {
        id: pick.id,
        pickNumber: pick.pickNumber,
        playerId: pick.playerId,
        playerName: `${pick.player.firstName} ${pick.player.lastName}`,
        position: pick.player.primaryPosition,
        fromTeamId: pick.fromTeamId,
        fromTeamName: pick.fromTeam.name,
        expansionTeamId: pick.expansionRunTeamId,
        expansionTeamName: pick.expansionRunTeam.name,
        salaryAtPick: Number(pick.salaryAtPick),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to record pick" },
      { status: 500 }
    );
  }
}

async function isPlayerProtected(
  runId: string,
  seasonId: string,
  teamId: string,
  playerId: string
): Promise<boolean> {
  const plItem = await prisma.protectionListItem.findFirst({
    where: {
      protectionList: { runId, teamId },
      playerId,
    },
  });
  if (plItem) return plItem.isProtected;

  const canonItem = await prisma.canonicalProtectionListItem.findFirst({
    where: {
      canonicalList: { seasonId, teamId },
      playerId,
    },
  });
  if (canonItem) return canonItem.isProtected;

  return false;
}
