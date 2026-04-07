import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

/**
 * POST /api/admin/move-player
 * Body: { playerName: string, newTeamAbbrev: string }
 *
 * Reassigns a player's PlayerSeasonMetric + Contract to a different team.
 * For mid-season trades where the player hasn't logged minutes on the new team.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const body = await req.json().catch(() => null);
  const playerName = (body?.playerName ?? "").trim();
  const newTeamAbbrev = (body?.newTeamAbbrev ?? "").trim().toUpperCase();

  if (!playerName || !newTeamAbbrev) {
    return NextResponse.json(
      { error: "playerName and newTeamAbbrev are required" },
      { status: 400 }
    );
  }

  const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  if (!season) {
    return NextResponse.json({ error: "No season found" }, { status: 400 });
  }

  const newTeam = await prisma.team.findFirst({
    where: { seasonId: season.id, abbrev: newTeamAbbrev },
  });
  if (!newTeam) {
    return NextResponse.json(
      { error: `Team '${newTeamAbbrev}' not found for season ${season.year}` },
      { status: 404 }
    );
  }

  // Find player by name (case-insensitive partial match)
  const nameParts = playerName.toLowerCase().split(/\s+/);
  const allPlayers = await prisma.player.findMany({
    select: { id: true, firstName: true, lastName: true },
  });

  const player = allPlayers.find((p) => {
    const full = `${p.firstName} ${p.lastName}`.toLowerCase();
    return full === playerName.toLowerCase() || nameParts.every((part) => full.includes(part));
  });

  if (!player) {
    return NextResponse.json(
      { error: `Player '${playerName}' not found` },
      { status: 404 }
    );
  }

  const fullName = `${player.firstName} ${player.lastName}`;

  // Update PlayerSeasonMetric(s)
  const metricsUpdated = await prisma.playerSeasonMetric.updateMany({
    where: { seasonId: season.id, playerId: player.id },
    data: { teamId: newTeam.id },
  });

  // Update Contract(s)
  const contractsUpdated = await prisma.contract.updateMany({
    where: { seasonId: season.id, playerId: player.id },
    data: { teamId: newTeam.id },
  });

  return NextResponse.json({
    ok: true,
    playerName: fullName,
    newTeam: newTeamAbbrev,
    metricsUpdated: metricsUpdated.count,
    contractsUpdated: contractsUpdated.count,
  });
}
