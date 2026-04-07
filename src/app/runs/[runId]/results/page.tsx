"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, FileText, Image } from "lucide-react";

export default function ResultsPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then((d) => setRun(d.run))
      .catch(() => setRun(null))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!run) return <div className="p-8 text-white">Run not found</div>;

  const rules = run.rules ?? {};
  const salaryCap = run.salaryCap ?? 140_000_000;
  const capPct = run.expansionCapPctYear1 ?? 0.667;
  const floorPct = rules.salaryFloorPct ?? 0.9;
  const expansionCap = salaryCap * capPct;
  const salaryFloor = expansionCap * floorPct;

  const picksByTeam: Record<string, any[]> = {};
  for (const et of run.runTeams ?? []) {
    picksByTeam[et.id] = (run.draftPicks ?? [])
      .filter((p: any) => p.expansionTeamId === et.id)
      .sort((a: any, b: any) => a.pickNumber - b.pickNumber);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <h1 className="truncate text-sm font-semibold text-white sm:text-lg">{run.name}</h1>
          <div className="shrink-0 w-5 sm:w-0" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="mb-8 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Export Results</CardTitle>
            <p className="text-slate-400">
              Download your roster as text, with contracts, or as an image.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <a href={`/api/export/text?runId=${runId}`} download className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-2 border-white/20 bg-transparent text-white hover:bg-white/10 sm:w-auto">
                <FileText className="h-4 w-4" />
                Text Roster
              </Button>
            </a>
            <a href={`/api/export/text-contracts?runId=${runId}`} download className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-2 border-white/20 bg-transparent text-white hover:bg-white/10 sm:w-auto">
                <Download className="h-4 w-4" />
                Text + Contracts
              </Button>
            </a>
            <a href={`/api/export/image?runId=${runId}`} target="_blank" rel="noopener" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-2 border-white/20 bg-transparent text-white hover:bg-white/10 sm:w-auto">
                <Image className="h-4 w-4" />
                Image (PNG)
              </Button>
            </a>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {(run.runTeams ?? []).map((et: any) => {
            const picks = picksByTeam[et.id] ?? [];
            const totalSalary = picks.reduce(
              (s: number, p: any) => s + (p.salaryAtPick ?? 0),
              0
            );
            return (
              <Card key={et.id} className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">{et.name}</CardTitle>
                  <p className="text-slate-400">
                    ${(totalSalary / 1_000_000).toFixed(2)}M total · Cap: $
                    {(expansionCap / 1_000_000).toFixed(2)}M · Floor: $
                    {(salaryFloor / 1_000_000).toFixed(2)}M
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {picks.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex flex-col gap-1 rounded border border-white/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm text-white sm:text-base">
                          {p.pickNumber}. {p.playerName} ({p.position}) from{" "}
                          {p.fromTeamName}
                        </span>
                        <span className="text-sm text-slate-400">
                          ${(p.salaryAtPick / 1_000_000).toFixed(2)}M
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
