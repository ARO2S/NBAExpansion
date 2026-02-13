import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
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
