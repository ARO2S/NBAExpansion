import { NextResponse } from "next/server";
import { generateCanonicalProtectionLists } from "@/app/actions/protectionList";
import { requireAdmin } from "@/lib/admin";

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const result = await generateCanonicalProtectionLists();
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to generate GM Key" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      teamsUpdated: result.teamsUpdated,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate GM Key" },
      { status: 500 }
    );
  }
}
