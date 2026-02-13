import type { RosterPlayerForScoring } from "@/lib/scoring/protectScore";
import type { RosterPlayerData } from "@/app/actions/roster";

/** Convert RosterPlayerData to RosterPlayerForScoring for the scoring module */
export function toRosterPlayerForScoring(
  r: RosterPlayerData,
  _seasonYear: number
): RosterPlayerForScoring {
  const m = r.metrics!;
  return {
    playerId: r.player.id,
    firstName: r.player.firstName,
    lastName: r.player.lastName,
    birthdate: r.player.birthdate,
    primaryPosition: r.player.primaryPosition,
    gamesPlayed: m.gamesPlayed,
    minutesPerGame: m.minutesPerGame,
    starts: m.starts,
    pointsPerGame: m.pointsPerGame,
    assistsPerGame: m.assistsPerGame,
    reboundsPerGame: m.reboundsPerGame,
    overallRating: m.overallRating,
    salary: r.contract?.salary,
    yearsRemaining: r.contract?.yearsRemaining,
    hasPlayerOption: r.contract?.hasPlayerOption,
    hasTeamOption: r.contract?.hasTeamOption,
    isUFAAfterSeason: r.contract?.isUFAAfterSeason,
    isRFAAfterSeason: r.contract?.isRFAAfterSeason,
    allStarAppearances: r.accolades?.allStarAppearances,
    championships: r.accolades?.championships,
  };
}
