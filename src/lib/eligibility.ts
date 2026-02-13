import type { ExpansionRules } from "./rules-schema";

export interface ExposedPlayer {
  playerId: string;
  teamId: string;
  contractId: string;
  salary: number;
  yearsRemaining: number;
  hasPlayerOption: boolean;
  hasTeamOption: boolean;
  isUFAAfterSeason: boolean;
  isRFAAfterSeason: boolean;
  isProtected: boolean;
  likelyToLeave?: boolean;
}

export function buildExposedPool(
  contractsWithProtection: Array<{
    playerId: string;
    teamId: string;
    contractId: string;
    salary: number;
    yearsRemaining: number;
    hasPlayerOption: boolean;
    hasTeamOption: boolean;
    isUFAAfterSeason: boolean;
    isRFAAfterSeason: boolean;
    isProtected: boolean;
  }>,
  rules: ExpansionRules
): ExposedPlayer[] {
  const pool: ExposedPlayer[] = [];

  for (const c of contractsWithProtection) {
    if (c.isProtected) continue;

    if (rules.uFAExemptFromProtection && c.isUFAAfterSeason) {
      pool.push({
        ...c,
        isProtected: false,
        likelyToLeave: true,
      });
      continue;
    }

    if (!rules.allowDraftingPlayersWithOptions && (c.hasPlayerOption || c.hasTeamOption)) {
      continue;
    }

    pool.push({
      ...c,
      isProtected: false,
    });
  }

  return pool;
}

export function filterPoolByTeamLoss(
  pool: ExposedPlayer[],
  teamsThatAlreadyLostPlayer: Set<string>
): ExposedPlayer[] {
  return pool.filter((p) => !teamsThatAlreadyLostPlayer.has(p.teamId));
}
