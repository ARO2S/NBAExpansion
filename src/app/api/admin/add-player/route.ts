import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeTeamAbbrev } from "@/lib/team-abbrev";
import { requireAdmin } from "@/lib/admin";

/**
 * POST /api/admin/add-player
 *
 * Manually add a player to a team with a contract and minimal metrics.
 * Used for injured players who don't appear in the BBR stats CSV because
 * they haven't played (e.g. Haliburton, Tatum).
 *
 * Body: {
 *   name: string,          // "Jayson Tatum"
 *   teamAbbrev: string,    // "BOS"
 *   position: string,      // "SF"
 *   salary: number,        // 32600060
 *   yearsRemaining?: number, // 3
 *   age?: number,          // 27
 *   gamesPlayed?: number,  // 0
 * }
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  let body: {
    name?: string;
    teamAbbrev?: string;
    position?: string;
    salary?: number;
    yearsRemaining?: number;
    age?: number;
    gamesPlayed?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const { name, teamAbbrev, position, salary, yearsRemaining, age, gamesPlayed } = body;

  if (!name?.trim() || !teamAbbrev?.trim() || !position?.trim() || salary == null) {
    return NextResponse.json(
      { error: "Required fields: name, teamAbbrev, position, salary" },
      { status: 400 }
    );
  }

  try {
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json({ error: "No season found" }, { status: 400 });
    }

    const abbrev = normalizeTeamAbbrev(teamAbbrev);
    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, abbrev },
    });
    if (!team) {
      return NextResponse.json(
        { error: `Team ${abbrev} not found for season ${season.year}` },
        { status: 400 }
      );
    }

    // Parse name
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "Unknown";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

    // Check for existing player (avoid duplicates)
    const existing = await prisma.player.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
    });

    if (existing) {
      // Player exists -- just make sure they have a contract and metric
      const existingContract = await prisma.contract.findFirst({
        where: { seasonId: season.id, playerId: existing.id },
      });
      if (!existingContract) {
        await prisma.contract.create({
          data: {
            seasonId: season.id,
            teamId: team.id,
            playerId: existing.id,
            salary,
            yearsRemaining: yearsRemaining ?? 1,
          },
        });
      } else {
        await prisma.contract.update({
          where: { id: existingContract.id },
          data: { salary, yearsRemaining: yearsRemaining ?? existingContract.yearsRemaining, teamId: team.id },
        });
      }

      const existingMetric = await prisma.playerSeasonMetric.findFirst({
        where: { seasonId: season.id, playerId: existing.id },
      });
      if (!existingMetric) {
        await prisma.playerSeasonMetric.create({
          data: {
            seasonId: season.id,
            teamId: team.id,
            playerId: existing.id,
            gamesPlayed: gamesPlayed ?? 0,
            minutesPerGame: 0,
            starts: 0,
            pointsPerGame: 0,
            assistsPerGame: 0,
            reboundsPerGame: 0,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        action: "updated",
        playerId: existing.id,
        playerName: `${existing.firstName} ${existing.lastName}`,
        teamAbbrev: abbrev,
        salary,
      });
    }

    // Create new player
    const effectiveAge = age && age > 0 ? age : 25;
    const birthYear = season.year - effectiveAge;
    const birthdate = new Date(birthYear, 5, 15);

    const pos = ["PG", "SG", "SF", "PF", "C"].includes(position.toUpperCase())
      ? position.toUpperCase()
      : "SF";

    const player = await prisma.player.create({
      data: {
        firstName,
        lastName,
        birthdate,
        primaryPosition: pos,
      },
    });

    await prisma.contract.create({
      data: {
        seasonId: season.id,
        teamId: team.id,
        playerId: player.id,
        salary,
        yearsRemaining: yearsRemaining ?? 1,
      },
    });

    await prisma.playerSeasonMetric.create({
      data: {
        seasonId: season.id,
        teamId: team.id,
        playerId: player.id,
        gamesPlayed: gamesPlayed ?? 0,
        minutesPerGame: 0,
        starts: 0,
        pointsPerGame: 0,
        assistsPerGame: 0,
        reboundsPerGame: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "created",
      playerId: player.id,
      playerName: `${firstName} ${lastName}`,
      teamAbbrev: abbrev,
      salary,
    });
  } catch (e) {
    console.error("Add player failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
