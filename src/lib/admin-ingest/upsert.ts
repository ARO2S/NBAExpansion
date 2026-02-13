"use server";

import { prisma } from "@/lib/db";
import type { IngestPayload } from "./schema";

/** Upsert teams for season */
async function upsertTeams(
  seasonId: string,
  teams: IngestPayload["teams"]
) {
  if (!teams?.length) return { created: 0, updated: 0 };
  let created = 0;
  let updated = 0;
  for (const t of teams) {
    const existing = await prisma.team.findFirst({
      where: { seasonId, abbrev: t.abbrev },
    });
    if (existing) {
      await prisma.team.update({
        where: { id: existing.id },
        data: {
          name: t.name,
          providerTeamId: t.provider_team_id ?? null,
        },
      });
      updated++;
    } else {
      await prisma.team.create({
        data: {
          seasonId,
          name: t.name,
          abbrev: t.abbrev,
          providerTeamId: t.provider_team_id ?? null,
          isExpansion: false,
        },
      });
      created++;
    }
  }
  return { created, updated };
}

/** Upsert player by provider_player_id or (first_name, last_name, birthdate) */
async function upsertPlayer(
  p: IngestPayload["players"] extends (infer T)[] ? T : never
) {
  const birthdate = new Date(p.birthdate + "T00:00:00Z");
  if (p.provider_player_id) {
    const existing = await prisma.player.findFirst({
      where: { providerPlayerId: p.provider_player_id },
    });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          firstName: p.first_name,
          lastName: p.last_name,
          birthdate,
          primaryPosition: p.primary_position,
        },
      });
      return existing.id;
    }
  }
  const byName = await prisma.player.findFirst({
    where: {
      firstName: p.first_name,
      lastName: p.last_name,
      birthdate,
    },
  });
  if (byName) {
    await prisma.player.update({
      where: { id: byName.id },
      data: {
        providerPlayerId: p.provider_player_id ?? byName.providerPlayerId,
        primaryPosition: p.primary_position,
      },
    });
    return byName.id;
  }
  const created = await prisma.player.create({
    data: {
      providerPlayerId: p.provider_player_id ?? null,
      firstName: p.first_name,
      lastName: p.last_name,
      birthdate,
      primaryPosition: p.primary_position,
    },
  });
  return created.id;
}

/** Resolve player ID from provider_player_id or (first_name, last_name, birthdate) */
async function resolvePlayerId(
  lookup: {
    provider_player_id?: string;
    first_name?: string;
    last_name?: string;
    birthdate?: string;
  }
): Promise<string | null> {
  if (lookup.provider_player_id) {
    const p = await prisma.player.findFirst({
      where: { providerPlayerId: lookup.provider_player_id },
    });
    return p?.id ?? null;
  }
  if (lookup.first_name && lookup.last_name && lookup.birthdate) {
    const birthdate = new Date(lookup.birthdate + "T00:00:00Z");
    const p = await prisma.player.findFirst({
      where: {
        firstName: lookup.first_name,
        lastName: lookup.last_name,
        birthdate,
      },
    });
    return p?.id ?? null;
  }
  return null;
}

