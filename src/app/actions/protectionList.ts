"use server";

import { prisma } from "@/lib/db";
import { scoreRoster } from "@/lib/scoring/protectScore";
import { parseScoringRules, type TeamDirection } from "@/lib/scoring/rules-schema";
import { normalizeScores } from "@/lib/scoring/normalizeScore";
import { getTeamRosterData } from "./roster";
import { toRosterPlayerForScoring } from "@/lib/roster-utils";
import { RULES_PRESETS } from "@/lib/rules-schema";

export interface ProtectionListItemView {
  id?: string | null; // null when from canonical/computed, not yet persisted
  playerId: string;
  playerName: string;
  position: string;
  isProtected: boolean;
  protectScore: number;        // display score (0-100 int) for UI
  protectScoreRaw: number;     // raw algorithmic score
  protectScoreDisplay: number; // normalized 0-100 display score
  scoreBreakdown: object;
}

export interface ProtectionListResult {
  protectionListId: string | null; // null when computed only
  teamDirection: TeamDirection;
  items: ProtectionListItemView[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function toValidDirection(value: unknown): TeamDirection {
  if (value === "rebuild" || value === "contend") return value;
  return "neutral";
}

/**
 * Compute display scores for a list of raw scores using rules normalization mode.
 */
function applyNormalization(
  rawScores: number[],
  rulesJson: unknown
): number[] {
  const rules = parseScoringRules(rulesJson);
  return normalizeScores(rawScores, rules.normalization_mode);
}

// ─── read ──────────────────────────────────────────────────────────────────

/**
 * Get protection list for display: run-specific (user overrides) -> canonical (GM Key).
 * Never computes on the fly. GM Key must be generated once in Admin.
 */
export async function getProtectionListForRun(
  runId: string,
  teamId: string
): Promise<ProtectionListResult | { error: string }> {
  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: { season: true },
  });
  if (!run) return { error: "Run not found" };

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team || team.seasonId !== run.seasonId) return { error: "Team not found or wrong season" };

  const pl = await prisma.protectionList.findFirst({
    where: { runId, teamId },
    include: { items: { include: { player: true } } },
  });
  if (pl) {
    const sorted = pl.items.sort(
      (a, b) => Number(b.protectScoreRaw ?? b.protectScore ?? 0) - Number(a.protectScoreRaw ?? a.protectScore ?? 0)
    );
    return {
      protectionListId: pl.id,
      teamDirection: toValidDirection((pl as { teamDirection?: unknown }).teamDirection),
      items: sorted.map((i) => {
        const raw = i.protectScoreRaw != null ? Number(i.protectScoreRaw)
          : i.protectScore != null ? Number(i.protectScore) : 0;
        const display = i.protectScoreDisplay ?? Math.round(raw);
        return {
          id: i.id,
          playerId: i.playerId,
          playerName: `${i.player.firstName} ${i.player.lastName}`,
          position: i.player.primaryPosition,
          isProtected: i.isProtected,
          protectScore: display,
          protectScoreRaw: raw,
          protectScoreDisplay: display,
          scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
        };
      }),
    };
  }

  const canonical = await prisma.canonicalProtectionList.findFirst({
    where: { seasonId: run.seasonId, teamId },
    include: { items: { include: { player: true } } },
  });
  if (canonical) {
    const sorted = canonical.items.sort(
      (a, b) => Number(b.protectScore ?? 0) - Number(a.protectScore ?? 0)
    );
    const rawScores = sorted.map((i) => i.protectScore != null ? Number(i.protectScore) : 0);
    const displayScores = applyNormalization(rawScores, run.rulesSnapshotJson);
    return {
      protectionListId: null,
      teamDirection: "neutral",
      items: sorted.map((i, idx) => {
        const raw = i.protectScore != null ? Number(i.protectScore) : 0;
        return {
          id: null,
          playerId: i.playerId,
          playerName: `${i.player.firstName} ${i.player.lastName}`,
          position: i.player.primaryPosition,
          isProtected: i.isProtected,
          protectScore: displayScores[idx],
          protectScoreRaw: raw,
          protectScoreDisplay: displayScores[idx],
          scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
        };
      }),
    };
  }

  return { protectionListId: null, teamDirection: "neutral", items: [] };
}

// ─── canonical generation (admin) ──────────────────────────────────────────

