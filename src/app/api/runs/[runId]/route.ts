import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProtectionListForRun } from "@/app/actions/protectionList";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const run = await prisma.draftRun.findUnique({
      where: { id: runId },
      include: {
        season: true,
        runTeams: true,
        protectionLists: {
          include: {
            team: true,
            items: {
              include: {
                player: true,
              },
            },
          },
        },
        teamProtectionLocks: true,
        draftPicks: {
          include: {
            player: true,
            fromTeam: true,
            expansionRunTeam: true,
          },
        },
      },
    });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const existingTeams = await prisma.team.findMany({
      where: { seasonId: run.seasonId, isExpansion: false },
    });

    const plByTeam = new Map(run.protectionLists.map((pl) => [pl.teamId, pl]));
    const lockByTeam = new Map(
      run.teamProtectionLocks.map((l) => [l.teamId, l.lockedAt])
    );

    const protectionLists: Array<{
      id: string | null;
      teamId: string;
      teamName: string;
      teamAbbrev: string;
      lockedAt: string | null;
      items: Array<{
        id: string | null;
        playerId: string;
        playerName: string;
        position: string;
        isProtected: boolean;
        protectScore: number | null;
        scoreBreakdown: unknown;
      }>;
    }> = [];

    for (const team of existingTeams) {
      const pl = plByTeam.get(team.id);
      const lockAt = pl?.lockedAt ?? lockByTeam.get(team.id) ?? null;

      const result = await getProtectionListForRun(runId, team.id);
      if ("error" in result) {
        protectionLists.push({
          id: null,
          teamId: team.id,
          teamName: team.name,
          teamAbbrev: team.abbrev,
          lockedAt: lockAt?.toISOString?.() ?? null,
          items: [],
        });
      } else {
        protectionLists.push({
          id: result.protectionListId ?? pl?.id ?? null,
          teamId: team.id,
          teamName: team.name,
          teamAbbrev: team.abbrev,
          lockedAt: lockAt?.toISOString?.() ?? null,
          items: result.items.map((i) => ({
            id: i.id ?? null,
            playerId: i.playerId,
            playerName: i.playerName,
            position: i.position,
            isProtected: i.isProtected,
            protectScore: i.protectScore,
            scoreBreakdown: i.scoreBreakdown,
          })),
        });
      }
    }

    const rules = run.rulesSnapshotJson as Record<string, unknown>;
    return NextResponse.json({
      run: {
        id: run.id,
        name: run.name,
        status: run.status,
        rules: rules,
        seasonYear: run.season.year,
        salaryCap: Number(run.season.salaryCap),
        expansionCapPctYear1: Number(run.season.expansionCapPctYear1 ?? 0.667),
        salaryFloorPct: Number(run.season.salaryFloorPct ?? 0.9),
        runTeams: run.runTeams,
        protectionLists,
        draftPicks: run.draftPicks.map((p) => ({
          id: p.id,
          pickNumber: p.pickNumber,
          playerId: p.playerId,
          playerName: `${p.player.firstName} ${p.player.lastName}`,
          position: p.player.primaryPosition,
          fromTeamId: p.fromTeamId,
          fromTeamName: p.fromTeam.name,
          expansionTeamId: p.expansionRunTeamId,
          expansionTeamName: p.expansionRunTeam.name,
          salaryAtPick: Number(p.salaryAtPick),
        })),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch run" },
      { status: 500 }
    );
  }
}
