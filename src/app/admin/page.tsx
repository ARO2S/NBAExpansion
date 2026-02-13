"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Database, Key, Upload, RefreshCw } from "lucide-react";

export default function AdminPage() {
  const [seeded, setSeeded] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [gmKeyGenerating, setGmKeyGenerating] = useState(false);
  const [gmKeyResult, setGmKeyResult] = useState<{ ok: boolean; teamsUpdated?: number; error?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, number> | null>(null);
  const [sportsDataIOConfigured, setSportsDataIOConfigured] = useState<boolean | null>(null);
  const [ballDontLieConfigured, setBallDontLieConfigured] = useState<boolean | null>(null);
  const [contractsCsv, setContractsCsv] = useState("");
  const [contractsUploading, setContractsUploading] = useState(false);
  const [contractsResult, setContractsResult] = useState<{ ok: boolean; error?: string; matched?: number; updated?: number; contractsCreated?: number; rowsParsed?: number } | null>(null);
  const [metricsCsv, setMetricsCsv] = useState("");
  const [metricsUploading, setMetricsUploading] = useState(false);
  const [metricsResult, setMetricsResult] = useState<{ ok: boolean; error?: string; matched?: number; created?: number; updated?: number; playersCreated?: number; rowsParsed?: number; skipped?: number; skippedSample?: string[] } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any | null>(null);
  const [resolving, setResolving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resolveResult, setResolveResult] = useState<any | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ ok: boolean; contractsCreated?: number; note?: string } | null>(null);
  const [backfillingMetrics, setBackfillingMetrics] = useState(false);
  const [backfillMetricsResult, setBackfillMetricsResult] = useState<{ ok: boolean; metricsCreated?: number; note?: string; players?: Array<{ name: string; teamAbbrev: string }> } | null>(null);
  const [addPlayerName, setAddPlayerName] = useState("");
  const [addPlayerTeam, setAddPlayerTeam] = useState("");
  const [addPlayerPos, setAddPlayerPos] = useState("SF");
  const [addPlayerSalary, setAddPlayerSalary] = useState("");
  const [addPlayerYears, setAddPlayerYears] = useState("1");
  const [addPlayerAge, setAddPlayerAge] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerResult, setAddPlayerResult] = useState<{ ok: boolean; action?: string; playerName?: string; error?: string } | null>(null);
  const [movePlayerName, setMovePlayerName] = useState("");
  const [movePlayerTeam, setMovePlayerTeam] = useState("");
  const [movingPlayer, setMovingPlayer] = useState(false);
  const [movePlayerResult, setMovePlayerResult] = useState<{ ok: boolean; playerName?: string; newTeam?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => {
        setSeeded(d.hasData ?? false);
        setSportsDataIOConfigured(d.sportsDataIOConfigured ?? false);
        setBallDontLieConfigured(d.ballDontLieConfigured ?? false);
      })
      .catch(() => {
        setSeeded(false);
        setSportsDataIOConfigured(false);
        setBallDontLieConfigured(false);
      });
  }, []);

  async function runSeed() {
    setSeeding(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seed failed");
      setSeeded(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  async function runContractsUpload() {
    if (!contractsCsv.trim()) {
      alert("Paste CSV content first.");
      return;
    }
    setContractsUploading(true);
    setContractsResult(null);
    try {
      const res = await fetch("/api/admin/contracts-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: contractsCsv.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setContractsResult({
        ok: true,
        matched: data.matched,
        updated: data.updated,
        contractsCreated: data.contractsCreated,
        rowsParsed: data.rowsParsed,
      });
      setSeeded(true);
    } catch (e) {
      setContractsResult({
        ok: false,
        error: e instanceof Error ? e.message : "Upload failed",
      });
    } finally {
      setContractsUploading(false);
    }
  }

  async function runMetricsUpload() {
    if (!metricsCsv.trim()) {
      alert("Paste CSV content first.");
      return;
    }
    setMetricsUploading(true);
    setMetricsResult(null);
    try {
      const res = await fetch("/api/admin/metrics-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: metricsCsv.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMetricsResult({
        ok: true,
        matched: data.matched,
        created: data.created,
        updated: data.updated,
        playersCreated: data.playersCreated,
        rowsParsed: data.rowsParsed,
        skipped: data.skipped,
        skippedSample: data.skippedSample,
      });
      setSeeded(true);
    } catch (e) {
      setMetricsResult({
        ok: false,
        error: e instanceof Error ? e.message : "Upload failed",
      });
    } finally {
      setMetricsUploading(false);
    }
  }

  async function runProviderSync(provider: "sportsdataio" | "balldontlie") {
    const endpoint =
      provider === "sportsdataio" ? "/api/admin/sync-sportsdataio" : "/api/admin/sync-balldontlie";
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncResult({
        teams: data.teams ?? 0,
        players: data.players ?? 0,
        contracts: data.contracts ?? 0,
        metrics: data.metrics ?? 0,
      });
      setSeeded(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function runGenerateGmKey() {
    setGmKeyGenerating(true);
    setGmKeyResult(null);
    try {
      const res = await fetch("/api/admin/generate-gm-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generate failed");
      setGmKeyResult({ ok: true, teamsUpdated: data.teamsUpdated });
    } catch (e) {
      setGmKeyResult({ ok: false, error: e instanceof Error ? e.message : "Generate failed" });
    } finally {
      setGmKeyGenerating(false);
    }
  }

  async function runReset() {
    if (!confirm("This will DELETE all player data, contracts, metrics, draft runs, and protection lists. Season and teams will be kept. Continue?")) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch("/api/admin/reset-player-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setResetResult({ ok: true, message: data.message });
      setSeeded(false);
      setContractsResult(null);
      setMetricsResult(null);
      setGmKeyResult(null);
      setReportData(null);
    } catch (e) {
      setResetResult({ ok: false, error: e instanceof Error ? e.message : "Reset failed" });
    } finally {
      setResetting(false);
    }
  }

  async function runMovePlayer() {
    if (!movePlayerName.trim() || !movePlayerTeam.trim()) {
      alert("Player name and new team abbreviation are required.");
      return;
    }
    setMovingPlayer(true);
    setMovePlayerResult(null);
    try {
      const res = await fetch("/api/admin/move-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: movePlayerName.trim(),
          newTeamAbbrev: movePlayerTeam.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMovePlayerResult({ ok: true, playerName: data.playerName, newTeam: data.newTeam });
      setMovePlayerName("");
      setMovePlayerTeam("");
    } catch (e) {
      setMovePlayerResult({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setMovingPlayer(false);
    }
  }

  async function runAddPlayer() {
    if (!addPlayerName.trim() || !addPlayerTeam.trim() || !addPlayerSalary.trim()) {
      alert("Name, team, and salary are required.");
      return;
    }
    setAddingPlayer(true);
    setAddPlayerResult(null);
    try {
      const res = await fetch("/api/admin/add-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addPlayerName.trim(),
          teamAbbrev: addPlayerTeam.trim(),
          position: addPlayerPos,
          salary: parseFloat(addPlayerSalary.replace(/[^0-9.]/g, "")),
          yearsRemaining: parseInt(addPlayerYears) || 1,
          age: addPlayerAge ? parseInt(addPlayerAge) : undefined,
          gamesPlayed: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAddPlayerResult({ ok: true, action: data.action, playerName: data.playerName });
      setAddPlayerName("");
      setAddPlayerSalary("");
      setAddPlayerAge("");
    } catch (e) {
      setAddPlayerResult({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setAddingPlayer(false);
    }
  }

  async function runBackfillMinimumContracts() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/backfill-minimum-contracts", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setBackfillResult({ ok: true, contractsCreated: data.contractsCreated, note: data.note });
      if (reportData) runDataReport();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  async function runBackfillMissingMetrics() {
    setBackfillingMetrics(true);
    setBackfillMetricsResult(null);
    try {
      const res = await fetch("/api/admin/backfill-missing-metrics", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setBackfillMetricsResult({ ok: true, metricsCreated: data.metricsCreated, note: data.note, players: data.players });
      if (reportData) runDataReport();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Metrics backfill failed");
    } finally {
      setBackfillingMetrics(false);
    }
  }

  async function runResolveMultiTeam() {
    if (!confirm("This will keep only the current team for each multi-team player and delete old team entries. Contracts will be reassigned. Continue?")) return;
    setResolving(true);
    setResolveResult(null);
    try {
      const res = await fetch("/api/admin/resolve-multi-team", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Resolve failed");
      setResolveResult(data);
      // Refresh the report if it's loaded
      if (reportData) runDataReport();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setResolving(false);
    }
  }

  async function runDataReport() {
    setReportLoading(true);
    setReportData(null);
    try {
      const res = await fetch("/api/admin/data-report");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Report failed");
      setReportData(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Report failed");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="ml-4 text-lg font-semibold text-white">Admin</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-12">
        {/* ── Step 0: Reset ─────────────────────────────────────── */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5" />
              Reset Player Data
            </CardTitle>
            <p className="text-slate-400">
              Wipe all players, contracts, metrics, draft runs, and protection lists.
              Keeps the Season and recreates all 30 NBA teams. Use this before a
              fresh CSV import.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Status: {seeded === null ? "Checking..." : seeded ? "Data exists" : "No data"}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={runReset}
                disabled={resetting}
                className="bg-red-600 hover:bg-red-700"
              >
                {resetting ? "Resetting..." : "Reset Player Data"}
              </Button>
              <Button
                onClick={runSeed}
                disabled={seeding}
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                {seeding ? "Seeding..." : "Seed Demo Data"}
              </Button>
            </div>
            {resetResult && (
              <p className={`mt-3 text-sm ${resetResult.ok ? "text-green-400" : "text-red-400"}`}>
                {resetResult.ok ? resetResult.message : resetResult.error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Step 1: Metrics CSV (creates players) ────────────── */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5" />
              <span className="inline-flex items-center gap-2">
                Step 1: Stats CSV Upload
                <span className="rounded bg-blue-600/30 px-2 py-0.5 text-xs font-normal text-blue-300">creates players</span>
              </span>
            </CardTitle>
            <p className="text-slate-400">
              Paste per-game stats CSV from Basketball-Reference. This <strong className="text-white">creates Player records</strong> for
              every row, plus their season metrics. Upload this first.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="metrics-csv" className="text-white">
                CSV (header: Rk,Player,Age,Team,Pos,G,GS,MP,...,TRB,AST,...,PTS)
              </Label>
              <textarea
                id="metrics-csv"
                value={metricsCsv}
                onChange={(e) => setMetricsCsv(e.target.value)}
                placeholder="Paste CSV with Player, Team, G, GS, MP, TRB, AST, PTS..."
                rows={6}
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={runMetricsUpload}
                disabled={metricsUploading || !metricsCsv.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {metricsUploading ? "Uploading..." : "Upload Stats"}
              </Button>
            </div>
            {metricsResult && (
              <div className={`text-sm ${metricsResult.ok ? "text-green-400" : "text-red-400"}`}>
                {metricsResult.ok ? (
                  <>
                    Parsed {metricsResult.rowsParsed ?? 0} rows; matched {metricsResult.matched ?? 0} ({metricsResult.created ?? 0} metrics created, {metricsResult.updated ?? 0} updated).
                    {metricsResult.playersCreated ? ` ${metricsResult.playersCreated} new players created.` : ""}
                    {metricsResult.skipped ? ` Skipped ${metricsResult.skipped}.` : ""}
                    {metricsResult.skippedSample?.length ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Sample skipped: {metricsResult.skippedSample.slice(0, 5).join("; ")}
                      </div>
                    ) : null}
                  </>
                ) : (
                  metricsResult.error
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Step 2: Contracts CSV ────────────────────────────── */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5" />
              <span className="inline-flex items-center gap-2">
                Step 2: Contracts CSV Upload
                <span className="rounded bg-emerald-600/30 px-2 py-0.5 text-xs font-normal text-emerald-300">creates contracts</span>
              </span>
            </CardTitle>
            <p className="text-slate-400">
              Paste contract CSV from Basketball-Reference. Matches to players created in Step 1
              and <strong className="text-white">creates Contract records</strong> with salary and years remaining.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contracts-csv" className="text-white">
                CSV (header: Rk, Player, Tm, 2025-26, …)
              </Label>
              <textarea
                id="contracts-csv"
                value={contractsCsv}
                onChange={(e) => setContractsCsv(e.target.value)}
                placeholder="Paste CSV with Player, Tm, and season salary columns..."
                rows={6}
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={runContractsUpload}
                disabled={contractsUploading || !contractsCsv.trim()}
                className="mt-6 bg-emerald-600 hover:bg-emerald-700"
              >
                {contractsUploading ? "Uploading..." : "Upload Contracts"}
              </Button>
            </div>
            {contractsResult && (
              <div className={`text-sm ${contractsResult.ok ? "text-green-400" : "text-red-400"}`}>
                {contractsResult.ok
                  ? `Parsed ${contractsResult.rowsParsed ?? 0} rows; matched ${contractsResult.matched ?? 0} (${contractsResult.contractsCreated ?? 0} created, ${contractsResult.updated ?? 0} updated).`
                  : contractsResult.error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Step 3: Data Report ──────────────────────────────── */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5" />
              Step 3: Data Quality Report
            </CardTitle>
            <p className="text-slate-400">
              Check for issues after CSV imports: players on multiple teams, missing contracts,
              duplicates, roster size anomalies, and more.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                onClick={runDataReport}
                disabled={reportLoading}
                className="gap-2 bg-orange-600 hover:bg-orange-700"
              >
                <RefreshCw className={`h-4 w-4 ${reportLoading ? "animate-spin" : ""}`} />
                {reportLoading ? "Loading..." : "Run Data Report"}
              </Button>
              <Button
                onClick={runResolveMultiTeam}
                disabled={resolving}
                variant="outline"
                className="gap-2 border-orange-500/30 bg-transparent text-orange-300 hover:bg-orange-600/20"
              >
                {resolving ? "Resolving..." : "Fix Multi-Team Players"}
              </Button>
              <Button
                onClick={runBackfillMinimumContracts}
                disabled={backfilling}
                variant="outline"
                className="gap-2 border-emerald-500/30 bg-transparent text-emerald-300 hover:bg-emerald-600/20"
              >
                {backfilling ? "Backfilling..." : "Assign Min Contracts"}
              </Button>
              <Button
                onClick={runBackfillMissingMetrics}
                disabled={backfillingMetrics}
                variant="outline"
                className="gap-2 border-sky-500/30 bg-transparent text-sky-300 hover:bg-sky-600/20"
              >
                {backfillingMetrics ? "Backfilling..." : "Backfill Injured/DNP Metrics"}
              </Button>
            </div>
            {backfillResult && (
              <p className={`mt-2 text-sm ${backfillResult.ok ? "text-green-400" : "text-red-400"}`}>
                {backfillResult.note ?? `Created ${backfillResult.contractsCreated} minimum contracts.`}
              </p>
            )}
            {backfillMetricsResult && (
              <div className="mt-2">
                <p className={`text-sm ${backfillMetricsResult.ok ? "text-green-400" : "text-red-400"}`}>
                  {backfillMetricsResult.note ?? `Created ${backfillMetricsResult.metricsCreated} zero-stat metrics.`}
                </p>
                {backfillMetricsResult.players && backfillMetricsResult.players.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {backfillMetricsResult.players.map((p, i) => (
                      <p key={i} className="text-xs text-slate-400">
                        <span className="text-white">{p.name}</span>{" "}
                        <span className="text-sky-400">({p.teamAbbrev})</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {resolveResult && (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm text-green-400">
                  Resolved {resolveResult.playersResolved} multi-team player(s).
                </p>
                {resolveResult.resolved?.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {resolveResult.resolved.map((r: { playerName: string; keptTeam: string; removedTeams: string[]; contractReassigned: boolean }, i: number) => (
                      <p key={i} className="text-xs text-slate-400">
                        <span className="text-white">{r.playerName}</span> → kept {r.keptTeam}, removed {r.removedTeams.join(", ")}
                        {r.contractReassigned && <span className="text-amber-400"> (contract moved)</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {reportData && (
              <div className="mt-4 space-y-4">
                {/* Overview */}
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-medium text-white">
                    Season {reportData.seasonYear} &mdash; {reportData.overview.totalPlayers} players,{" "}
                    {reportData.overview.totalContracts} contracts, {reportData.overview.totalMetrics} metrics
                  </p>
                  <p className={`mt-1 text-sm ${reportData.overview.totalIssues === 0 ? "text-green-400" : "text-amber-400"}`}>
                    {reportData.overview.totalIssues === 0
                      ? "No issues found!"
                      : `${reportData.overview.totalIssues} issue(s) found`}
                  </p>
                </div>
                {/* Issue categories */}
                {Object.entries(reportData.issues as Record<string, { count: number; description: string; items: Array<Record<string, unknown>> }>).map(
                  ([key, section]) =>
                    section.count > 0 && (
                      <details key={key} className="rounded-lg border border-white/10 bg-white/5">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-white hover:bg-white/5">
                          <span className="ml-1">
                            {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} ({section.count})
                          </span>
                        </summary>
                        <div className="border-t border-white/10 px-3 py-2">
                          <p className="mb-2 text-xs text-slate-400">{section.description}</p>
                          <div className="max-h-60 overflow-y-auto">
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                              {JSON.stringify(section.items, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Add Missing Player (injured, etc.) ─────────────── */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Add Missing Player
            </CardTitle>
            <p className="text-slate-400">
              Manually add players who aren&apos;t in the BBR stats CSV (e.g. injured all season like
              Haliburton, Tatum). Creates the player with a contract and 0-game metrics.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="ap-name" className="text-white text-xs">Player Name *</Label>
                <input
                  id="ap-name"
                  value={addPlayerName}
                  onChange={(e) => setAddPlayerName(e.target.value)}
                  placeholder="Jayson Tatum"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="ap-team" className="text-white text-xs">Team Abbrev *</Label>
                <input
                  id="ap-team"
                  value={addPlayerTeam}
                  onChange={(e) => setAddPlayerTeam(e.target.value)}
                  placeholder="BOS"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="ap-pos" className="text-white text-xs">Position</Label>
                <select
                  id="ap-pos"
                  value={addPlayerPos}
                  onChange={(e) => setAddPlayerPos(e.target.value)}
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                >
                  <option value="PG">PG</option>
                  <option value="SG">SG</option>
                  <option value="SF">SF</option>
                  <option value="PF">PF</option>
                  <option value="C">C</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ap-salary" className="text-white text-xs">Salary *</Label>
                <input
                  id="ap-salary"
                  value={addPlayerSalary}
                  onChange={(e) => setAddPlayerSalary(e.target.value)}
                  placeholder="32600060"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="ap-years" className="text-white text-xs">Years Left</Label>
                <input
                  id="ap-years"
                  value={addPlayerYears}
                  onChange={(e) => setAddPlayerYears(e.target.value)}
                  placeholder="3"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="ap-age" className="text-white text-xs">Age</Label>
                <input
                  id="ap-age"
                  value={addPlayerAge}
                  onChange={(e) => setAddPlayerAge(e.target.value)}
                  placeholder="27"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <Button
              onClick={runAddPlayer}
              disabled={addingPlayer || !addPlayerName.trim() || !addPlayerTeam.trim() || !addPlayerSalary.trim()}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {addingPlayer ? "Adding..." : "Add Player"}
            </Button>
            {addPlayerResult && (
              <p className={`text-sm ${addPlayerResult.ok ? "text-green-400" : "text-red-400"}`}>
                {addPlayerResult.ok
                  ? `${addPlayerResult.action === "created" ? "Created" : "Updated"} ${addPlayerResult.playerName}`
                  : addPlayerResult.error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Move Player to New Team ─────────────────────────── */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardContent className="pt-6">
            <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-400" />
              Move Player (Mid-Season Trade)
            </h3>
            <p className="text-slate-400 text-xs mb-3">
              Reassign a player&apos;s metrics + contract to a new team (e.g. traded but hasn&apos;t played yet).
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label htmlFor="mp-name" className="text-white text-xs">Player Name</Label>
                <input
                  id="mp-name"
                  value={movePlayerName}
                  onChange={(e) => setMovePlayerName(e.target.value)}
                  placeholder="Trae Young"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="mp-team" className="text-white text-xs">New Team (abbrev)</Label>
                <input
                  id="mp-team"
                  value={movePlayerTeam}
                  onChange={(e) => setMovePlayerTeam(e.target.value)}
                  placeholder="WAS"
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <Button
              onClick={runMovePlayer}
              disabled={movingPlayer || !movePlayerName.trim() || !movePlayerTeam.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {movingPlayer ? "Moving..." : "Move Player"}
            </Button>
            {movePlayerResult && (
              <p className={`mt-2 text-sm ${movePlayerResult.ok ? "text-green-400" : "text-red-400"}`}>
                {movePlayerResult.ok
                  ? `Moved ${movePlayerResult.playerName} → ${movePlayerResult.newTeam}`
                  : movePlayerResult.error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Step 4: GM Key ───────────────────────────────────── */}
        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5" />
              Step 4: GM Key Protection Lists
            </CardTitle>
            <p className="text-slate-400">
              Generate the canonical protection list once. All draft runs use this as the default until regenerated. Run after loading contracts and metrics.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runGenerateGmKey}
              disabled={gmKeyGenerating}
              className="gap-2 bg-violet-600 hover:bg-violet-700"
            >
              <RefreshCw className={`h-4 w-4 ${gmKeyGenerating ? "animate-spin" : ""}`} />
              {gmKeyGenerating ? "Generating..." : "Generate GM Key"}
            </Button>
            {gmKeyResult && (
              <p className={`mt-3 text-sm ${gmKeyResult.ok ? "text-green-400" : "text-red-400"}`}>
                {gmKeyResult.ok
                  ? `Generated for ${gmKeyResult.teamsUpdated ?? 0} teams.`
                  : gmKeyResult.error}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Data Provider Sync
            </CardTitle>
            <p className="text-slate-400">
              Fetch real NBA data (teams, players, contracts, stats). Add an API key to .env.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400 mb-2">All data is for the 2025-26 season.</p>
            {sportsDataIOConfigured && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm text-slate-300 mb-2">SportsDataIO</p>
                <p className="text-xs text-slate-500 mb-2">
                  Syncs 2025-26 season data.
                </p>
                <Button
                  onClick={() => runProviderSync("sportsdataio")}
                  disabled={syncing}
                  className="gap-2 bg-amber-500 hover:bg-amber-600"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync from SportsDataIO"}
                </Button>
              </div>
            )}
            {ballDontLieConfigured && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm text-slate-300 mb-2">BallDontLie</p>
                <p className="text-xs text-slate-500 mb-2">
                  Free: teams &amp; players. GOAT tier ($39.99/mo): season averages &amp; contracts.
                </p>
                <Button
                  onClick={() => runProviderSync("balldontlie")}
                  disabled={syncing}
                  className="gap-2 bg-emerald-500 hover:bg-emerald-600"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync from BallDontLie"}
                </Button>
              </div>
            )}
            {!sportsDataIOConfigured && !ballDontLieConfigured && (
              <p className="text-sm text-slate-500">
                Add SPORTSDATAIO_API_KEY or BALLDONTLIE_API_KEY to .env. Keys are never sent to the client.
              </p>
            )}
            {syncResult && (
              <>
                <p className="text-sm text-green-400">
                  Synced: {syncResult.teams} teams, {syncResult.players} new players,{" "}
                  {syncResult.contracts} contracts, {syncResult.metrics} metrics
                </p>
                {syncResult.teams === 0 && (
                  <p className="text-sm text-amber-400">
                    No 2025-26 data returned. Use the demo seed for local dev.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
