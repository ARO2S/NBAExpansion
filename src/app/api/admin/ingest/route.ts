import { NextRequest, NextResponse } from "next/server";
import { ingestData } from "@/lib/admin-ingest/upsert";
import { ingestPayloadSchema } from "@/lib/admin-ingest/schema";

/**
 * POST /api/admin/ingest
 * Body: JSON with season_year, teams?, players?, contracts?, metrics?, accolades?
 * Validates with Zod and upserts by provider_player_id or (first_name, last_name, birthdate).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON body required" },
      { status: 400 }
    );
  }

  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await ingestData(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("Ingest failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
