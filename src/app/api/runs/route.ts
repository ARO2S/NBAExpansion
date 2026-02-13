import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RULES_PRESETS } from "@/lib/rules-schema";

export async function GET() {
  try {
    const runs = await prisma.draftRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { season: true },
    });
    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ runs: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      ruleset = "1995-style",
      expansionTeamsCount = 1,
      expansionTeamNames = ["Seattle SuperSonics"],
    } = body;

    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json(
        { error: "No season found. Run db:seed first." },
        { status: 400 }
      );
    }

    const rules = RULES_PRESETS[ruleset] ?? RULES_PRESETS["1995-style"];

    const run = await prisma.draftRun.create({
      data: {
        seasonId: season.id,
        name: name ?? "My Expansion Draft",
        rulesSnapshotJson: rules as object,
        status: "protecting",
      },
    });

    const abbrevs = ["SEA", "LV"];
    const names = expansionTeamNames.slice(0, expansionTeamsCount);
    for (let i = 0; i < names.length; i++) {
      await prisma.runTeam.create({
        data: {
          runId: run.id,
          name: names[i],
          abbrev: abbrevs[i] ?? `E${i + 1}`,
          userControls: true,
        },
      });
    }

    return NextResponse.json({ runId: run.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create run" },
      { status: 500 }
    );
  }
}
