/**
 * Protection list scoring algorithm.
 * Computes team-relative ranks at runtime; does NOT persist ranks to DB.
 */

import {
  parseScoringRules,
  type ScoringRules,
  type TeamDirection,
  type BonusModifiers,
  DEFAULT_STRATEGY_PROFILES,
} from "./rules-schema";

const SEASON_START_MONTH = 7; // July
const SEASON_START_DAY = 1;

export interface RosterPlayerForScoring {
  playerId: string;
  firstName: string;
  lastName: string;
  birthdate: Date;
  primaryPosition: string;
  // metrics
  gamesPlayed: number;
  minutesPerGame: number;
  starts: number;
  pointsPerGame: number;
  assistsPerGame: number;
  reboundsPerGame: number;
  overallRating: number | null;
  // contract (optional)
  salary?: number;
  yearsRemaining?: number;
  hasPlayerOption?: boolean;
  hasTeamOption?: boolean;
  isUFAAfterSeason?: boolean;
  isRFAAfterSeason?: boolean;
  // accolades (optional)
  allStarAppearances?: number;
  championships?: number;
}

export interface TeamRanks {
  pts_rank: number;
  ast_rank: number;
  reb_rank: number;
  pts_pct: number;
  ast_pct: number;
  reb_pct: number;
  minutes_pct: number;
}

export interface ScoreBreakdown {
  importance: number;
  age_value: number;
  age_value_raw: number;
  contract_value: number;
  accolades: number;
  team_ranks: TeamRanks;
  inputs: {
    age: number;
    salary?: number;
    years_remaining?: number;
    ppg: number;
    apg: number;
    rpg: number;
    games_played: number;
    starts: number;
  };
  flags: string[];
  team_direction: TeamDirection;
  weights_used: { importance: number; age: number; contract: number; accolades: number };
  bonus_modifiers: BonusModifiers;
}

export type ScoreResult = {
  /** Raw algorithmic score (0-100). Use this for sorting and protection selection. */
  protect_score: number;
  protect_score_raw: number;
  breakdown: ScoreBreakdown;
};

/** Age at July 1 of season year */
export function getAgeAtSeasonStart(birthdate: Date, seasonYear: number): number {
  const seasonStart = new Date(seasonYear, SEASON_START_MONTH - 1, SEASON_START_DAY);
  let age = seasonStart.getFullYear() - birthdate.getFullYear();
  const m = seasonStart.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && seasonStart.getDate() < birthdate.getDate())) age--;
  return age;
}

/** Compute team-relative rank and percentile for a stat. Higher stat = rank 1 = 100th percentile. */
function computeRankAndPercentile(
  roster: RosterPlayerForScoring[],
  getStat: (p: RosterPlayerForScoring) => number,
  tieBreaker: (p: RosterPlayerForScoring) => number
): Map<string, { rank: number; pct: number }> {
  const sorted = [...roster].sort((a, b) => {
    const sa = getStat(a);
    const sb = getStat(b);
    if (sb !== sa) return sb - sa;
    return tieBreaker(b) - tieBreaker(a);
  });
  const n = roster.length;
  const result = new Map<string, { rank: number; pct: number }>();
  sorted.forEach((p, i) => {
    const rank = i + 1;
    const pct = n === 1 ? 1 : 1 - (rank - 1) / (n - 1);
    result.set(p.playerId, { rank, pct });
  });
  return result;
}

/**
 * Age value score 0-100 using a smoother piecewise curve.
 *
 * The curve models expansion-draft logic: youth has enormous surplus value
 * (cheap contracts, years of control), prime is peak, and older players
 * drop off aggressively because teams prefer to expose aging contracts.
 *
 * | Age   | Score | Rationale                              |
 * |-------|-------|----------------------------------------|
 * | <=19  |  60   | Raw prospect, unproven                 |
 * | 20-23 |  60→100 (linear ramp toward peak)            |
 * | 24-27 | 100   | Prime window                           |
 * | 28    |  92   | Late prime, still very valuable         |
 * | 29    |  80   | Early decline, starting to slip         |
 * | 30    |  68   | Decline accelerating                   |
 * | 31    |  55   | Clearly past prime                     |
 * | 32    |  45   | Steep decline zone                     |
 * | 33    |  35   | Likely exposed                         |
 * | 34    |  25   | Almost certainly exposed                |
 * | 35+   |  15   | End-of-career, minimal protect value   |
 */
