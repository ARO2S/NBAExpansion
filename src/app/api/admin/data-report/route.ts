import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

/**
 * GET /api/admin/data-report
 *
 * Returns a comprehensive data quality report for the current season.
 * Identifies issues that need manual attention after CSV imports:
 *
 * - Players on multiple teams (traded mid-season)
 * - Players missing contracts
 * - Players missing metrics
 * - Possible duplicate players (similar names)
 * - Team roster size anomalies
 * - Contract outliers (suspiciously low/high salaries)
 * - Players with zero games played
 */
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const season = await prisma.season.findFirst({ orderBy: { year: "desc" } });
    if (!season) {
      return NextResponse.json({ error: "No season found" }, { status: 400 });
    }

    // ── Gather raw data ──────────────────────────────────────────────

    const allPlayers = await prisma.player.findMany({
      select: { id: true, firstName: true, lastName: true, primaryPosition: true, birthdate: true },
    });

    const allMetrics = await prisma.playerSeasonMetric.findMany({
      where: { seasonId: season.id },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true, abbrev: true } },
      },
    });

    const allContracts = await prisma.contract.findMany({
      where: { seasonId: season.id },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true, abbrev: true } },
      },
    });

    const allTeams = await prisma.team.findMany({
      where: { seasonId: season.id, isExpansion: false },
      select: { id: true, name: true, abbrev: true },
    });

    // ── 1. Players on multiple teams ─────────────────────────────────
    // BBR has separate rows per team for traded players. Flag these so
    // the user can decide which team "owns" the player for draft purposes.

    const metricsByPlayer = new Map<string, typeof allMetrics>();
    for (const m of allMetrics) {
      const list = metricsByPlayer.get(m.playerId) ?? [];
      list.push(m);
      metricsByPlayer.set(m.playerId, list);
    }

    const multiTeamPlayers: Array<{
      playerId: string;
      playerName: string;
      teams: Array<{ teamId: string; teamAbbrev: string; teamName: string; gamesPlayed: number }>;
    }> = [];

    for (const [playerId, metrics] of metricsByPlayer) {
      const uniqueTeams = new Set(metrics.map((m) => m.teamId));
      if (uniqueTeams.size > 1) {
        multiTeamPlayers.push({
          playerId,
          playerName: `${metrics[0].player.firstName} ${metrics[0].player.lastName}`,
          teams: metrics.map((m) => ({
            teamId: m.team.id,
            teamAbbrev: m.team.abbrev,
            teamName: m.team.name,
            gamesPlayed: m.gamesPlayed,
          })),
        });
      }
    }

    // ── 2. Players missing contracts ─────────────────────────────────
    // Players who have metrics (i.e. they played) but no contract record.

    const playerIdsWithContracts = new Set(allContracts.map((c) => c.playerId));
    const playerIdsWithMetrics = new Set(allMetrics.map((m) => m.playerId));

    const playersWithoutContracts: Array<{
      playerId: string;
      playerName: string;
      teamAbbrev: string;
      gamesPlayed: number;
    }> = [];

    for (const m of allMetrics) {
      if (!playerIdsWithContracts.has(m.playerId)) {
        // Only report once per player (pick the team with most games)
        const existing = playersWithoutContracts.find((p) => p.playerId === m.playerId);
        if (!existing || m.gamesPlayed > existing.gamesPlayed) {
          const idx = playersWithoutContracts.findIndex((p) => p.playerId === m.playerId);
          const entry = {
            playerId: m.playerId,
            playerName: `${m.player.firstName} ${m.player.lastName}`,
            teamAbbrev: m.team.abbrev,
            gamesPlayed: m.gamesPlayed,
          };
          if (idx >= 0) playersWithoutContracts[idx] = entry;
          else playersWithoutContracts.push(entry);
        }
      }
    }

    // ── 3. Contracts without metrics ─────────────────────────────────
    // Players who have a contract but no stats (might be injured all season,
    // or a contract-only import that didn't match metrics).

    const contractsWithoutMetrics: Array<{
      playerId: string;
      playerName: string;
      teamAbbrev: string;
      salary: number;
    }> = [];

    for (const c of allContracts) {
      if (!playerIdsWithMetrics.has(c.playerId)) {
        contractsWithoutMetrics.push({
          playerId: c.playerId,
          playerName: `${c.player.firstName} ${c.player.lastName}`,
          teamAbbrev: c.team.abbrev,
          salary: Number(c.salary),
        });
      }
    }

    // ── 4. Players with no metrics AND no contracts ──────────────────
    // Orphan player records with no associated data.

    const orphanPlayers: Array<{
      playerId: string;
      playerName: string;
      position: string;
    }> = [];

    for (const p of allPlayers) {
      if (!playerIdsWithMetrics.has(p.id) && !playerIdsWithContracts.has(p.id)) {
        orphanPlayers.push({
          playerId: p.id,
          playerName: `${p.firstName} ${p.lastName}`,
          position: p.primaryPosition,
        });
      }
    }

    // ── 5. Possible duplicate players ────────────────────────────────
    // Players with very similar normalized names that might be duplicates
    // created by different data sources.

    function normalizeName(s: string): string {
      return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const nameToPlayers = new Map<string, typeof allPlayers>();
    for (const p of allPlayers) {
      const key = normalizeName(`${p.firstName} ${p.lastName}`);
      const list = nameToPlayers.get(key) ?? [];
      list.push(p);
      nameToPlayers.set(key, list);
    }

    const possibleDuplicates: Array<{
      normalizedName: string;
      players: Array<{ playerId: string; firstName: string; lastName: string; position: string }>;
    }> = [];

    for (const [name, players] of nameToPlayers) {
      if (players.length > 1) {
        possibleDuplicates.push({
          normalizedName: name,
          players: players.map((p) => ({
            playerId: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.primaryPosition,
          })),
        });
      }
    }

    // ── 6. Team roster sizes ─────────────────────────────────────────
    // Flag teams with unusually few (<10) or many (>20) players.

    const contractsByTeam = new Map<string, number>();
    for (const c of allContracts) {
      contractsByTeam.set(c.teamId, (contractsByTeam.get(c.teamId) ?? 0) + 1);
    }
    const metricsByTeam = new Map<string, number>();
    for (const m of allMetrics) {
      metricsByTeam.set(m.teamId, (metricsByTeam.get(m.teamId) ?? 0) + 1);
    }

    const teamRosterIssues: Array<{
      teamId: string;
      teamName: string;
      teamAbbrev: string;
      playersWithMetrics: number;
      playersWithContracts: number;
      issue: string;
    }> = [];

    for (const team of allTeams) {
      const metricCount = metricsByTeam.get(team.id) ?? 0;
      const contractCount = contractsByTeam.get(team.id) ?? 0;
      const issues: string[] = [];

      if (metricCount === 0) issues.push("no players with metrics");
      else if (metricCount < 10) issues.push(`only ${metricCount} players with metrics (expected 12-20)`);
      else if (metricCount > 20) issues.push(`${metricCount} players with metrics (unusually high, check for traded players)`);

      if (contractCount === 0 && metricCount > 0) issues.push("no contracts (upload contracts CSV)");
      else if (contractCount < metricCount - 3) issues.push(`${metricCount - contractCount} players missing contracts`);

      if (issues.length > 0) {
        teamRosterIssues.push({
          teamId: team.id,
          teamName: team.name,
          teamAbbrev: team.abbrev,
          playersWithMetrics: metricCount,
          playersWithContracts: contractCount,
          issue: issues.join("; "),
        });
      }
    }

    // ── 7. Contract outliers ─────────────────────────────────────────
    // Suspiciously low or high salaries that might indicate parse errors.

    const contractOutliers: Array<{
      playerId: string;
      playerName: string;
      teamAbbrev: string;
      salary: number;
      yearsRemaining: number;
      issue: string;
    }> = [];

    for (const c of allContracts) {
      const salary = Number(c.salary);
      const issues: string[] = [];
      if (salary === 0) issues.push("$0 salary");
      else if (salary < 500_000) issues.push(`very low salary ($${salary.toLocaleString()})`);
      else if (salary > 60_000_000) issues.push(`very high salary ($${salary.toLocaleString()})`);
      if (c.yearsRemaining <= 0) issues.push("0 or negative years remaining");

      if (issues.length > 0) {
        contractOutliers.push({
          playerId: c.playerId,
          playerName: `${c.player.firstName} ${c.player.lastName}`,
          teamAbbrev: c.team.abbrev,
          salary,
          yearsRemaining: c.yearsRemaining,
          issue: issues.join("; "),
        });
      }
    }

    // ── 8. Zero-games players ────────────────────────────────────────
    // Players with metrics rows but 0 games played.

    const zeroGamesPlayers: Array<{
      playerId: string;
      playerName: string;
      teamAbbrev: string;
    }> = [];

    for (const m of allMetrics) {
      if (m.gamesPlayed === 0) {
        zeroGamesPlayers.push({
          playerId: m.playerId,
          playerName: `${m.player.firstName} ${m.player.lastName}`,
          teamAbbrev: m.team.abbrev,
        });
      }
    }

    // ── Summary ──────────────────────────────────────────────────────

    const totalIssues =
      multiTeamPlayers.length +
      playersWithoutContracts.length +
      contractsWithoutMetrics.length +
      orphanPlayers.length +
      possibleDuplicates.length +
      teamRosterIssues.length +
      contractOutliers.length +
      zeroGamesPlayers.length;

    return NextResponse.json({
      seasonYear: season.year,
      overview: {
        totalPlayers: allPlayers.length,
        totalContracts: allContracts.length,
        totalMetrics: allMetrics.length,
        totalTeams: allTeams.length,
        totalIssues,
      },
      issues: {
        multiTeamPlayers: {
          count: multiTeamPlayers.length,
          description:
            "Players with stats on multiple teams (likely traded mid-season). " +
            "Decide which team 'owns' the player for draft purposes, or keep both entries.",
          items: multiTeamPlayers,
        },
        playersWithoutContracts: {
          count: playersWithoutContracts.length,
          description:
            "Players who have stats but no contract record. " +
            "They will be missing from draft pool until a contract is added.",
          items: playersWithoutContracts,
        },
        contractsWithoutMetrics: {
          count: contractsWithoutMetrics.length,
          description:
            "Players who have a contract but no stats. " +
            "They will have no protect score and may cause scoring issues.",
          items: contractsWithoutMetrics,
        },
        orphanPlayers: {
          count: orphanPlayers.length,
          description:
            "Player records with no metrics and no contracts. " +
            "These are likely leftover from old imports and can be safely deleted.",
          items: orphanPlayers,
        },
        possibleDuplicates: {
          count: possibleDuplicates.length,
          description:
            "Players with identical normalized names. " +
            "May be duplicates from different data sources, or legitimately different people (e.g. Jr/Sr).",
          items: possibleDuplicates,
        },
        teamRosterIssues: {
          count: teamRosterIssues.length,
          description:
            "Teams with unusual roster sizes or mismatches between metrics and contracts.",
          items: teamRosterIssues,
        },
        contractOutliers: {
          count: contractOutliers.length,
          description:
            "Contracts with suspicious values ($0, very low, very high) that may indicate parse errors.",
          items: contractOutliers,
        },
        zeroGamesPlayers: {
          count: zeroGamesPlayers.length,
          description:
            "Players with 0 games played. May have been injured all season or data error.",
          items: zeroGamesPlayers,
        },
      },
    });
  } catch (e) {
    console.error("Data report failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report failed" },
      { status: 500 }
    );
  }
}