/**
 * Generate GM Key canonical protection lists for all teams in a season.
 * Run once per season; all draft runs use this as default until regenerated.
 */
export async function generateCanonicalProtectionLists(
  seasonId?: string
): Promise<{ ok: boolean; teamsUpdated: number; error?: string }> {
  const season = seasonId
    ? await prisma.season.findUnique({ where: { id: seasonId } })
    : await prisma.season.findFirst({ orderBy: { year: "desc" } });
  if (!season) return { ok: false, teamsUpdated: 0, error: "No season found" };

  const teams = await prisma.team.findMany({
    where: { seasonId: season.id, isExpansion: false },
  });

  const rulesJson =
    (season.rulesDefaultJson as object) ?? RULES_PRESETS["1995-style"];
  const salaryCap = Number(season.salaryCap);
  let teamsUpdated = 0;

  try {
    await prisma.canonicalProtectionList.findFirst({ take: 1 });
  } catch {
    return { ok: false, teamsUpdated: 0, error: "Run scripts/add-canonical-protection-list.sql migration, then npx prisma generate." };
  }

  for (const team of teams) {
    const rosterData = await getTeamRosterData(season.id, team.id);
    const roster = rosterData
      .filter((r) => r.metrics != null)
      .map((r) => toRosterPlayerForScoring(r, season.year));

    if (roster.length === 0) continue;

    // Canonical lists always use neutral direction
    const { scored, protectedPlayerIds } = scoreRoster(
      roster,
      salaryCap,
      season.year,
      rulesJson,
      "neutral"
    );

    let cpl = await prisma.canonicalProtectionList.findFirst({
      where: { seasonId: season.id, teamId: team.id },
    });
    if (!cpl) {
      cpl = await prisma.canonicalProtectionList.create({
        data: { seasonId: season.id, teamId: team.id },
      });
    }

    await prisma.canonicalProtectionListItem.deleteMany({
      where: { canonicalListId: cpl.id },
    });

    for (const { player, result } of scored) {
      await prisma.canonicalProtectionListItem.create({
        data: {
          canonicalListId: cpl.id,
          playerId: player.playerId,
          isProtected: protectedPlayerIds.has(player.playerId),
          protectScore: result.protect_score_raw,
          scoreBreakdownJson: result.breakdown as object,
        },
      });
    }
    teamsUpdated++;
  }

  return { ok: true, teamsUpdated };
}

// ─── compute only (no persist) ────────────────────────────────────────────

/**
 * Compute protection list from metrics. Does NOT persist.
 */
export async function computeProtectionListOnly(
  runId: string,
  teamId: string
): Promise<ProtectionListResult | { error: string }> {
  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: { season: true },
  });
  if (!run) return { error: "Run not found" };

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team || team.seasonId !== run.seasonId) return { error: "Team not found or wrong season" };

  const pl = await prisma.protectionList.findFirst({ where: { runId, teamId } });
  const direction = toValidDirection((pl as { teamDirection?: unknown } | null)?.teamDirection);

  const rosterData = await getTeamRosterData(run.seasonId, teamId);
  const roster = rosterData
    .filter((r) => r.metrics != null)
    .map((r) => toRosterPlayerForScoring(r, run.season.year));

  if (roster.length === 0) {
    return { protectionListId: null, teamDirection: direction, items: [] };
  }

  const salaryCap = Number(run.season.salaryCap);
  const rulesJson = run.rulesSnapshotJson;
  const { scored, protectedPlayerIds } = scoreRoster(
    roster, salaryCap, run.season.year, rulesJson, direction
  );

  const rawScores = scored.map(({ result }) => result.protect_score_raw);
  const displayScores = applyNormalization(rawScores, rulesJson);

  const items: ProtectionListItemView[] = scored.map(({ player, result }, idx) => ({
    id: null,
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    position: player.primaryPosition,
    isProtected: protectedPlayerIds.has(player.playerId),
    protectScore: displayScores[idx],
    protectScoreRaw: result.protect_score_raw,
    protectScoreDisplay: displayScores[idx],
    scoreBreakdown: result.breakdown,
  }));

  return { protectionListId: null, teamDirection: direction, items };
}

// ─── toggle ────────────────────────────────────────────────────────────────

/**
 * Toggle a player's protection. Persists ProtectionList only when user modifies.
 * - If no ProtectionList: create full list with computed defaults + this override
 * - If ProtectionList exists: update the one item
 */