/** Main ingest: validate and upsert all entities */
export async function ingestData(payload: IngestPayload): Promise<{
  ok: boolean;
  error?: string;
  teams?: { created: number; updated: number };
  players?: number;
  contracts?: number;
  metrics?: number;
  accolades?: number;
}> {
  let season = await prisma.season.findFirst({
    where: { year: payload.season_year },
  });
  if (!season) {
    const cap = (payload as { salary_cap?: number }).salary_cap ?? 140_000_000;
    season = await prisma.season.create({
      data: { year: payload.season_year, salaryCap: cap },
    });
  }
  const seasonId = season.id;

  const teamsByAbbrev = new Map(
    (await prisma.team.findMany({ where: { seasonId } })).map((t) => [t.abbrev, t])
  );

  let teamsResult: { created: number; updated: number } | undefined;
  if (payload.teams?.length) {
    teamsResult = await upsertTeams(seasonId, payload.teams);
    const refreshed = await prisma.team.findMany({ where: { seasonId } });
    refreshed.forEach((t) => teamsByAbbrev.set(t.abbrev, t));
  }

  let playersCount = 0;
  const playerIdByProvider = new Map<string, string>();
  const playerIdByNameBirth = new Map<string, string>();

  if (payload.players?.length) {
    for (const p of payload.players) {
      const id = await upsertPlayer(p);
      playersCount++;
      if (p.provider_player_id) playerIdByProvider.set(p.provider_player_id, id);
      playerIdByNameBirth.set(`${p.first_name}|${p.last_name}|${p.birthdate}`, id);
    }
  }

  const getPlayerId = async (row: {
    provider_player_id?: string;
    first_name?: string;
    last_name?: string;
    birthdate?: string;
  }) => {
    if (row.provider_player_id && playerIdByProvider.has(row.provider_player_id)) {
      return playerIdByProvider.get(row.provider_player_id)!;
    }
    if (row.first_name && row.last_name && row.birthdate) {
      const key = `${row.first_name}|${row.last_name}|${row.birthdate}`;
      if (playerIdByNameBirth.has(key)) return playerIdByNameBirth.get(key)!;
    }
    return resolvePlayerId(row);
  };

  let contractsCount = 0;
  if (payload.contracts?.length) {
    for (const c of payload.contracts) {
      const playerId = await getPlayerId(c);
      const team = teamsByAbbrev.get(c.team_abbrev);
      if (!playerId || !team) continue;
      const existing = await prisma.contract.findFirst({
        where: { seasonId, teamId: team.id, playerId },
      });
      const data = {
        seasonId,
        teamId: team.id,
        playerId,
        salary: c.salary,
        yearsRemaining: c.years_remaining,
        hasPlayerOption: c.has_player_option,
        hasTeamOption: c.has_team_option,
        isUFAAfterSeason: c.is_ufa_after_season,
        isRFAAfterSeason: c.is_rfa_after_season,
        guaranteedPct: c.guaranteed_pct ?? null,
        notes: c.notes ?? null,
      };
      if (existing) {
        await prisma.contract.update({ where: { id: existing.id }, data });
      } else {
        await prisma.contract.create({ data });
      }
      contractsCount++;
    }
  }

  let metricsCount = 0;
  if (payload.metrics?.length) {
    for (const m of payload.metrics) {
      const playerId = await getPlayerId(m);
      const team = teamsByAbbrev.get(m.team_abbrev);
      if (!playerId || !team) continue;
      const existing = await prisma.playerSeasonMetric.findFirst({
        where: { seasonId, teamId: team.id, playerId },
      });
      const data = {
        seasonId,
        teamId: team.id,
        playerId,
        gamesPlayed: m.games_played,
        minutesPerGame: m.minutes_per_game,
        starts: m.starts,
        pointsPerGame: m.points_per_game,
        assistsPerGame: m.assists_per_game,
        reboundsPerGame: m.rebounds_per_game,
        overallRating: m.overall_rating ?? null,
      };
      if (existing) {
        await prisma.playerSeasonMetric.update({ where: { id: existing.id }, data });
      } else {
        await prisma.playerSeasonMetric.create({ data });
      }
      metricsCount++;
    }
  }

  let accoladesCount = 0;
  if (payload.accolades?.length) {
    for (const a of payload.accolades) {
      const playerId = await getPlayerId(a);
      if (!playerId) continue;
      await prisma.playerAccolade.upsert({
        where: { playerId },
        create: {
          playerId,
          allStarAppearances: a.all_star_appearances,
          championships: a.championships,
        },
        update: {
          allStarAppearances: a.all_star_appearances,
          championships: a.championships,
        },
      });
      accoladesCount++;
    }
  }

  return {
    ok: true,
    teams: teamsResult,
    players: playersCount || undefined,
    contracts: contractsCount || undefined,
    metrics: metricsCount || undefined,
    accolades: accoladesCount || undefined,
  };
}
