"use server";

import { prisma } from "@/lib/db";
import { scoreRoster } from "@/lib/scoring/protectScore";
import { getTeamRosterData } from "./roster";
import { toRosterPlayerForScoring } from "@/lib/roster-utils";
import { RULES_PRESETS } from "@/lib/rules-schema";

export interface ProtectionListItemView {
  id?: string | null; // null when from canonical/computed, not yet persisted
  playerId: string;
  playerName: string;
  position: string;
  isProtected: boolean;
  protectScore: number;
  scoreBreakdown: object;
}

export interface ProtectionListResult {
  protectionListId: string | null; // null when computed only
  items: ProtectionListItemView[];
}

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
    return {
      protectionListId: pl.id,
      items: pl.items
        .sort((a, b) => Number((b.protectScore ?? 0) - (a.protectScore ?? 0)))
        .map((i) => ({
          id: i.id,
          playerId: i.playerId,
          playerName: `${i.player.firstName} ${i.player.lastName}`,
          position: i.player.primaryPosition,
          isProtected: i.isProtected,
          protectScore: i.protectScore != null ? Number(i.protectScore) : 0,
          scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
        })),
    };
  }

  const canonical = await prisma.canonicalProtectionList.findFirst({
    where: { seasonId: run.seasonId, teamId },
    include: { items: { include: { player: true } } },
  });
  if (canonical) {
    return {
      protectionListId: null,
      items: canonical.items
        .sort((a, b) => Number((b.protectScore ?? 0) - (a.protectScore ?? 0)))
        .map((i) => ({
          id: null,
          playerId: i.playerId,
          playerName: `${i.player.firstName} ${i.player.lastName}`,
          position: i.player.primaryPosition,
          isProtected: i.isProtected,
          protectScore: i.protectScore != null ? Number(i.protectScore) : 0,
          scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
        })),
    };
  }

  return { protectionListId: null, items: [] };
}

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

    const { scored, protectedPlayerIds } = scoreRoster(
      roster,
      salaryCap,
      season.year,
      rulesJson
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
          protectScore: result.protect_score,
          scoreBreakdownJson: result.breakdown as object,
        },
      });
    }
    teamsUpdated++;
  }

  return { ok: true, teamsUpdated };
}

/**
 * Compute protection list from metrics. Does NOT persist.
 * All users share the same defaults from score.
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

  const rosterData = await getTeamRosterData(run.seasonId, teamId);
  const roster = rosterData
    .filter((r) => r.metrics != null)
    .map((r) => toRosterPlayerForScoring(r, run.season.year));

  if (roster.length === 0) {
    return { protectionListId: null, items: [] };
  }

  const salaryCap = Number(run.season.salaryCap);
  const rulesJson = run.rulesSnapshotJson;
  const { scored, protectedPlayerIds } = scoreRoster(
    roster,
    salaryCap,
    run.season.year,
    rulesJson
  );

  const items: ProtectionListItemView[] = scored.map(({ player, result }) => ({
    id: null,
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    position: player.primaryPosition,
    isProtected: protectedPlayerIds.has(player.playerId),
    protectScore: result.protect_score,
    scoreBreakdown: result.breakdown,
  }));

  return { protectionListId: null, items };
}

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
    for (const ci of canonical.items) {
      const effectiveProtected =
        ci.playerId === playerId ? isProtected : ci.isProtected;
      await prisma.protectionListItem.create({
        data: {
          protectionListId: pl.id,
          playerId: ci.playerId,
          isProtected: effectiveProtected,
          protectScore: ci.protectScore,
          scoreBreakdownJson: ci.scoreBreakdownJson as object,
        },
      });
    }
  } else {
    // Fallback: no canonical data exists, compute from scratch
    const rosterData = await getTeamRosterData(run.seasonId, teamId);
    const roster = rosterData
      .filter((r) => r.metrics != null)
      .map((r) => toRosterPlayerForScoring(r, run.season.year));

    if (roster.length === 0) return { error: "No roster data" };

    const salaryCap = Number(run.season.salaryCap);
    const rulesJson = run.rulesSnapshotJson;
    const { scored, protectedPlayerIds } = scoreRoster(
      roster,
      salaryCap,
      run.season.year,
      rulesJson
    );

    const effectiveProtected = new Set(protectedPlayerIds);
    if (isProtected) {
      effectiveProtected.add(playerId);
    } else {
      effectiveProtected.delete(playerId);
    }

    for (const { player, result } of scored) {
      await prisma.protectionListItem.create({
        data: {
          protectionListId: pl.id,
          playerId: player.playerId,
          isProtected: effectiveProtected.has(player.playerId),
          protectScore: result.protect_score,
          scoreBreakdownJson: result.breakdown as object,
        },
      });
    }
  }

  return { ok: true };
}

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

/**
 * Generate or regenerate protection list for (runId, teamId).
 * Populates from canonical (GM Key) when available; otherwise computes.
 * If list is locked, does not regenerate unless force=true (admin).
 */
