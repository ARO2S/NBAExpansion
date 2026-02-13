import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST() {
  try {
    const projectRoot = process.cwd();
    execSync("npx tsx prisma/seed.ts", {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Seed failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
