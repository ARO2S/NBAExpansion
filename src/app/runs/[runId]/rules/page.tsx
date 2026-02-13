"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function RulesPage() {
  const params = useParams();
  const router = useRouter();
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

  async function advanceToProtect() {
    await fetch(`/api/runs/${runId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "protecting" }),
    });
    router.push(`/runs/${runId}/protect`);
  }

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!run) return <div className="p-8 text-white">Run not found</div>;

  const rules = run.rules ?? {};

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white">{run.name}</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Rules Snapshot</CardTitle>
            <p className="text-slate-400">
              These rules are locked for this run. Review before moving to
              protection lists.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Protect per team:</span>{" "}
                {rules.protectLimitPerTeam}
              </div>
              <div>
                <span className="text-slate-400">Max lose per team:</span>{" "}
                {rules.eachExistingTeamCanLoseMax}
              </div>
              <div>
                <span className="text-slate-400">Min picks:</span>{" "}
                {rules.expansionDraftMinPicks}
              </div>
              <div>
                <span className="text-slate-400">Max picks:</span>{" "}
                {rules.expansionDraftMaxPicks}
              </div>
              <div>
                <span className="text-slate-400">Expansion cap Y1:</span>{" "}
                {((rules.expansionCapPctYear1 ?? 0.667) * 100).toFixed(0)}%
              </div>
              <div>
                <span className="text-slate-400">Salary floor:</span>{" "}
                {((rules.salaryFloorPct ?? 0.9) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Link href={`/runs/${runId}/protect`}>
                <Button variant="outline" className="border-white/20 text-white">
                  Skip to Protection
                </Button>
              </Link>
              <Button
                onClick={advanceToProtect}
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                Continue to Protection Lists
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
