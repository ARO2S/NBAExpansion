"use server";

import { prisma } from "@/lib/db";

export interface RosterPlayerData {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    birthdate: Date;
    primaryPosition: string;
  };
  contract: {
    salary: number;
    yearsRemaining: number;
    hasPlayerOption: boolean;
    hasTeamOption: boolean;
    isUFAAfterSeason: boolean;
    isRFAAfterSeason: boolean;
  } | null;
  metrics: {
    gamesPlayed: number;
    minutesPerGame: number;
    starts: number;
    pointsPerGame: number;
    assistsPerGame: number;
    reboundsPerGame: number;
    overallRating: number | null;
  } | null;
  accolades: {
    allStarAppearances: number;
    championships: number;
  } | null;
}

const DEFAULT_METRICS = {
  gamesPlayed: 0,
  minutesPerGame: 0,
  starts: 0,
  pointsPerGame: 0,
  assistsPerGame: 0,
  reboundsPerGame: 0,
  overallRating: null as number | null,
};

/** Fetch roster data for a team in a season: players with contract, metrics, accolades. */
export async function getTeamRosterData(
  seasonId: string,
  teamId: string
): Promise<RosterPlayerData[]> {
  const metrics = await prisma.playerSeasonMetric.findMany({
    where: { seasonId, teamId },
    include: {
      player: { include: { accolade: true } },
    },
  });

  const contracts = await prisma.contract.findMany({
    where: { seasonId, teamId },
    include: { player: { include: { accolade: true } } },
  });
  const contractByPlayer = new Map(contracts.map((c) => [c.playerId, c]));

  const result: RosterPlayerData[] = [];

  if (metrics.length > 0) {
    for (const m of metrics) {
      const c = contractByPlayer.get(m.playerId) ?? null;
      result.push({
        player: {
          id: m.player.id,
          firstName: m.player.firstName,
          lastName: m.player.lastName,
          birthdate: m.player.birthdate,
          primaryPosition: m.player.primaryPosition,
        },
        contract: c
          ? {
              salary: Number(c.salary),
              yearsRemaining: c.yearsRemaining,
              hasPlayerOption: c.hasPlayerOption,
              hasTeamOption: c.hasTeamOption,
              isUFAAfterSeason: c.isUFAAfterSeason,
              isRFAAfterSeason: c.isRFAAfterSeason,
            }
          : null,
        metrics: {
          gamesPlayed: m.gamesPlayed,
          minutesPerGame: Number(m.minutesPerGame),
          starts: m.starts,
          pointsPerGame: Number(m.pointsPerGame),
          assistsPerGame: Number(m.assistsPerGame),
          reboundsPerGame: Number(m.reboundsPerGame),
          overallRating: m.overallRating != null ? Number(m.overallRating) : null,
        },
        accolades: m.player.accolade
          ? {
              allStarAppearances: m.player.accolade.allStarAppearances,
              championships: m.player.accolade.championships,
            }
          : null,
      });
    }
    return result;
  }

  // Fallback: no metrics, use contracts so protection list still shows players
  for (const c of contracts) {
    const p = c.player;
    result.push({
      player: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        birthdate: p.birthdate,
        primaryPosition: p.primaryPosition,
      },
      contract: {
        salary: Number(c.salary),
        yearsRemaining: c.yearsRemaining,
        hasPlayerOption: c.hasPlayerOption,
        hasTeamOption: c.hasTeamOption,
        isUFAAfterSeason: c.isUFAAfterSeason,
        isRFAAfterSeason: c.isRFAAfterSeason,
      },
      metrics: DEFAULT_METRICS,
      accolades: p.accolade
        ? {
            allStarAppearances: p.accolade.allStarAppearances,
            championships: p.accolade.championships,
          }
        : null,
    });
  }
  return result;
}