export function ageValueScore(age: number, curve: ScoringRules["age_curve"]): number {
  // Peak window
  if (age >= curve.peak_age_start && age <= curve.peak_age_end) return 100;

  // Pre-peak: linear ramp from 60 (age 19) to 100 (peak_age_start)
  if (age < curve.peak_age_start) {
    if (age <= 19) return 60;
    const t = (age - 19) / (curve.peak_age_start - 19);
    return 60 + t * 40; // 60 → 100
  }

  // Post-peak: smooth decline using fixed age breakpoints
  // Late prime (peak_age_end+1 to decline_start-1)
  if (age === curve.peak_age_end + 1) return 92;

  // Early decline (decline_start to steep_decline_start-1)
  if (age >= curve.decline_start && age < curve.steep_decline_start) {
    // Linear from 80 at decline_start to 55 at steep_decline_start-1
    const span = curve.steep_decline_start - curve.decline_start;
    const t = span > 0 ? (age - curve.decline_start) / span : 0;
    return Math.round(80 - t * 25); // 80 → 55
  }

  // Steep decline (steep_decline_start to 34)
  if (age >= curve.steep_decline_start && age <= 34) {
    const t = (age - curve.steep_decline_start) / Math.max(1, 34 - curve.steep_decline_start);
    return Math.round(45 - t * 20); // 45 → 25
  }

  // 35+
  return 15;
}

/**
 * Adjust the raw age score based on the player's production role on the team.
 *
 * Role players (best stat rank worse than threshold in ALL of pts/ast/reb)
 * get a dampened age score — being 25 matters a lot less when you're the
 * 12th man. Young role players keep most of their value plus an upside
 * bonus reflecting the chance they break out next season.
 */
function productionAdjustedAgeScore(
  rawAgeScore: number,
  age: number,
  bestStatRank: number,
  rules: ScoringRules
): { score: number; applied: boolean } {
  const cfg = rules.age_production;
  if (bestStatRank <= cfg.role_player_rank_threshold) {
    return { score: rawAgeScore, applied: false };
  }

  if (age < rules.age_curve.peak_age_start) {
    // Young role player: mild dampening + youth upside that scales with
    // how far below peak age they are (age 19 gets full bonus, peak-1 gets ~0).
    const ageFraction = (rules.age_curve.peak_age_start - age)
      / Math.max(1, rules.age_curve.peak_age_start - 19);
    const upside = cfg.youth_upside_bonus * ageFraction;
    return {
      score: Math.min(100, rawAgeScore * cfg.young_role_player_factor + upside),
      applied: true,
    };
  }

  // Prime-age or older role player: significant dampening
  return { score: rawAgeScore * cfg.veteran_role_player_factor, applied: true };
}

/** Importance score 0-100 from pts/ast/reb percentiles + role bumps */
function importanceScore(
  p: RosterPlayerForScoring,
  ptsPct: number,
  astPct: number,
  rebPct: number,
  minutesPct: number,
  rules: ScoringRules,
  starterBonusAdditional: number
): { score: number; flags: string[] } {
  const flags: string[] = [];
  const rb = rules.role_bumps;
  let score =
    100 * (0.45 * ptsPct + 0.35 * astPct + 0.2 * rebPct);
  const isStarter = p.gamesPlayed > 0 && p.starts >= rb.starter_games_pct * p.gamesPlayed;
  if (isStarter) {
    score += rb.starter_bonus + starterBonusAdditional;
    flags.push("Starter");
  }
  if (minutesPct >= rb.minutes_pct_threshold) {
    score += rb.high_minutes_bonus;
    flags.push("HighMinutes");
  }
  return { score: Math.min(100, Math.max(0, score)), flags };
}

