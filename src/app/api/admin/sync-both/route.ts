import { NextRequest, NextResponse } from "next/server";
import { ballDontLieAdapter } from "@/lib/providers/balldontlie";
import { sportsDataIOAdapter } from "@/lib/providers/sportsdataio";
import { syncFromProvider } from "@/lib/providers/sync-to-db";
import { requireAdmin } from "@/lib/admin";

const SEASON_YEAR = 2025; // 2025-26 season

/**
 * Syncs 2025-26 player data from both SportsDataIO and Ball Don't Lie.
 * Runs SportsDataIO first, then Ball Don't Lie.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const hasSportsDataIO = Boolean(process.env.SPORTSDATAIO_API_KEY);
  const hasBallDontLie = Boolean(process.env.BALLDONTLIE_API_KEY);

  if (!hasSportsDataIO && !hasBallDontLie) {
    return NextResponse.json(
      {
        error:
          "Configure at least one provider: SPORTSDATAIO_API_KEY or BALLDONTLIE_API_KEY in .env",
      },
      { status: 400 }
    );
  }

  const results: {
    provider: string;
    teams: number;
    players: number;
    contracts: number;
    metrics: number;
    error?: string;
  }[] = [];

  if (hasSportsDataIO) {
    try {
      const result = await syncFromProvider(
        sportsDataIOAdapter,
        SEASON_YEAR
      );
      results.push({
        provider: "sportsdataio",
        ...result,
      });
    } catch (e) {
      console.error("SportsDataIO sync failed:", e);
      results.push({
        provider: "sportsdataio",
        teams: 0,
        players: 0,
        contracts: 0,
        metrics: 0,
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  if (hasBallDontLie) {
    try {
      const result = await syncFromProvider(
        ballDontLieAdapter,
        SEASON_YEAR
      );
      results.push({
        provider: "balldontlie",
        ...result,
      });
    } catch (e) {
      console.error("Ball Don't Lie sync failed:", e);
      results.push({
        provider: "balldontlie",
        teams: 0,
        players: 0,
        contracts: 0,
        metrics: 0,
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    seasonYear: SEASON_YEAR,
    results,
  });
}
