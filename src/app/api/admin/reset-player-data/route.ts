import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TEAM_NAMES } from "@/lib/team-abbrev";
import { requireAdmin } from "@/lib/admin";

/**
 * POST /api/admin/reset-player-data
 *
 * Wipes all player-dependent data (draft picks, protection lists, metrics,
 * contracts, accolades, players) and ensures the Season + all 30 NBA teams
 * exist. This prepares the DB for a clean import from Basketball-Reference CSVs.
 *
 * Keeps: Season (with rules).
 * Recreates: All 30 NBA teams (non-expansion).
 * Deletes: Everything player-related, all draft runs, exports, canonical lists.
 */
export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    // 1. Delete in dependency order (children first)
    await prisma.export.deleteMany({});
    await prisma.draftPick.deleteMany({});
    await prisma.protectionListItem.deleteMany({});
    await prisma.protectionList.deleteMany({});
    await prisma.teamProtectionLock.deleteMany({});
    await prisma.runTeam.deleteMany({});
    await prisma.draftRun.deleteMany({});
    await prisma.canonicalProtectionListItem.deleteMany({});
    await prisma.canonicalProtectionList.deleteMany({});
    await prisma.playerSeasonMetric.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.playerAccolade.deleteMany({});
    await prisma.player.deleteMany({});
    await prisma.team.deleteMany({});

    // 2. Ensure season exists (get the latest, or error if none)
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json(
        { error: "No season found. Create a season first (e.g. via seed)." },
        { status: 400 }
      );
    }

    // 3. Recreate all 30 NBA teams
    let teamsCreated = 0;
    for (const [abbrev, name] of Object.entries(TEAM_NAMES)) {
      await prisma.team.create({
        data: {
          seasonId: season.id,
          name,
          abbrev,
          isExpansion: false,
        },
      });
      teamsCreated++;
    }

    return NextResponse.json({
      ok: true,
      seasonYear: season.year,
      teamsCreated,
      message: `Wiped all player data. Season ${season.year} retained with ${teamsCreated} teams. Ready for CSV import.`,
    });
  } catch (e) {
    console.error("Reset failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 }
    );
  }
}
