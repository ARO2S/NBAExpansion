"use client";

import { useEffect, useState, useMemo } from "react";
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
import { ArrowLeft, UserPlus, Check } from "lucide-react";

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
    if (r.run?.runTeams?.[0] && !selectedExpansionTeam) {
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

      // Optimistic update: add the pick to local state immediately
      if (data.pick) {
        setRun((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status ?? prev.status,
            draftPicks: [...(prev.draftPicks ?? []), data.pick],
          };
        });
      }

      // Optimistic update: remove drafted team from pool and mark team as having lost
      setPool((prev) => prev.filter((p) => p.teamId !== fromTeamId));
      setTeamsThatLost((prev) => [...prev, fromTeamId]);

      // Background refresh for consistency (non-blocking)
      loadPool().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pick failed");
      // On error, refresh to get correct state
      await Promise.all([loadRun(), loadPool()]);
    } finally {
      setPicking(null);
    }
  }

  if (loading)
    return (
      <div>
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
      <div className="flex min-h-screen items-center justify-center">
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

  const draftPicks = run.draftPicks ?? [];
  const rosterByTeam: Record<string, any[]> = {};
  const capByExpansion: Record<string, number> = {};
  for (const et of expansionTeams) {
    const picks = draftPicks.filter((p: any) => p.expansionTeamId === et.id);
    rosterByTeam[et.id] = picks;
    capByExpansion[et.id] = picks.reduce((s: number, p: any) => s + (p.salaryAtPick ?? 0), 0);
  }

  const currentRoster = rosterByTeam[selectedExpansionTeam] ?? [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <h1 className="truncate text-sm font-semibold text-white sm:text-lg">{run.name}</h1>
          <Link href={`/runs/${runId}/results`} className="shrink-0">
            <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Results
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Available Pool</CardTitle>
                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                  <Input
                    placeholder="Search player..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/5 border-white/10 text-white sm:max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={filterTeam}
                      onValueChange={setFilterTeam}
                    >
                      <SelectTrigger className="w-full bg-white/5 border-white/10 text-white sm:w-[140px]">
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
                      <SelectTrigger className="w-full bg-white/5 border-white/10 text-white sm:w-[120px]">
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
                        className="flex flex-col gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-white">
                            {p.playerName}
                          </span>
                          <span className="ml-2 text-slate-400">
                            {p.position}
                          </span>
                          <span className="ml-2 text-sm text-slate-500">
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
                          className="shrink-0 self-end bg-orange-500 hover:bg-orange-400 sm:self-auto"
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
              <CardHeader className="pb-2">
                <CardTitle className="text-white">
                  Your Roster
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {currentRoster.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentRoster.length === 0 ? (
                  <p className="text-sm text-slate-500">No players drafted yet</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
                    {currentRoster
                      .sort((a: any, b: any) => a.pickNumber - b.pickNumber)
                      .map((pick: any) => (
                        <div
                          key={pick.id ?? pick.playerId}
                          className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-slate-500 w-5 shrink-0">
                              {pick.pickNumber}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-white text-sm truncate">
                                {pick.playerName}
                              </span>
                              <span className="ml-1.5 text-xs text-slate-400">
                                {pick.position}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs text-slate-400">
                              ${(pick.salaryAtPick / 1_000_000).toFixed(1)}M
                            </span>
                            <div className="text-[10px] text-slate-600">
                              {pick.fromTeamName}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Cap Sheet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {expansionTeams.map((et: any) => {
                  const total = capByExpansion[et.id] ?? 0;
                  const overCap = total > expansionCap;
                  const underFloor = total < salaryFloor;
                  const picks = rosterByTeam[et.id] ?? [];
                  return (
                    <div key={et.id} className="rounded border border-white/10 p-3">
                      <div className="font-medium text-white text-sm">{et.name}</div>
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
