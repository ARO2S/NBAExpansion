import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDraftPoolForRun } from "@/lib/draft-pool";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const run = await prisma.draftRun.findUnique({
      where: { id: runId },
      include: { draftPicks: true },
    });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const pool = await getDraftPoolForRun(runId);
    if (!pool) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const teamsThatLost = new Set(run.draftPicks.map((p) => p.fromTeamId));

    const playerIds = [...new Set(pool.map((p) => p.playerId))];
    const teamIds = [...new Set(pool.map((p) => p.teamId))];
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
    });
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
    });
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const metrics = await prisma.playerSeasonMetric.findMany({
      where: {
        seasonId: run.seasonId,
        playerId: { in: playerIds },
        teamId: { in: teamIds },
      },
    });
    const metricsMap = new Map(metrics.map((m) => [`${m.playerId}-${m.teamId}`, m]));

    const poolWithPlayerInfo = pool.map((p) => {
      const player = playerMap.get(p.playerId);
      const team = teamMap.get(p.teamId);
      const m = metricsMap.get(p.playerId);
      return {
        ...p,
        playerName: player
          ? `${player.firstName} ${player.lastName}`
          : "Unknown",
        position: player?.primaryPosition ?? "",
        teamName: team?.name ?? "",
        teamAbbrev: team?.abbrev ?? "",
        age: player
          ? new Date().getFullYear() -
            new Date(player.birthdate).getFullYear()
          : null,
        rating: (() => {
          const m = metricsMap.get(`${p.playerId}-${p.teamId}`);
          return m && m.overallRating != null ? Number(m.overallRating) : null;
        })(),
      };
    });

    return NextResponse.json({
      pool: poolWithPlayerInfo,
      teamsThatLost: Array.from(teamsThatLost),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to get draft pool" },
      { status: 500 }
    );
  }
}
