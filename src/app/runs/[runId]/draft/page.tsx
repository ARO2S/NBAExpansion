"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, UserPlus } from "lucide-react";

export default function DraftPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<any>(null);
  const [pool, setPool] = useState<any[]>([]);
  const [teamsThatLost, setTeamsThatLost] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedExpansionTeam, setSelectedExpansionTeam] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function loadRun() {
    const r = await fetch(`/api/runs/${runId}`).then((x) => x.json());
    setRun(r.run);
    if (r.run?.runTeams?.[0]) {
      setSelectedExpansionTeam(r.run.runTeams[0].id);
    }
  }

  async function loadPool() {
    const p = await fetch(`/api/runs/${runId}/draft-pool`).then((x) => x.json());
    setPool(p.pool ?? []);
    setTeamsThatLost(p.teamsThatLost ?? []);
  }

  useEffect(() => {
    Promise.all([loadRun(), loadPool()]).finally(() => setLoading(false));
  }, [runId]);

  async function makePick(playerId: string, fromTeamId: string) {
    if (!selectedExpansionTeam) {
      setError("Select an expansion team first");
      return;
    }
    setPicking(playerId);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          fromTeamId,
          expansionRunTeamId: selectedExpansionTeam,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pick failed");
      await Promise.all([loadRun(), loadPool()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pick failed");
    } finally {
      setPicking(null);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="border-b border-white/10 bg-black/20">
          <div className="container mx-auto flex h-16 items-center px-4">
            <Link href="/" className="flex items-center gap-2 text-white">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Link>
            <h1 className="ml-4 text-lg font-semibold text-white">Loading Draft…</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Preparing Draft Board…</CardTitle>
              <p className="text-slate-400">
                Building the available player pool from all 30 teams. This may take a moment.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded border border-white/10 bg-white/5"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  if (!run)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <p className="text-white">Run not found</p>
      </div>
    );

  const rules = run.rules ?? {};
  const salaryCap = run.salaryCap ?? 140_000_000;
  const capPct = run.expansionCapPctYear1 ?? 0.667;
  const floorPct = rules.salaryFloorPct ?? 0.9;
  const expansionCap = salaryCap * capPct;
  const salaryFloor = expansionCap * floorPct;

  const filtered = pool.filter((p: any) => {
    if (filterTeam !== "all" && p.teamId !== filterTeam) return false;
    if (filterPosition !== "all" && p.position !== filterPosition) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.playerName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const teams = run.protectionLists?.map((pl: any) => ({
    id: pl.teamId,
    name: pl.teamName,
    abbrev: pl.teamAbbrev,
  })) ?? [];
  const expansionTeams = run.runTeams ?? [];
  const capByExpansion: Record<string, number> = {};
  for (const et of expansionTeams) {
    const picks = run.draftPicks?.filter(
      (p: any) => p.expansionTeamId === et.id
    ) ?? [];
    capByExpansion[et.id] = picks.reduce((s: number, p: any) => s + (p.salaryAtPick ?? 0), 0);
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white">{run.name}</h1>
          <Link href={`/runs/${runId}/results`}>
            <Button variant="outline" size="sm" className="border-white/20 text-white">
              Results
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Available Pool</CardTitle>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Input
                    placeholder="Search player..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs bg-white/5 border-white/10 text-white"
                  />
                  <Select
                    value={filterTeam}
                    onValueChange={setFilterTeam}
                  >
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teams</SelectItem>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.abbrev}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterPosition}
                    onValueChange={setFilterPosition}
                  >
                    <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="PG">PG</SelectItem>
                      <SelectItem value="SG">SG</SelectItem>
                      <SelectItem value="SF">SF</SelectItem>
                      <SelectItem value="PF">PF</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <p className="mb-4 text-sm text-red-400">{error}</p>
                )}
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-slate-400">No players in pool</p>
                  ) : (
                    filtered.map((p: any) => (
                      <div
                        key={`${p.playerId}-${p.teamId}`}
                        className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium text-white">
                            {p.playerName}
                          </span>
                          <span className="ml-2 text-slate-400">
                            {p.position}
                          </span>
                          <span className="ml-2 text-slate-500 text-sm">
                            ${(p.salary / 1_000_000).toFixed(1)}M · {p.yearsRemaining}y
                          </span>
                          {p.rating != null && (
                            <Badge variant="secondary" className="ml-2">
                              {p.rating}
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => makePick(p.playerId, p.teamId)}
                          disabled={
                            picking !== null ||
                            teamsThatLost.includes(p.teamId)
                          }
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          <UserPlus className="mr-1 h-4 w-4" />
                          Draft
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Draft For</CardTitle>
                <Select
                  value={selectedExpansionTeam}
                  onValueChange={setSelectedExpansionTeam}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expansionTeams.map((et: any) => (
                      <SelectItem key={et.id} value={et.id}>
                        {et.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Cap Sheet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {expansionTeams.map((et: any) => {
                  const total = capByExpansion[et.id] ?? 0;
                  const overCap = total > expansionCap;
                  const underFloor = total < salaryFloor;
                  const picks = run.draftPicks?.filter(
                    (p: any) => p.expansionTeamId === et.id
                  ) ?? [];
                  return (
                    <div key={et.id} className="rounded border border-white/10 p-3">
                      <div className="font-medium text-white">{et.name}</div>
                      <div className="text-sm text-slate-400">
                        Salary: ${(total / 1_000_000).toFixed(2)}M
                      </div>
                      <div className="text-xs">
                        <span className={overCap ? "text-red-400" : "text-slate-500"}>
                          Cap: ${(expansionCap / 1_000_000).toFixed(2)}M
                        </span>
                        {" · "}
                        <span className={underFloor ? "text-amber-400" : "text-slate-500"}>
                          Floor: ${(salaryFloor / 1_000_000).toFixed(2)}M
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {picks.length} picks
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
