import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/backfill-missing-metrics
 *
 * Finds all players who have a contract but no PlayerSeasonMetric entry
 * (e.g. injured all season — Haliburton, Tatum) and creates a 0-stat
 * metric row so they appear on their team's roster for scoring/protection.
 */
export async function POST() {
  try {
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json({ error: "No season found" }, { status: 400 });
    }

    const contractsWithoutMetrics = await prisma.contract.findMany({
      where: {
        seasonId: season.id,
        player: {
          playerSeasonMetrics: { none: { seasonId: season.id } },
        },
      },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, abbrev: true } },
      },
    });

    let created = 0;
    const players: Array<{ name: string; teamAbbrev: string }> = [];

    for (const c of contractsWithoutMetrics) {
      await prisma.playerSeasonMetric.create({
        data: {
          seasonId: season.id,
          teamId: c.teamId,
          playerId: c.playerId,
          gamesPlayed: 0,
          minutesPerGame: 0,
          starts: 0,
          pointsPerGame: 0,
          assistsPerGame: 0,
          reboundsPerGame: 0,
        },
      });
      created++;
      players.push({
        name: `${c.player.firstName} ${c.player.lastName}`,
        teamAbbrev: c.team.abbrev,
      });
    }

    return NextResponse.json({
      ok: true,
      seasonYear: season.year,
      metricsCreated: created,
      players,
      note: `Created 0-stat metrics for ${created} players with contracts but no stats (injured/DNP).`,
    });
  } catch (e) {
    console.error("Backfill missing metrics failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