/** Contract value score 0-100 (higher = better contract) */
function contractValueScore(
  p: RosterPlayerForScoring,
  age: number,
  salaryCap: number,
  rules: ScoringRules,
  ufaPenaltyMultiplier: number
): { score: number; flags: string[] } {
  const flags: string[] = [];
  if (p.salary == null && p.yearsRemaining == null) {
    return { score: 50, flags };
  }
  const salary = p.salary ?? 0;
  const years = p.yearsRemaining ?? 0;
  const cp = rules.contract_penalty;
  const salaryPctOfCap = salaryCap > 0 ? salary / salaryCap : 0;
  const burdenRaw =
    salaryPctOfCap * cp.salary_weight +
    years * cp.years_weight +
    Math.max(0, age - 30) * cp.age_interaction_weight;
  const burden = Math.min(1, Math.max(0, burdenRaw)) * 100;
  let score = 100 - burden;
  if (p.hasPlayerOption) {
    score -= 10;
    flags.push("OptionRisk");
  }
  if (p.isUFAAfterSeason) {
    score -= 5 * ufaPenaltyMultiplier;
    flags.push("UFA");
  }
  if (p.isRFAAfterSeason && rules.rfa_mode === "risk") {
    score -= 3;
    flags.push("RFA_Risk");
  }
  return { score: Math.min(100, Math.max(0, score)), flags };
}

/** Accolades score 0-100 */
function accoladesScore(
  p: RosterPlayerForScoring,
  rules: ScoringRules
): number {
  const as = p.allStarAppearances ?? 0;
  const ch = p.championships ?? 0;
  const aw = rules.accolade_weights;
  return Math.min(100, as * aw.all_star + ch * aw.ring);
}

/**
 * Rookie / sophomore bump.
 * A young player (age <= max_age) who is already producing at a meaningful
 * level relative to their team gets a bonus that scales with their best
 * stat percentile.  A rookie ranked #7 in PPG on a 15-man roster (~53rd
 * percentile) would get roughly 0.53 * bonus ≈ 5.3 extra points.
 */
function rookieBumpScore(
  age: number,
  ptsPct: number,
  astPct: number,
  rebPct: number,
  rules: ScoringRules,
  multiplier: number
): { bonus: number; applied: boolean } {
  const rb = rules.rookie_bump;
  if (age > rb.max_age) return { bonus: 0, applied: false };
  const bestPct = Math.max(ptsPct, astPct, rebPct);
  if (bestPct < rb.min_stat_pct) return { bonus: 0, applied: false };
  // Scale bonus linearly from 0 at min_stat_pct to full bonus at 1.0
  const scale = (bestPct - rb.min_stat_pct) / (1 - rb.min_stat_pct);
  return { bonus: rb.bonus * scale * multiplier, applied: true };
}

/**
 * Cost-controlled young player bonus (surplus value).
 * Players under max_age earning less than max_salary_pct of the cap
 * get up to +bonus points.  Scales inversely with salary -- the cheaper
 * the player, the larger the surplus value.
 */
function costControlledBonus(
  age: number,
  salary: number | undefined,
  salaryCap: number,
  rules: ScoringRules,
  multiplier: number
): { bonus: number; applied: boolean } {
  const cc = rules.cost_controlled_bonus;
  if (age > cc.max_age) return { bonus: 0, applied: false };
  if (salary == null || salaryCap <= 0) return { bonus: 0, applied: false };
  const salaryPct = salary / salaryCap;
  if (salaryPct >= cc.max_salary_pct) return { bonus: 0, applied: false };
  // Full bonus at 0% of cap, linearly decreasing to 0 at max_salary_pct
  const scale = 1 - salaryPct / cc.max_salary_pct;
  return { bonus: cc.bonus * scale * multiplier, applied: true };
}

