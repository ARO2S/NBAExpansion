import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const count = await prisma.season.count();
    const sportsDataIOConfigured = Boolean(process.env.SPORTSDATAIO_API_KEY);
    const ballDontLieConfigured = Boolean(process.env.BALLDONTLIE_API_KEY);
    return NextResponse.json({
      hasData: count > 0,
      sportsDataIOConfigured,
      ballDontLieConfigured,
    });
  } catch {
    return NextResponse.json({
      hasData: false,
      sportsDataIOConfigured: false,
      ballDontLieConfigured: false,
    });
  }
}
