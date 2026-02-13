import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: {
      season: true,
      runTeams: true,
      draftPicks: {
        include: {
          player: true,
          fromTeam: true,
          expansionRunTeam: true,
        },
      },
    },
  });

  if (!run) notFound();

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

  const POSITION_ORDER = ["PG", "SG", "SF", "PF", "C"];

  return (
    <div
      className="bg-slate-900 text-white p-8 min-h-screen"
      style={{ width: 1200, minHeight: 630 }}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-amber-400">
          NBA Expansion Draft
        </h1>
        <h2 className="text-xl mt-2">{run.name}</h2>
        <p className="text-slate-400 text-sm mt-1">
          {run.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {run.runTeams.map((et) => {
          const picks = picksByTeam.get(et.id) ?? [];
          const sorted = [...picks].sort((a, b) => {
            const ai = POSITION_ORDER.indexOf(a.player.primaryPosition);
            const bi = POSITION_ORDER.indexOf(b.player.primaryPosition);
            const aIdx = ai === -1 ? 99 : ai;
            const bIdx = bi === -1 ? 99 : bi;
            if (aIdx !== bIdx) return aIdx - bIdx;
            return a.pickNumber - b.pickNumber;
          });
          const totalSalary = picks.reduce(
            (s, p) => s + Number(p.salaryAtPick),
            0
          );
          return (
            <div key={et.id} className="border border-amber-500/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-400 mb-2">
                {et.name}
              </h3>
              <div className="text-sm space-y-1">
                {sorted.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>
                      {p.pickNumber}. {p.player.firstName} {p.player.lastName}{" "}
                      ({p.player.primaryPosition})
                    </span>
                    <span className="text-slate-400">
                      {p.fromTeam.name} · $
                      {(Number(p.salaryAtPick) / 1_000_000).toFixed(1)}M
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-2 border-t border-white/10 text-sm text-slate-400">
                Total: ${(totalSalary / 1_000_000).toFixed(2)}M · Cap: $
                {(expansionCap / 1_000_000).toFixed(2)}M · Floor: $
                {(salaryFloor / 1_000_000).toFixed(2)}M
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
