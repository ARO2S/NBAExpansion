import { NextRequest, NextResponse } from "next/server";
import { sportsDataIOAdapter } from "@/lib/providers/sportsdataio";
import { syncFromProvider } from "@/lib/providers/sync-to-db";

const SEASON_YEAR = 2025; // 2025-26 season

export async function POST(req: NextRequest) {
  if (!process.env.SPORTSDATAIO_API_KEY) {
    return NextResponse.json(
      { error: "SPORTSDATAIO_API_KEY is not configured in env" },
      { status: 400 }
    );
  }

  try {
    const result = await syncFromProvider(sportsDataIOAdapter, SEASON_YEAR);
    return NextResponse.json({
      ok: true,
      seasonYear: SEASON_YEAR,
      ...result,
    });
  } catch (e) {
    console.error("SportsDataIO sync failed:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