export async function generateProtectionList(
  runId: string,
  teamId: string,
  options?: { force?: boolean }
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
      data: { runId, teamId },
    });
  } else if (pl.lockedAt && !options?.force) {
    const existing = await prisma.protectionListItem.findMany({
      where: { protectionListId: pl.id },
      include: { player: true },
    });
    return {
      protectionListId: pl.id,
      items: existing
        .sort((a, b) => Number((b.protectScore ?? 0) - (a.protectScore ?? 0)))
        .map((i) => ({
          playerId: i.playerId,
          playerName: `${i.player.firstName} ${i.player.lastName}`,
          position: i.player.primaryPosition,
          isProtected: i.isProtected,
          protectScore: i.protectScore != null ? Number(i.protectScore) : 0,
          scoreBreakdown: (i.scoreBreakdownJson as object) ?? {},
        })),
    };
  }

  // Copy from canonical (GM Key) if available; otherwise compute from scratch.
  const canonical = await prisma.canonicalProtectionList.findFirst({
    where: { seasonId: run.seasonId, teamId },
    include: { items: { include: { player: true } } },
  });

  await prisma.protectionListItem.deleteMany({
    where: { protectionListId: pl.id },
  });

  if (canonical && canonical.items.length > 0) {
    for (const ci of canonical.items) {
      await prisma.protectionListItem.create({
        data: {
          protectionListId: pl.id,
          playerId: ci.playerId,
          isProtected: ci.isProtected,
          protectScore: ci.protectScore,
          scoreBreakdownJson: ci.scoreBreakdownJson as object,
        },
      });
    }

    const items = canonical.items
      .sort((a, b) => Number((b.protectScore ?? 0) - (a.protectScore ?? 0)))
      .map((ci) => ({
        playerId: ci.playerId,
        playerName: `${ci.player.firstName} ${ci.player.lastName}`,
        position: ci.player.primaryPosition,
        isProtected: ci.isProtected,
        protectScore: ci.protectScore != null ? Number(ci.protectScore) : 0,
        scoreBreakdown: (ci.scoreBreakdownJson as object) ?? {},
      }));

    return { protectionListId: pl.id, items };
  }

  // Fallback: no canonical data, compute from scratch
  const rosterData = await getTeamRosterData(run.seasonId, teamId);
  const roster = rosterData
    .filter((r) => r.metrics != null)
    .map((r) => toRosterPlayerForScoring(r, run.season.year));

  if (roster.length === 0) {
    return { protectionListId: pl.id, items: [] };
  }

  const salaryCap = Number(run.season.salaryCap);
  const rulesJson = run.rulesSnapshotJson;
  const { scored, protectedPlayerIds } = scoreRoster(
    roster,
    salaryCap,
    run.season.year,
    rulesJson
  );

  for (const { player, result } of scored) {
    const isProtected = protectedPlayerIds.has(player.playerId);
    await prisma.protectionListItem.create({
      data: {
        protectionListId: pl.id,
        playerId: player.playerId,
        isProtected,
        protectScore: result.protect_score,
        scoreBreakdownJson: result.breakdown as object,
      },
    });
  }

  const items = scored.map(({ player, result }) => ({
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    position: player.primaryPosition,
    isProtected: protectedPlayerIds.has(player.playerId),
    protectScore: result.protect_score,
    scoreBreakdown: result.breakdown,
  }));

  return { protectionListId: pl.id, items };
}
