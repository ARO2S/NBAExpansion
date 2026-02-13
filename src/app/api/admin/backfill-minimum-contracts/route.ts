import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/backfill-minimum-contracts
 *
 * Finds all players who have season metrics but no contract, and gives them
 * a league minimum deal (1 year, ~$1.1M). These are typically two-way /
 * G-League players who appear in BBR stats but not on the contracts page.
 */
export async function POST() {
  try {
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json({ error: "No season found" }, { status: 400 });
    }

    const MINIMUM_SALARY = 1_119_563; // 2025-26 NBA minimum (0-yr experience)

    // Players with metrics but no contract
    const metricsWithoutContracts = await prisma.playerSeasonMetric.findMany({
      where: {
        seasonId: season.id,
        player: {
          contracts: { none: { seasonId: season.id } },
        },
      },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let created = 0;
    const players: Array<{ name: string; team: string }> = [];

    for (const m of metricsWithoutContracts) {
      await prisma.contract.create({
        data: {
          seasonId: season.id,
          teamId: m.teamId,
          playerId: m.playerId,
          salary: MINIMUM_SALARY,
          yearsRemaining: 1,
          hasPlayerOption: false,
          hasTeamOption: false,
          isUFAAfterSeason: true,
          isRFAAfterSeason: false,
        },
      });
      created++;
      players.push({
        name: `${m.player.firstName} ${m.player.lastName}`,
        team: m.teamId,
      });
    }

    return NextResponse.json({
      ok: true,
      seasonYear: season.year,
      contractsCreated: created,
      salary: MINIMUM_SALARY,
      note: `Assigned $${MINIMUM_SALARY.toLocaleString()} / 1yr minimum contracts to ${created} players (two-way/G-League).`,
    });
  } catch (e) {
    console.error("Backfill minimum contracts failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
