import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
            items: { include: { player: true } },
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

    const teamsNeedingCanonical = existingTeams
      .filter((t) => !plByTeam.has(t.id))
      .map((t) => t.id);

    type CanonicalWithItems = Awaited<
      ReturnType<typeof prisma.canonicalProtectionList.findMany<{
        include: { items: { include: { player: true } } };
      }>>
    >[number];
    const canonicalByTeam = new Map<string, CanonicalWithItems>();

    if (teamsNeedingCanonical.length > 0) {
      const canonicalLists = await prisma.canonicalProtectionList.findMany({
        where: {
          seasonId: run.seasonId,
          teamId: { in: teamsNeedingCanonical },
        },
        include: { items: { include: { player: true } } },
      });
      for (const cl of canonicalLists) {
        canonicalByTeam.set(cl.teamId, cl);
      }
    }

    const protectionLists = existingTeams.map((team) => {
      const pl = plByTeam.get(team.id);
      const lockAt = pl?.lockedAt ?? lockByTeam.get(team.id) ?? null;

      if (pl) {
        return {
          id: pl.id,
          teamId: team.id,
          teamName: team.name,
          teamAbbrev: team.abbrev,
          lockedAt: lockAt?.toISOString?.() ?? null,
          items: pl.items
            .sort((a, b) => Number((b.protectScore ?? 0) - (a.protectScore ?? 0)))
            .map((i) => ({
              id: i.id,
              playerId: i.playerId,
              playerName: `${i.player.firstName} ${i.player.lastName}`,
              position: i.player.primaryPosition,
              isProtected: i.isProtected,
              protectScore: i.protectScore != null ? Number(i.protectScore) : 0,
              scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
            })),
        };
      }

      const canonical = canonicalByTeam.get(team.id);
      if (canonical) {
        return {
          id: null,
          teamId: team.id,
          teamName: team.name,
          teamAbbrev: team.abbrev,
          lockedAt: lockAt?.toISOString?.() ?? null,
          items: canonical.items
            .sort((a, b) => Number((b.protectScore ?? 0) - (a.protectScore ?? 0)))
            .map((i) => ({
              id: null as string | null,
              playerId: i.playerId,
              playerName: `${i.player.firstName} ${i.player.lastName}`,
              position: i.player.primaryPosition,
              isProtected: i.isProtected,
              protectScore: i.protectScore != null ? Number(i.protectScore) : 0,
              scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
            })),
        };
      }

      return {
        id: null,
        teamId: team.id,
        teamName: team.name,
        teamAbbrev: team.abbrev,
        lockedAt: lockAt?.toISOString?.() ?? null,
        items: [] as Array<{
          id: string | null;
          playerId: string;
          playerName: string;
          position: string;
          isProtected: boolean;
          protectScore: number;
          scoreBreakdown: object;
        }>,
      };
    });

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
