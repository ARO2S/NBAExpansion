import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

/**
 * POST /api/admin/resolve-multi-team
 *
 * For each player who has metrics on multiple teams this season, keep only
 * the most recently created entry (= current team, since BBR CSV lists
 * current team last) and delete the others. Also reassigns any contracts
 * that pointed to an old team.
 *
 * Returns a summary of what was resolved.
 */
export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json({ error: "No season found" }, { status: 400 });
    }

    // Find all metrics for this season, ordered by createdAt
    const allMetrics = await prisma.playerSeasonMetric.findMany({
      where: { seasonId: season.id },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, abbrev: true, name: true } },
      },
      orderBy: { updatedAt: "asc" },
    });

    // Group by player
    const byPlayer = new Map<string, typeof allMetrics>();
    for (const m of allMetrics) {
      const list = byPlayer.get(m.playerId) ?? [];
      list.push(m);
      byPlayer.set(m.playerId, list);
    }

    const resolved: Array<{
      playerName: string;
      keptTeam: string;
      removedTeams: string[];
      contractReassigned: boolean;
    }> = [];

    for (const [playerId, metrics] of byPlayer) {
      if (metrics.length <= 1) continue;

      // The last entry (by creation order) is the current team
      const current = metrics[metrics.length - 1];
      const toDelete = metrics.slice(0, -1);

      // Delete old team metrics
      await prisma.playerSeasonMetric.deleteMany({
        where: {
          id: { in: toDelete.map((m) => m.id) },
        },
      });

      // Reassign any contracts on old teams to the current team
      const oldTeamIds = toDelete.map((m) => m.teamId);
      let contractReassigned = false;

      const contractsOnOldTeams = await prisma.contract.findMany({
        where: {
          seasonId: season.id,
          playerId,
          teamId: { in: oldTeamIds },
        },
      });

      if (contractsOnOldTeams.length > 0) {
        for (const c of contractsOnOldTeams) {
          await prisma.contract.update({
            where: { id: c.id },
            data: { teamId: current.teamId },
          });
        }
        contractReassigned = true;
      }

      resolved.push({
        playerName: `${current.player.firstName} ${current.player.lastName}`,
        keptTeam: `${current.team.abbrev} (${current.team.name})`,
        removedTeams: toDelete.map((m) => `${m.team.abbrev} (${m.gamesPlayed}g)`),
        contractReassigned,
      });
    }

    return NextResponse.json({
      ok: true,
      seasonYear: season.year,
      playersResolved: resolved.length,
      resolved,
    });
  } catch (e) {
    console.error("Resolve multi-team failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
