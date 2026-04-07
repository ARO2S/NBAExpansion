import { NextRequest, NextResponse } from "next/server";
import { parseBBRStatsCsv, applyMetricsRowsToDb } from "@/lib/metrics-csv";
import { requireAdmin } from "@/lib/admin";

const SEASON_YEAR = 2025; // 2025-26 season

/**
 * POST /api/admin/metrics-upload
 * Body: { csvText: string }
 * Parses BBR stats CSV (Rk,Player,Age,Team,Pos,G,GS,MP,...,PTS) and upserts PlayerSeasonMetric for 2025-26.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  let body: { csvText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body with csvText required" }, { status: 400 });
  }

  const csvText = typeof body.csvText === "string" ? body.csvText.trim() : "";
  if (!csvText) {
    return NextResponse.json(
      { error: "csvText required (paste CSV with Rk,Player,Team,Pos,G,GS,MP,...,TRB,AST,...,PTS)" },
      { status: 400 }
    );
  }

  try {
    const rows = parseBBRStatsCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No rows parsed. Ensure CSV has header: Rk,Player,Age,Team,Pos,G,GS,MP,...,TRB,AST,...,PTS",
        rowsParsed: 0,
      });
    }
    const result = await applyMetricsRowsToDb(SEASON_YEAR, rows);
    return NextResponse.json({
      ok: true,
      provider: "csv",
      ...result,
    });
  } catch (e) {
    console.error("Metrics upload failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
