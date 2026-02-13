/**
 * Syncs provider data into our database.
 * Creates/updates seasons, teams, players, player_season_metrics.
 * Contracts are NOT synced (APIs lack reliable contract data)—use CSV upload instead.
 */

import { prisma } from "@/lib/db";
import { normalizeTeamAbbrev } from "@/lib/team-abbrev";
import type { DataProviderAdapter } from "./types";

const DEFAULT_SALARY_CAP = 140_000_000;
const DEFAULT_CAP_PCT = 0.667;
const DEFAULT_FLOOR_PCT = 0.9;

export async function syncFromProvider(
  adapter: DataProviderAdapter,
  seasonYear: number
): Promise<{ teams: number; players: number; contracts: number; metrics: number }> {
  // Sequential to respect rate limits (e.g. Ball Don't Lie free tier = 5 req/min)
  const teams = await adapter.syncTeams(seasonYear);
  const players = await adapter.syncPlayers(seasonYear);
  const rosters = await adapter.syncRosters(seasonYear);
  const stats = await adapter.syncStats(seasonYear);

  let season = await prisma.season.findFirst({
    where: { year: seasonYear },
  });

  if (!season) {
    season = await prisma.season.create({
      data: {
        year: seasonYear,
        salaryCap: DEFAULT_SALARY_CAP,
        salaryFloorPct: DEFAULT_FLOOR_PCT,
        expansionCapPctYear1: DEFAULT_CAP_PCT,
        expansionCapPctYear2: 0.8,
      },
    });
  }

  const seasonId = season.id;

  const teamAbbrevToId = new Map<string, string>();
  for (const t of teams) {
    const abbrev = normalizeTeamAbbrev(t.abbrev);
    const existing = await prisma.team.findFirst({
      where: { seasonId, abbrev },
    });
    const teamData = { name: t.name, abbrev };
    const team = existing
      ? await prisma.team.update({
          where: { id: existing.id },
          data: teamData,
        })
      : await prisma.team.create({
          data: {
            seasonId,
            ...teamData,
            isExpansion: false,
          },
        });
    teamAbbrevToId.set(abbrev, team.id);
  }

  const providerTeamIdToOurId = new Map<string, string>();
  for (const t of teams) {
    const abbrev = normalizeTeamAbbrev(t.abbrev);
    const ourId = teamAbbrevToId.get(abbrev);
    if (ourId) providerTeamIdToOurId.set(t.providerTeamId, ourId);
  }

  const rosterByPlayer = new Map<string, string>();
  const providerTeamByPlayer = new Map<string, string>();
  for (const r of rosters) {
    const ourTeamId = providerTeamIdToOurId.get(r.providerTeamId);
    if (ourTeamId) {
      rosterByPlayer.set(r.providerPlayerId, ourTeamId);
      providerTeamByPlayer.set(r.providerPlayerId, r.providerTeamId);
    }
  }

  const statsByPlayer = new Map<string, (typeof stats)[0]>();
  for (const s of stats) {
    statsByPlayer.set(s.providerPlayerId, s);
  }

  // Sync players: prefer those on a roster this season; if roster is empty but we have player data, sync all (so Player table gets populated)
  const activePlayerIds = new Set(rosterByPlayer.keys());
  const activePlayers =
    activePlayerIds.size > 0
      ? players.filter((p) => activePlayerIds.has(p.providerPlayerId))
      : players;

  let playersCreated = 0;
  let metricsCreated = 0;

  const playerProviderToOurId = new Map<string, string>();

  for (const p of activePlayers) {
    let player = await prisma.player.findFirst({
      where: { providerPlayerId: p.providerPlayerId },
    });

    if (!player) {
      player = await prisma.player.create({
        data: {
          providerPlayerId: p.providerPlayerId,
          firstName: p.firstName,
          lastName: p.lastName,
          birthdate: p.birthdate,
          primaryPosition: p.primaryPosition,
        },
      });
      playersCreated++;
    } else {
      await prisma.player.update({
        where: { id: player.id },
        data: {
          firstName: p.firstName,
          lastName: p.lastName,
          birthdate: p.birthdate,
          primaryPosition: p.primaryPosition,
        },
      });
    }
    playerProviderToOurId.set(p.providerPlayerId, player.id);
  }

  // Contracts: NOT synced from providers (APIs lack reliable contract data).
  // Use the Contracts CSV Upload on /admin to provide salary/contract data.

  for (const s of stats) {
    const ourPlayerId = playerProviderToOurId.get(s.providerPlayerId);
    if (!ourPlayerId) continue;

    const teamId = rosterByPlayer.get(s.providerPlayerId);
    if (!teamId) continue;

    const existing = await prisma.playerSeasonMetric.findFirst({
      where: { seasonId, playerId: ourPlayerId, teamId },
    });

    const rating = s.overallRating ?? 50 + Math.min(40, s.gamesPlayed);
    const ppg = s.pointsPerGame ?? 0;
    const apg = s.assistsPerGame ?? 0;
    const rpg = s.reboundsPerGame ?? 0;

    if (!existing) {
      await prisma.playerSeasonMetric.create({
        data: {
          seasonId,
          playerId: ourPlayerId,
          teamId,
          gamesPlayed: s.gamesPlayed,
          minutesPerGame: s.minutesPerGame,
          starts: s.starts,
          pointsPerGame: ppg,
          assistsPerGame: apg,
          reboundsPerGame: rpg,
          overallRating: rating,
          impactMetric: s.impactMetric ?? null,
        },
      });
      metricsCreated++;
    } else {
      await prisma.playerSeasonMetric.update({
        where: { id: existing.id },
        data: {
          gamesPlayed: s.gamesPlayed,
          minutesPerGame: s.minutesPerGame,
          starts: s.starts,
          pointsPerGame: ppg,
          assistsPerGame: apg,
          reboundsPerGame: rpg,
          overallRating: rating,
          impactMetric: s.impactMetric ?? null,
        },
      });
    }
  }

  return {
    teams: teams.length,
    players: playersCreated,
    contracts: 0,
    metrics: metricsCreated,
  };
}