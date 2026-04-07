import { NextRequest, NextResponse } from "next/server";
import { syncSpotracToDb } from "@/lib/spotrac";
import { requireAdmin } from "@/lib/admin";

const SEASON_YEAR = 2025; // 2025-26 season

/**
 * POST /api/admin/sync-spotrac
 * Scrapes Basketball-Reference.com NBA contracts and updates Contract.salary / yearsRemaining
 * for 2025-26. Match is by player name.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const result = await syncSpotracToDb(SEASON_YEAR);
    return NextResponse.json({
      ok: true,
      provider: "basketball-reference",
      ...result,
    });
  } catch (e) {
    console.error("Contracts sync failed:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Contracts sync failed",
      },
      { status: 500 }
    );
  }
}