export async function toggleProtectionAndPersist(
  runId: string,
  teamId: string,
  playerId: string,
  isProtected: boolean
): Promise<{ ok: boolean } | { error: string }> {
  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: { season: true },
  });
  if (!run) return { error: "Run not found" };

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team || team.seasonId !== run.seasonId) return { error: "Team not found or wrong season" };

  let pl = await prisma.protectionList.findFirst({
    where: { runId, teamId },
  });

  if (!pl) {
    pl = await prisma.protectionList.create({
      data: { runId, teamId },
    });
  } else if (pl.lockedAt) {
    return { error: "Protection list is locked" };
  }

  const existingItem = await prisma.protectionListItem.findFirst({
    where: { protectionListId: pl.id, playerId },
  });

  if (existingItem) {
    await prisma.protectionListItem.update({
      where: { id: existingItem.id },
      data: { isProtected },
    });
    return { ok: true };
  }

  // No ProtectionList had items yet – copy from canonical (GM Key) if available,
  // otherwise fall back to computing from scratch.
  const canonical = await prisma.canonicalProtectionList.findFirst({
    where: { seasonId: run.seasonId, teamId },
    include: { items: true },
  });

  await prisma.protectionListItem.deleteMany({
    where: { protectionListId: pl.id },
  });

  if (canonical && canonical.items.length > 0) {
    const direction = toValidDirection((pl as { teamDirection?: unknown }).teamDirection);
    const rawScores = canonical.items.map((ci) =>
      ci.protectScore != null ? Number(ci.protectScore) : 0
    );
    const displayScores = applyNormalization(rawScores, run.rulesSnapshotJson);

    for (let idx = 0; idx < canonical.items.length; idx++) {
      const ci = canonical.items[idx];
      const effectiveProtected = ci.playerId === playerId ? isProtected : ci.isProtected;
      const raw = ci.protectScore != null ? Number(ci.protectScore) : 0;
      await prisma.protectionListItem.create({
        data: {
          protectionListId: pl.id,
          playerId: ci.playerId,
          isProtected: effectiveProtected,
          protectScore: raw,
          protectScoreRaw: raw,
          protectScoreDisplay: displayScores[idx],
          scoreBreakdownJson: {
            ...(ci.scoreBreakdownJson as object),
            team_direction: direction,
          },
        },
      });
    }
  } else {
    // Fallback: no canonical data exists, compute from scratch
    const direction = toValidDirection((pl as { teamDirection?: unknown }).teamDirection);
    const rosterData = await getTeamRosterData(run.seasonId, teamId);
    const roster = rosterData
      .filter((r) => r.metrics != null)
      .map((r) => toRosterPlayerForScoring(r, run.season.year));

    if (roster.length === 0) return { error: "No roster data" };

    const salaryCap = Number(run.season.salaryCap);
    const rulesJson = run.rulesSnapshotJson;
    const { scored, protectedPlayerIds } = scoreRoster(
      roster, salaryCap, run.season.year, rulesJson, direction
    );

    const rawScores = scored.map(({ result }) => result.protect_score_raw);
    const displayScores = applyNormalization(rawScores, rulesJson);

    const effectiveProtected = new Set(protectedPlayerIds);
    if (isProtected) effectiveProtected.add(playerId);
    else effectiveProtected.delete(playerId);

    for (let idx = 0; idx < scored.length; idx++) {
      const { player, result } = scored[idx];
      await prisma.protectionListItem.create({
        data: {
          protectionListId: pl.id,
          playerId: player.playerId,
          isProtected: effectiveProtected.has(player.playerId),
          protectScore: result.protect_score_raw,
          protectScoreRaw: result.protect_score_raw,
          protectScoreDisplay: displayScores[idx],
          scoreBreakdownJson: result.breakdown as object,
        },
      });
    }
  }

  return { ok: true };
}

// ─── reset ─────────────────────────────────────────────────────────────────

/**
 * Reset a team's protection list to GM Key (canonical). Deletes run-specific ProtectionList
 * so the run will show canonical data instead.
 */
export async function resetProtectionListToGmKey(
  runId: string,
  teamId: string
): Promise<{ ok: boolean } | { error: string }> {
  const pl = await prisma.protectionList.findFirst({
    where: { runId, teamId },
  });
  if (!pl) return { ok: true };
  if (pl.lockedAt) return { error: "List is locked" };
  await prisma.protectionList.delete({ where: { id: pl.id } });
  return { ok: true };
}

