import type { ExpansionRules } from "./rules-schema";
import type { Decimal } from "@prisma/client/runtime/library";

const SEASON_START_MONTH = 7; // July
const SEASON_START_DAY = 1;
const GAMES_PER_SEASON = 82;

export interface PlayerForScoring {
  birthdate: Date;
  overallRating: number | null;
  minutesPerGame: number;
  starts: number;
  gamesPlayed: number;
  salary: number;
  yearsRemaining: number;
  hasPlayerOption: boolean;
  hasTeamOption: boolean;
  isUFAAfterSeason: boolean;
  isRFAAfterSeason: boolean;
}

export interface ScoreBreakdown {
  impact: number;
  age: number;
  contract: number;
  availability: number;
  total: number;
}

export type PlayerBadge =
  | "Young Asset"
  | "Bad Contract"
  | "Injury Risk"
  | "Expiring"
  | "Option Risk";

export function toNum(d: Decimal | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in d ? (d as Decimal).toNumber() : Number(d);
}

export function getAgeAtSeasonStart(birthdate: Date, seasonYear: number): number {
  const seasonStart = new Date(seasonYear, SEASON_START_MONTH - 1, SEASON_START_DAY);
  let age = seasonStart.getFullYear() - birthdate.getFullYear();
  const m = seasonStart.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && seasonStart.getDate() < birthdate.getDate())) age--;
  return age;
}

function ageScore(age: number, ageCurve: ExpansionRules["ageCurve"]): number {
  if (age >= ageCurve.peakAgeStart && age <= ageCurve.peakAgeEnd) return 1;
  if (age < ageCurve.peakAgeStart) {
    const progress = age / ageCurve.peakAgeStart;
    return 0.3 + 0.7 * progress;
  }
  if (age <= ageCurve.declineStart) return 1 - (age - ageCurve.peakAgeEnd) * 0.05;
  if (age <= ageCurve.steepDeclineStart) return 0.85 - (age - ageCurve.declineStart) * 0.1;
  return Math.max(0, 0.5 - (age - ageCurve.steepDeclineStart) * 0.15);
}

function impactScore(
  overallRating: number | null,
  minutesPerGame: number,
  starts: number,
  gamesPlayed: number,
  impactMetric: number | null
): number {
  if (overallRating != null) {
    return Math.min(1, Math.max(0, overallRating / 100));
  }
  const mpFactor = Math.min(1, minutesPerGame / 35);
  const startsFactor = Math.min(1, starts / 82);
  const gamesFactor = Math.min(1, gamesPlayed / 82);
  let proxy = (mpFactor * 0.5 + startsFactor * 0.3 + gamesFactor * 0.2);
  if (impactMetric != null) {
    proxy = proxy * 0.5 + Math.min(1, Math.max(-1, (impactMetric + 5) / 10)) * 0.5;
  }
  return Math.min(1, Math.max(0, proxy));
}

function availabilityScore(
  gamesPlayed: number,
  availabilityWindowYears: number
): number {
  const totalGames = GAMES_PER_SEASON * availabilityWindowYears;
  return Math.min(1, gamesPlayed / totalGames);
}

function contractPenaltyScore(
  salary: number,
  yearsRemaining: number,
  age: number,
  rules: ExpansionRules
): number {
  const { contractPenalty } = rules;
  const normSalary = Math.min(1, salary / 50_000_000);
  const normYears = Math.min(1, yearsRemaining / 5);
  let penalty = normSalary * contractPenalty.salaryWeight + normYears * contractPenalty.yearsWeight;
  if (age >= rules.ageCurve.declineStart) {
    penalty *= 1 + contractPenalty.ageInteractionWeight * (age - rules.ageCurve.declineStart) / 10;
  }
  return Math.min(1, Math.max(0, 1 - penalty));
}

export function computeProtectScore(
  player: PlayerForScoring,
  rules: ExpansionRules,
  seasonYear: number,
  impactMetric: number | null = null
): { score: number; breakdown: ScoreBreakdown } {
  const age = getAgeAtSeasonStart(player.birthdate, seasonYear);
  const w = rules.scoringWeights;

  const impact = impactScore(
    player.overallRating,
    player.minutesPerGame,
    player.starts,
    player.gamesPlayed,
    impactMetric
  );
  const ageSc = ageScore(age, rules.ageCurve);
  const avail = availabilityScore(player.gamesPlayed, rules.availabilityWindowYears);
  const contract = contractPenaltyScore(
    player.salary,
    player.yearsRemaining,
    age,
    rules
  );

  const total =
    impact * w.impact + ageSc * w.age + avail * w.availability + contract * w.contract;

  return {
    score: total,
    breakdown: {
      impact,
      age: ageSc,
      contract,
      availability: avail,
      total,
    },
  };
}

export function getPlayerBadges(player: PlayerForScoring, seasonYear: number): PlayerBadge[] {
  const badges: PlayerBadge[] = [];
  const age = getAgeAtSeasonStart(player.birthdate, seasonYear);

  if (age < 24 && (player.overallRating ?? 0) > 60) badges.push("Young Asset");
  if (player.salary > 25_000_000 && player.yearsRemaining >= 2) badges.push("Bad Contract");
  if (player.gamesPlayed < 41) badges.push("Injury Risk");
  if (player.yearsRemaining <= 0 && !player.hasPlayerOption) badges.push("Expiring");
  if (player.hasPlayerOption || player.hasTeamOption) badges.push("Option Risk");

  return badges;
}