/**
 * Resolve the strategy profile for a given team direction.
 * Falls back to hardcoded defaults when not present in rules snapshot.
 */
function resolveStrategyProfile(
  rules: ScoringRules,
  direction: TeamDirection
): { weights: ScoringRules["scoring_weights"]; bonuses: BonusModifiers } {
  const profileFromRules = rules.strategy_profiles?.[direction];
  if (profileFromRules) {
    return profileFromRules;
  }
  return DEFAULT_STRATEGY_PROFILES[direction];
}

/** Compute protect score for a single player */
export function computeProtectScoreForPlayer(
  p: RosterPlayerForScoring,
  ranks: Map<string, TeamRanks>,
  salaryCap: number,
  seasonYear: number,
  rules: ScoringRules,
  teamDirection: TeamDirection = "neutral"
): ScoreResult {
  const age = getAgeAtSeasonStart(p.birthdate, seasonYear);
  const tr = ranks.get(p.playerId)!;

  const { weights, bonuses } = resolveStrategyProfile(rules, teamDirection);

  const imp = importanceScore(
    p,
    tr.pts_pct,
    tr.ast_pct,
    tr.reb_pct,
    tr.minutes_pct,
    rules,
    bonuses.starter_bonus_additional
  );
  const rawAgeSc = ageValueScore(age, rules.age_curve);
  const bestStatRank = Math.min(tr.pts_rank, tr.ast_rank, tr.reb_rank);
  const ageAdj = productionAdjustedAgeScore(rawAgeSc, age, bestStatRank, rules);
  const ageSc = ageAdj.score;
  const contractRes = contractValueScore(p, age, salaryCap, rules, bonuses.ufa_penalty_multiplier);
  const accoladeSc = accoladesScore(p, rules);

  // Combine component scores using direction-specific weights
  let protectScore =
    weights.importance * imp.score +
    weights.age * ageSc +
    weights.contract * contractRes.score +
    weights.accolades * accoladeSc;

  const allFlags = [...imp.flags, ...contractRes.flags];
  if (ageAdj.applied) {
    allFlags.push("AgeProductionAdj");
  }

  // Rookie / sophomore bump: productive young players get a bonus
  const rookie = rookieBumpScore(
    age, tr.pts_pct, tr.ast_pct, tr.reb_pct,
    rules, bonuses.rookie_bump_multiplier
  );
  if (rookie.applied) {
    protectScore += rookie.bonus;
    allFlags.push("RookieBump");
  }

  // Cost-controlled bonus: young players on cheap deals have surplus value
  const cc = costControlledBonus(
    age, p.salary, salaryCap,
    rules, bonuses.cost_controlled_multiplier
  );
  if (cc.applied) {
    protectScore += cc.bonus;
    allFlags.push("CostControlled");
  }

  // Guardrail: top-3 importance and young -> min 65
  const top3Importance = tr.pts_pct >= 0.75 || tr.pts_rank <= 3 || tr.ast_rank <= 3 || tr.reb_rank <= 3;
  if (top3Importance && age < 30) {
    protectScore = Math.max(protectScore, 65);
  }

  const rawScore = Math.min(100, Math.max(0, protectScore));

  return {
    protect_score: rawScore,
    protect_score_raw: rawScore,
    breakdown: {
      importance: imp.score,
      age_value: ageSc,
      age_value_raw: rawAgeSc,
      contract_value: contractRes.score,
      accolades: accoladeSc,
      team_ranks: tr,
      inputs: {
        age,
        salary: p.salary,
        years_remaining: p.yearsRemaining,
        ppg: p.pointsPerGame,
        apg: p.assistsPerGame,
        rpg: p.reboundsPerGame,
        games_played: p.gamesPlayed,
        starts: p.starts,
      },
      flags: allFlags,
      team_direction: teamDirection,
      weights_used: weights,
      bonus_modifiers: bonuses,
    },
  };
}

