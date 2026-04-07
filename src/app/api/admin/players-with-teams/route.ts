import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

/**
 * GET /api/admin/players-with-teams
 * Returns all players with their current team (from the latest season's contract).
 * Use this to verify player → team linkage (e.g. "Naz Reid" → "Minnesota Timberwolves").
 */
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const latestSeason = await prisma.season.findFirst({
      orderBy: { year: "desc" },
    });
    if (!latestSeason) {
      return NextResponse.json({ players: [], message: "No season in DB. Run a sync first." });
    }

    const contracts = await prisma.contract.findMany({
      where: { seasonId: latestSeason.id },
      include: {
        player: true,
        team: true,
      },
      orderBy: [{ team: { name: "asc" } }, { player: { lastName: "asc" } }],
    });

    const players = contracts.map((c) => ({
      playerId: c.player.id,
      firstName: c.player.firstName,
      lastName: c.player.lastName,
      position: c.player.primaryPosition,
      teamId: c.team.id,
      teamName: c.team.name,
      teamAbbrev: c.team.abbrev,
      providerTeamId: c.team.providerTeamId ?? undefined,
      seasonYear: latestSeason.year,
      salary: Number(c.salary),
    }));

    return NextResponse.json({
      seasonYear: latestSeason.year,
      count: players.length,
      players,
      // Run this in Supabase SQL editor to see player → team in the DB (table names may be "Player"/"Contract"/"Team" if Prisma left them PascalCase):
      sqlHint:
        'SELECT p.first_name, p.last_name, t.name AS team, t.abbrev FROM "Player" p JOIN "Contract" c ON c.player_id = p.id JOIN "Team" t ON t.id = c.team_id ORDER BY t.name, p.last_name',
    });
  } catch (e) {
    console.error("players-with-teams failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
