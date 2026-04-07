import { NextRequest, NextResponse } from "next/server";
import { ballDontLieAdapter } from "@/lib/providers/balldontlie";
import { syncFromProvider } from "@/lib/providers/sync-to-db";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!process.env.BALLDONTLIE_API_KEY) {
    return NextResponse.json(
      { error: "BALLDONTLIE_API_KEY is not configured in env" },
      { status: 400 }
    );
  }

  const seasonYear = 2025; // 2025-26 season

  try {
    const result = await syncFromProvider(ballDontLieAdapter, Number(seasonYear));
    return NextResponse.json({
      ok: true,
      provider: "balldontlie",
      seasonYear,
      ...result,
    });
  } catch (e) {
    console.error("BallDontLie sync failed:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