/** Compute team-relative ranks for entire roster (in-memory only) */
export function computeTeamRanks(roster: RosterPlayerForScoring[]): Map<string, TeamRanks> {
  const byMinutes = computeRankAndPercentile(roster, (p) => p.minutesPerGame, () => 0);
  const byPts = computeRankAndPercentile(roster, (p) => p.pointsPerGame, (p) => p.minutesPerGame);
  const byAst = computeRankAndPercentile(roster, (p) => p.assistsPerGame, (p) => p.minutesPerGame);
  const byReb = computeRankAndPercentile(roster, (p) => p.reboundsPerGame, (p) => p.minutesPerGame);

  const result = new Map<string, TeamRanks>();
  for (const p of roster) {
    const pts = byPts.get(p.playerId)!;
    const ast = byAst.get(p.playerId)!;
    const reb = byReb.get(p.playerId)!;
    const min = byMinutes.get(p.playerId)!;
    result.set(p.playerId, {
      pts_rank: pts.rank,
      ast_rank: ast.rank,
      reb_rank: reb.rank,
      pts_pct: pts.pct,
      ast_pct: ast.pct,
      reb_pct: reb.pct,
      minutes_pct: min.pct,
    });
  }
  return result;
}

export interface ScoreRosterResult {
  scored: Array<{ player: RosterPlayerForScoring; result: ScoreResult }>;
  protectedPlayerIds: Set<string>;
}

/** Score entire roster and optionally apply position sanity (swap in C/PG if needed) */
export function scoreRoster(
  roster: RosterPlayerForScoring[],
  salaryCap: number,
  seasonYear: number,
  rulesJson: unknown,
  teamDirection: TeamDirection = "neutral"
): ScoreRosterResult {
  const rules = parseScoringRules(rulesJson);
  const ranks = computeTeamRanks(roster);
  const scored = roster.map((p) => ({
    player: p,
    result: computeProtectScoreForPlayer(p, ranks, salaryCap, seasonYear, rules, teamDirection),
  }));

  scored.sort((a, b) => b.result.protect_score_raw - a.result.protect_score_raw);

  const protectLimit = rules.protect_limit_per_team;
  const protectedIds = new Set(scored.slice(0, protectLimit).map((s) => s.player.playerId));

  // Position sanity: if no C protected but team has C with mpg>12, swap in highest-scoring C
  const getPlayerById = (id: string) => roster.find((p) => p.playerId === id);
  if (roster.some((p) => p.primaryPosition === "C" && p.minutesPerGame > 12)) {
    const protectedC = [...protectedIds].some((id) => getPlayerById(id)?.primaryPosition === "C");
    if (!protectedC) {
      const bestC = scored.find((s) => s.player.primaryPosition === "C" && s.player.minutesPerGame > 12 && !protectedIds.has(s.player.playerId));
      const lowestProtected = scored.filter((s) => protectedIds.has(s.player.playerId)).pop();
      if (bestC && lowestProtected && lowestProtected.player.primaryPosition !== "PG") {
        protectedIds.delete(lowestProtected.player.playerId);
        protectedIds.add(bestC.player.playerId);
      }
    }
  }
  if (roster.some((p) => p.primaryPosition === "PG" && p.minutesPerGame > 12)) {
    const protectedPG = [...protectedIds].some((id) => getPlayerById(id)?.primaryPosition === "PG");
    if (!protectedPG) {
      const bestPG = scored.find((s) => s.player.primaryPosition === "PG" && s.player.minutesPerGame > 12 && !protectedIds.has(s.player.playerId));
      const lowestProtected = scored.filter((s) => protectedIds.has(s.player.playerId)).pop();
      if (bestPG && lowestProtected) {
        protectedIds.delete(lowestProtected.player.playerId);
        protectedIds.add(bestPG.player.playerId);
      }
    }
  }

  return { scored, protectedPlayerIds: protectedIds };
}
