"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, RefreshCw, Info } from "lucide-react";
import { resetProtectionListToGmKey } from "@/app/actions/protectionList";

function ScoreBreakdownTooltip({
  breakdown,
  children,
}: {
  breakdown: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  if (!breakdown) return <>{children}</>;
  const b = breakdown as {
    importance?: number;
    impact?: number;
    age_value?: number;
    age_value_raw?: number;
    age?: number;
    contract_value?: number;
    contract?: number;
    accolades?: number;
    availability?: number;
    team_ranks?: Record<string, number>;
    inputs?: Record<string, unknown>;
    flags?: string[];
  };
  const imp = b.importance ?? b.impact;
  const ageVal = b.age_value ?? b.age;
  const ageRaw = b.age_value_raw;
  const ageAdjusted = ageRaw != null && ageVal != null && Math.abs(ageRaw - ageVal) > 0.1;
  const contract = b.contract_value ?? b.contract;
  const acc = b.accolades ?? b.availability;
  const text = [
    imp != null && `Importance: ${Number(imp).toFixed(1)}`,
    ageVal != null && (ageAdjusted
      ? `Age: ${Number(ageVal).toFixed(1)} (raw ${Number(ageRaw).toFixed(1)})`
      : `Age: ${Number(ageVal).toFixed(1)}`),
    contract != null && `Contract: ${Number(contract).toFixed(1)}`,
    acc != null && `Accolades: ${Number(acc).toFixed(1)}`,
    b.flags?.length ? `Flags: ${b.flags.join(", ")}` : null,
    b.team_ranks
      ? `Ranks: PTS #${b.team_ranks.pts_rank} (${((b.team_ranks.pts_pct ?? 0) * 100).toFixed(0)}%), AST #${b.team_ranks.ast_rank}, REB #${b.team_ranks.reb_rank}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="ml-1 cursor-help opacity-60 hover:opacity-100">
        <Info className="h-3.5 w-3.5" title={text.replace(/\n/g, " | ")} />
      </span>
      <span
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-w-xs rounded bg-slate-800 px-2 py-1.5 text-xs text-white shadow-lg group-hover:block"
        style={{ whiteSpace: "pre-line" }}
      >
        {text}
      </span>
    </span>
  );
}

export default function ProtectPage() {
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

  async function toggleProtection(
    itemOrPl: { id: string | null; playerId: string },
    pl: { id: string | null; teamId: string },
    isProtected: boolean
  ) {
    const body =
      itemOrPl.id != null
        ? { itemId: itemOrPl.id, isProtected }
        : { teamId: pl.teamId, playerId: itemOrPl.playerId, isProtected };
    const res = await fetch(`/api/runs/${runId}/protect`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to toggle");
      return;
    }
    const refetch = await fetch(`/api/runs/${runId}`);
    const data = await refetch.json();
    if (data.run) setRun(data.run);
  }

  async function lockList(pl: { id: string | null; teamId: string }) {
    const body =
      pl.id != null ? { protectionListId: pl.id } : { teamId: pl.teamId };
    const res = await fetch(`/api/runs/${runId}/protect/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to lock");
      return;
    }
    const updated = { ...run };
    const plist = updated.protectionLists.find(
      (p: any) => p.teamId === pl.teamId
    );
    if (plist) plist.lockedAt = new Date().toISOString();
    setRun(updated);
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
          <Card className="mb-6 border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Loading Protection Lists…</CardTitle>
              <p className="text-slate-400">
                Fetching team rosters and protection data. This may take a moment.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded border border-white/10 bg-white/5"
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

  const allLocked = run.protectionLists?.every((p: any) => p.lockedAt) ?? false;
  const totalItems = run.protectionLists?.reduce((n: number, p: any) => n + (p.items?.length ?? 0), 0) ?? 0;

  async function regenerateTeam(teamId: string) {
    const result = await resetProtectionListToGmKey(runId, teamId);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    const res = await fetch(`/api/runs/${runId}`);
    const data = await res.json();
    if (data.run) setRun(data.run);
  }

  async function regenerateAll() {
    if (!run?.protectionLists?.length) return;
    for (const pl of run.protectionLists) {
      if (pl.lockedAt || pl.id == null) continue;
      const result = await resetProtectionListToGmKey(runId, pl.teamId);
      if ("error" in result) alert(`${pl.teamAbbrev}: ${result.error}`);
    }
    const res = await fetch(`/api/runs/${runId}`);
    const data = await res.json();
    if (data.run) setRun(data.run);
  }

  async function lockAll() {
    for (const pl of run.protectionLists ?? []) {
      if (!pl.lockedAt) {
        const body =
          pl.id != null ? { protectionListId: pl.id } : { teamId: pl.teamId };
        await fetch(`/api/runs/${runId}/protect/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    }
    const updated = { ...run };
    for (const pl of updated.protectionLists ?? []) {
      pl.lockedAt = pl.lockedAt ?? new Date().toISOString();
    }
    setRun(updated);
  }

  return (
    <div className="min-h-screen bg-slate-900">
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
        <Card className="mb-4 border-white/10 bg-white/5 sm:mb-6">
          <CardHeader>
            <CardTitle className="text-white">Protection Lists</CardTitle>
            <p className="text-slate-400">
              Protections come from the GM Key (base protections). Toggle any
              player if you disagree. Lock each team when done. When all locked,
              proceed to the draft.
            </p>
            {run.rules && (
              <div className="mt-3 rounded border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                <span className="font-medium text-white">Rules: </span>
                {(run.rules as any).protectLimitPerTeam ?? (run.rules as any).protect_limit_per_team ?? 8} protect per team
                · max {(run.rules as any).expansionDraftMaxPicks ?? 27} picks
                · each team can lose {(run.rules as any).eachExistingTeamCanLoseMax ?? 1} player
              </div>
            )}
            {totalItems === 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                <p className="font-medium">No protection data.</p>
                <p className="mt-2 text-sm">
                  Go to <Link href="/admin" className="underline">Admin</Link> and click <strong>Generate GM Key</strong> once. 
                  That creates the base protection list—all draft runs use it. Refresh this page after generating.
                </p>
              </div>
            )}
          </CardHeader>
        </Card>

        <Tabs defaultValue={run.protectionLists?.[0]?.teamId ?? run.protectionLists?.[0]?.teamAbbrev ?? "BOS"}>
          <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-white/5 p-1.5">
            {run.protectionLists?.map((pl: any) => (
              <TabsTrigger
                key={pl.teamId}
                value={pl.teamId}
                className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm data-[state=active]:bg-amber-500/20"
              >
                {pl.teamAbbrev}
                {pl.lockedAt && <Lock className="ml-1 h-3 w-3" />}
              </TabsTrigger>
            ))}
          </TabsList>

          {run.protectionLists?.map((pl: any) => (
            <TabsContent key={pl.teamId} value={pl.teamId}>
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-white">{pl.teamName}</CardTitle>
                    <p className="text-sm text-slate-400">
                      {pl.items.filter((i: any) => i.isProtected).length} protected
                      (max ~{run.rules?.protectLimitPerTeam ?? run.rules?.protect_limit_per_team ?? 8})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!pl.lockedAt && (
                      <>
                        {pl.id != null && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regenerateTeam(pl.teamId)}
                            className="border-white/20 bg-transparent text-white hover:bg-white/10"
                          >
                            <RefreshCw className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline">Reset to GM Key</span>
                            <span className="sm:hidden">Reset</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => lockList(pl)}
                          className="border-white/20 bg-transparent text-white hover:bg-white/10"
                        >
                          <Lock className="mr-1 h-4 w-4" />
                          Lock
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pl.items
                      .sort((a: any, b: any) => (b.protectScore ?? 0) - (a.protectScore ?? 0))
                      .map((item: any) => (
                        <div
                          key={item.playerId}
                          className="flex flex-col gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-white">
                              {item.playerName}
                            </span>
                            <span className="ml-2 text-slate-400">
                              {item.position}
                            </span>
                            {item.protectScore != null && (
                              <ScoreBreakdownTooltip
                                breakdown={item.scoreBreakdown ?? null}
                              >
                                <span className="ml-2 text-xs text-slate-500">
                                  score: {Number(item.protectScore).toFixed(2)}
                                </span>
                              </ScoreBreakdownTooltip>
                            )}
                          </div>
                          <div className="shrink-0">
                            {pl.lockedAt ? (
                              <Badge
                                variant={item.isProtected ? "default" : "secondary"}
                              >
                                {item.isProtected ? "Protected" : "Exposed"}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant={item.isProtected ? "default" : "outline"}
                                onClick={() =>
                                  toggleProtection(item, pl, !item.isProtected)
                                }
                              >
                                {item.isProtected ? "Protected" : "Exposed"}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-4">
          {!allLocked && (
            <>
              {run.protectionLists?.some((p: any) => p.id != null) && (
                <Button
                  variant="outline"
                  onClick={regenerateAll}
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Reset All to GM Key
                </Button>
              )}
              <Button
                variant="outline"
                onClick={lockAll}
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                Lock All Teams
              </Button>
            </>
          )}
          <Button
            disabled={!allLocked}
            onClick={async () => {
              if (!allLocked) return;
              await fetch(`/api/runs/${runId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "drafting" }),
              });
              router.push(`/runs/${runId}/draft`);
            }}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {allLocked ? "Continue to Draft" : "Lock all teams to continue"}
          </Button>
        </div>
      </main>
    </div>
  );
}