// ─── generate (full persist) ───────────────────────────────────────────────

/**
 * Generate or regenerate protection list for (runId, teamId).
 * Populates from canonical (GM Key) when available; otherwise computes.
 * If list is locked, does not regenerate unless force=true (admin).
 */
export async function generateProtectionList(
  runId: string,
  teamId: string,
  options?: { force?: boolean; teamDirection?: TeamDirection }
): Promise<ProtectionListResult | { error: string }> {
  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: { season: true },
  });
  if (!run) return { error: "Run not found" };

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team || team.seasonId !== run.seasonId) return { error: "Team not found or wrong season" };

  let pl = await prisma.protectionList.findFirst({
    where: { runId, teamId },
  });

  if (!pl) {
    pl = await prisma.protectionList.create({
      data: {
        runId,
        teamId,
        teamDirection: options?.teamDirection ?? "neutral",
      },
    });
  } else if (pl.lockedAt && !options?.force) {
    const existing = await prisma.protectionListItem.findMany({
      where: { protectionListId: pl.id },
      include: { player: true },
    });
    const sorted = existing.sort(
      (a, b) => Number(b.protectScoreRaw ?? b.protectScore ?? 0) - Number(a.protectScoreRaw ?? a.protectScore ?? 0)
    );
    return {
      protectionListId: pl.id,
      teamDirection: toValidDirection((pl as { teamDirection?: unknown }).teamDirection),
      items: sorted.map((i) => {
        const raw = i.protectScoreRaw != null ? Number(i.protectScoreRaw)
          : i.protectScore != null ? Number(i.protectScore) : 0;
        const display = i.protectScoreDisplay ?? Math.round(raw);
        return {
          playerId: i.playerId,
          playerName: `${i.player.firstName} ${i.player.lastName}`,
          position: i.player.primaryPosition,
          isProtected: i.isProtected,
          protectScore: display,
          protectScoreRaw: raw,
          protectScoreDisplay: display,
          scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
        };
      }),
    };
  }

  // If a direction override was provided and list is not locked, update direction
  if (options?.teamDirection && pl && !pl.lockedAt) {
    pl = await prisma.protectionList.update({
      where: { id: pl.id },
      data: { teamDirection: options.teamDirection },
    });
  }

  const direction = toValidDirection((pl as { teamDirection?: unknown }).teamDirection);
  const rulesJson = run.rulesSnapshotJson;

  // Copy from canonical (GM Key) if available; otherwise compute from scratch.
  const canonical = await prisma.canonicalProtectionList.findFirst({
    where: { seasonId: run.seasonId, teamId },
    include: { items: { include: { player: true } } },
  });

  await prisma.protectionListItem.deleteMany({
    where: { protectionListId: pl.id },
  });

  if (canonical && canonical.items.length > 0) {
    // Re-score with the team direction applied (canonical stores neutral scores)
    const rosterData = await getTeamRosterData(run.seasonId, teamId);
    const roster = rosterData
      .filter((r) => r.metrics != null)
      .map((r) => toRosterPlayerForScoring(r, run.season.year));

    if (roster.length > 0) {
      const salaryCap = Number(run.season.salaryCap);
      const { scored, protectedPlayerIds } = scoreRoster(
        roster, salaryCap, run.season.year, rulesJson, direction
      );

      const rawScores = scored.map(({ result }) => result.protect_score_raw);
      const displayScores = applyNormalization(rawScores, rulesJson);

      for (let idx = 0; idx < scored.length; idx++) {
        const { player, result } = scored[idx];
        await prisma.protectionListItem.create({
          data: {
            protectionListId: pl.id,
            playerId: player.playerId,
            isProtected: protectedPlayerIds.has(player.playerId),
            protectScore: result.protect_score_raw,
            protectScoreRaw: result.protect_score_raw,
            protectScoreDisplay: displayScores[idx],
            scoreBreakdownJson: result.breakdown as object,
          },
        });
      }

      const items = scored.map(({ player, result }, idx) => ({
        playerId: player.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.primaryPosition,
        isProtected: protectedPlayerIds.has(player.playerId),
        protectScore: displayScores[idx],
        protectScoreRaw: result.protect_score_raw,
        protectScoreDisplay: displayScores[idx],
        scoreBreakdown: result.breakdown as object,
      }));

      return { protectionListId: pl.id, teamDirection: direction, items };
    }

    // Roster data unavailable – fall back to canonical scores (neutral direction)
    const rawScores = canonical.items.map((ci) =>
      ci.protectScore != null ? Number(ci.protectScore) : 0
    );
    const displayScores = applyNormalization(rawScores, rulesJson);

    for (let idx = 0; idx < canonical.items.length; idx++) {
      const ci = canonical.items[idx];
      const raw = rawScores[idx];
      await prisma.protectionListItem.create({
        data: {
          protectionListId: pl.id,
          playerId: ci.playerId,
          isProtected: ci.isProtected,
          protectScore: raw,
          protectScoreRaw: raw,
          protectScoreDisplay: displayScores[idx],
          scoreBreakdownJson: ci.scoreBreakdownJson as object,
        },
      });
    }

    const items = canonical.items
      .sort((a, b) => Number(b.protectScore ?? 0) - Number(a.protectScore ?? 0))
      .map((ci, idx) => ({
        playerId: ci.playerId,
        playerName: `${ci.player.firstName} ${ci.player.lastName}`,
        position: ci.player.primaryPosition,
        isProtected: ci.isProtected,
        protectScore: displayScores[idx],
        protectScoreRaw: rawScores[idx],
        protectScoreDisplay: displayScores[idx],
        scoreBreakdown: (ci.scoreBreakdownJson as object) ?? {},
      }));

    return { protectionListId: pl.id, teamDirection: direction, items };
  }

  // Fallback: no canonical data, compute from scratch
  const rosterData = await getTeamRosterData(run.seasonId, teamId);
  const roster = rosterData
    .filter((r) => r.metrics != null)
    .map((r) => toRosterPlayerForScoring(r, run.season.year));

  if (roster.length === 0) {
    return { protectionListId: pl.id, teamDirection: direction, items: [] };
  }

  const salaryCap = Number(run.season.salaryCap);
  const { scored, protectedPlayerIds } = scoreRoster(
    roster, salaryCap, run.season.year, rulesJson, direction
  );

  const rawScores = scored.map(({ result }) => result.protect_score_raw);
  const displayScores = applyNormalization(rawScores, rulesJson);

  for (let idx = 0; idx < scored.length; idx++) {
    const { player, result } = scored[idx];
    await prisma.protectionListItem.create({
      data: {
        protectionListId: pl.id,
        playerId: player.playerId,
        isProtected: protectedPlayerIds.has(player.playerId),
        protectScore: result.protect_score_raw,
        protectScoreRaw: result.protect_score_raw,
        protectScoreDisplay: displayScores[idx],
        scoreBreakdownJson: result.breakdown as object,
      },
    });
  }

  const items = scored.map(({ player, result }, idx) => ({
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    position: player.primaryPosition,
    isProtected: protectedPlayerIds.has(player.playerId),
    protectScore: displayScores[idx],
    protectScoreRaw: result.protect_score_raw,
    protectScoreDisplay: displayScores[idx],
    scoreBreakdown: result.breakdown,
  }));

  return { protectionListId: pl.id, teamDirection: direction, items };
}

// ─── update team direction ─────────────────────────────────────────────────

/**
 * Save team direction for a run's protection list.
 * Creates the list if needed. If the list is locked, returns an error.
 * After saving direction, regenerates scores.
 */
export async function setTeamDirection(
  runId: string,
  teamId: string,
  direction: TeamDirection
): Promise<ProtectionListResult | { error: string }> {
  const run = await prisma.draftRun.findUnique({
    where: { id: runId },
    include: { season: true },
  });
  if (!run) return { error: "Run not found" };

  let pl = await prisma.protectionList.findFirst({ where: { runId, teamId } });
  if (pl?.lockedAt) return { error: "Protection list is locked" };

  if (!pl) {
    pl = await prisma.protectionList.create({
      data: { runId, teamId, teamDirection: direction },
    });
  } else {
    pl = await prisma.protectionList.update({
      where: { id: pl.id },
      data: { teamDirection: direction },
    });
  }

  // Regenerate with new direction
  return generateProtectionList(runId, teamId, { teamDirection: direction });
}
