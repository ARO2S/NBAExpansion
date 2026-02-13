import type { ExpansionRules } from "./rules-schema";
import type { ExposedPlayer } from "./eligibility";

export interface DraftConstraintError {
  type: "player_unavailable" | "team_already_lost" | "max_picks_reached" | "min_picks_not_met";
  message: string;
}

export function validateDraftPick(
  playerId: string,
  fromTeamId: string,
  expansionTeamId: string,
  availablePool: ExposedPlayer[],
  teamsThatLostPlayer: Set<string>,
  expansionTeamPickCount: number,
  rules: ExpansionRules,
  expansionTeamsCount: number
): DraftConstraintError | null {
  const playerInPool = availablePool.find((p) => p.playerId === playerId);
  if (!playerInPool) {
    return {
      type: "player_unavailable",
      message: "Player is not available in the draft pool.",
    };
  }

  if (teamsThatLostPlayer.has(fromTeamId)) {
    return {
      type: "team_already_lost",
      message: "This team has already lost a player in this expansion draft.",
    };
  }

  const maxPicks =
    expansionTeamsCount === 1
      ? rules.expansionDraftMaxPicks
      : Math.ceil(rules.expansionDraftMaxPicks / expansionTeamsCount);

  if (expansionTeamPickCount >= maxPicks) {
    return {
      type: "max_picks_reached",
      message: `Expansion team has reached maximum picks (${maxPicks}).`,
    };
  }

  return null;
}

export function getCapFloorWarnings(
  totalSalary: number,
  expansionCap: number,
  rules: ExpansionRules
): { overCap: boolean; underFloor: boolean } {
  const floor = expansionCap * rules.salaryFloorPct;
  return {
    overCap: totalSalary > expansionCap,
    underFloor: totalSalary < floor,
  };
}
