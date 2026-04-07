import { NextRequest, NextResponse } from "next/server";
import {
  applyContractRowsToDb,
  parseBBRContractCsv,
} from "@/lib/spotrac";
import { requireAdmin } from "@/lib/admin";

const SEASON_YEAR = 2025; // 2025-26 season

/**
 * POST /api/admin/contracts-upload
 * Body: { csvText: string }
 * Parses Basketball-Reference contract CSV and updates Contract.salary / yearsRemaining for 2025-26.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  let body: { csvText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON body with csvText required" },
      { status: 400 }
    );
  }

  const csvText = typeof body.csvText === "string" ? body.csvText.trim() : "";
  if (!csvText) {
    return NextResponse.json(
      { error: "csvText is required (paste CSV from Basketball-Reference export)" },
      { status: 400 }
    );
  }

  try {
    const rows = parseBBRContractCsv(csvText, SEASON_YEAR);
    if (rows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No rows parsed. CSV needs header row with Rk,Player,Tm and a salary column (e.g. 2025-26).",
        rowsParsed: 0,
      });
    }
    const result = await applyContractRowsToDb(SEASON_YEAR, rows);
    return NextResponse.json({
      ok: true,
      provider: "csv",
      rowsParsed: rows.length,
      ...result,
    });
  } catch (e) {
    console.error("Contracts upload failed:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
