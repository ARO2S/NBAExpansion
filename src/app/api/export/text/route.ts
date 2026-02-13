import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatTextExport } from "@/lib/export-format";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  try {
    const run = await prisma.draftRun.findUnique({
      where: { id: runId },
      include: {
        season: true,
        runTeams: true,
        draftPicks: {
          include: { player: true, fromTeam: true, expansionRunTeam: true },
        },
      },
    });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const rules = run.rulesSnapshotJson as any;
    const salaryCap = Number(run.season.salaryCap);
    const capPct = Number(run.season.expansionCapPctYear1 ?? 0.667);
    const floorPct = Number(rules?.salaryFloorPct ?? 0.9);
    const expansionCap = salaryCap * capPct;
    const salaryFloor = expansionCap * floorPct;

    const picksByTeam = new Map<string, typeof run.draftPicks>();
    for (const et of run.runTeams) {
      picksByTeam.set(
        et.id,
        run.draftPicks
          .filter((p) => p.expansionRunTeamId === et.id)
          .sort((a, b) => a.pickNumber - b.pickNumber)
      );
    }

    const textExports: string[] = [];
    for (const et of run.runTeams) {
      const picks = picksByTeam.get(et.id) ?? [];
      const totalSalary = picks.reduce(
        (s, p) => s + Number(p.salaryAtPick),
        0
      );
      const ctx = {
        runName: run.name,
        runDate: run.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        picks: picks.map((p) => ({
          pickNumber: p.pickNumber,
          playerName: `${p.player.firstName} ${p.player.lastName}`,
          position: p.player.primaryPosition,
          age: Math.floor(
            (run.createdAt.getTime() -
              new Date(p.player.birthdate).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
          ),
          rating: undefined as number | undefined,
          fromTeam: p.fromTeam.name,
        })),
        expansionTeamName: et.name,
        totalSalary,
        expansionCap,
        salaryFloor,
        rules,
      };
      textExports.push(formatTextExport(ctx));
    }

    const body = textExports.join("\n\n---\n\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${run.name.replace(/[^a-z0-9]/gi, "_")}-roster.txt"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
