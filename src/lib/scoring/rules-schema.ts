import { z } from "zod";

/** Team strategy direction – shifts weights and bonus multipliers */
export type TeamDirection = "rebuild" | "neutral" | "contend";

const strategyWeightsSchema = z.object({
  importance: z.number().min(0).max(1),
  age: z.number().min(0).max(1),
  contract: z.number().min(0).max(1),
  accolades: z.number().min(0).max(1),
});

const strategyBonusModifiersSchema = z.object({
  rookie_bump_multiplier: z.number().default(1.0),
  cost_controlled_multiplier: z.number().default(1.0),
  ufa_penalty_multiplier: z.number().default(1.0),
  starter_bonus_additional: z.number().default(0),
});

const strategyProfileSchema = z.object({
  weights: strategyWeightsSchema,
  bonuses: strategyBonusModifiersSchema,
});

/** Zod schema for scoring rules within rules_snapshot_json */
export const scoringRulesSchema = z.object({
  protect_limit_per_team: z.number().int().min(1).default(8),
  scoring_weights: z.object({
    importance: z.number().min(0).max(1).default(0.45),
    age: z.number().min(0).max(1).default(0.25),
    contract: z.number().min(0).max(1).default(0.25),
    accolades: z.number().min(0).max(1).default(0.05),
  }).default({
    importance: 0.45,
    age: 0.25,
    contract: 0.25,
    accolades: 0.05,
  }),
  age_curve: z.object({
    peak_age_start: z.number().default(24),
    peak_age_end: z.number().default(27),
    decline_start: z.number().default(29),
    steep_decline_start: z.number().default(32),
  }).default({
    peak_age_start: 24,
    peak_age_end: 27,
    decline_start: 29,
    steep_decline_start: 32,
  }),
  contract_penalty: z.object({
    salary_weight: z.number().default(2.5),
    years_weight: z.number().default(0.12),
    age_interaction_weight: z.number().default(0.15),
  }).default({
    salary_weight: 2.5,
    years_weight: 0.12,
    age_interaction_weight: 0.15,
  }),
  role_bumps: z.object({
    starter_bonus: z.number().default(5),
    high_minutes_bonus: z.number().default(5),
    minutes_pct_threshold: z.number().min(0).max(1).default(0.8),
    starter_games_pct: z.number().min(0).max(1).default(0.5),
  }).default({
    starter_bonus: 5,
    high_minutes_bonus: 5,
    minutes_pct_threshold: 0.8,
    starter_games_pct: 0.5,
  }),
  accolade_weights: z.object({
    all_star: z.number().default(10),
    ring: z.number().default(12),
  }).default({
    all_star: 10,
    ring: 12,
  }),
  /** Bonus for productive rookies / 2nd-year players */
  rookie_bump: z.object({
    /** Max age to qualify as rookie/sophomore (inclusive) */
    max_age: z.number().default(22),
    /** Maximum bonus points added to final score */
    bonus: z.number().default(10),
    /** Minimum stat percentile (best of pts/ast/reb) to qualify */
    min_stat_pct: z.number().min(0).max(1).default(0.35),
  }).default({
    max_age: 22,
    bonus: 10,
    min_stat_pct: 0.35,
  }),
  /** Bonus for cost-controlled young players (surplus value) */
  cost_controlled_bonus: z.object({
    /** Max age to qualify */
    max_age: z.number().default(25),
    /** Salary must be below this fraction of the cap */
    max_salary_pct: z.number().min(0).max(1).default(0.15),
    /** Maximum bonus points */
    bonus: z.number().default(8),
  }).default({
    max_age: 25,
    max_salary_pct: 0.15,
    bonus: 8,
  }),
  /**
   * Production-adjusted age scoring.
   * Role players (outside top-N in ALL of pts/ast/reb) get a dampened age
   * score — prime-age matters less for replaceable bench pieces. Young role
   * players keep most of their age value plus an upside bonus reflecting
   * the chance they elevate their production next season.
   */
  age_production: z.object({
    /** A player whose best stat rank is worse than this is a "role player" */
    role_player_rank_threshold: z.number().int().min(1).default(10),
    /** Multiplier applied to the raw age score for young (pre-peak) role players */
    young_role_player_factor: z.number().min(0).max(1).default(0.85),
    /** Multiplier applied to the raw age score for prime-or-older role players */
    veteran_role_player_factor: z.number().min(0).max(1).default(0.55),
    /** Max bonus points added for youth upside (scales by how far below peak age) */
    youth_upside_bonus: z.number().min(0).default(15),
  }).default({
    role_player_rank_threshold: 10,
    young_role_player_factor: 0.85,
    veteran_role_player_factor: 0.55,
    youth_upside_bonus: 15,
  }),
  rfa_mode: z.enum(["risk", "simple"]).default("risk"),
  /** How to map raw scores to 0-100 display scores (team-relative) */
  normalization_mode: z.enum(["team_minmax", "team_percentile"]).default("team_minmax"),
  /**
   * Per-direction strategy profiles. If absent, hardcoded defaults are used.
   * Each profile overrides scoring weights and bonus multipliers for that direction.
   */
  strategy_profiles: z.object({
    rebuild: strategyProfileSchema.optional(),
    neutral: strategyProfileSchema.optional(),
    contend: strategyProfileSchema.optional(),
  }).optional(),
}).passthrough();

export type ScoringRules = z.infer<typeof scoringRulesSchema>;

export type StrategyProfile = z.infer<typeof strategyProfileSchema>;
export type BonusModifiers = z.infer<typeof strategyBonusModifiersSchema>;

/** Default hardcoded strategy profiles (used when rules.strategy_profiles is absent) */
export const DEFAULT_STRATEGY_PROFILES: Record<TeamDirection, StrategyProfile> = {
  neutral: {
    weights: { importance: 0.45, age: 0.25, contract: 0.25, accolades: 0.05 },
    bonuses: {
      rookie_bump_multiplier: 1.0,
      cost_controlled_multiplier: 1.0,
      ufa_penalty_multiplier: 1.0,
      starter_bonus_additional: 0,
    },
  },
  rebuild: {
    weights: { importance: 0.38, age: 0.32, contract: 0.28, accolades: 0.02 },
    bonuses: {
      rookie_bump_multiplier: 1.15,
      cost_controlled_multiplier: 1.15,
      ufa_penalty_multiplier: 1.10,
      starter_bonus_additional: 0,
    },
  },
  contend: {
    weights: { importance: 0.52, age: 0.20, contract: 0.23, accolades: 0.05 },
    bonuses: {
      rookie_bump_multiplier: 0.90,
      cost_controlled_multiplier: 0.90,
      ufa_penalty_multiplier: 1.25,
      starter_bonus_additional: 1,
    },
  },
};

export const DEFAULT_SCORING_RULES: ScoringRules = {
  protect_limit_per_team: 8,
  scoring_weights: {
    importance: 0.45,
    age: 0.25,
    contract: 0.25,
    accolades: 0.05,
  },
  age_curve: {
    peak_age_start: 24,
    peak_age_end: 27,
    decline_start: 29,
    steep_decline_start: 32,
  },
  contract_penalty: {
    salary_weight: 2.5,
    years_weight: 0.12,
    age_interaction_weight: 0.15,
  },
  role_bumps: {
    starter_bonus: 5,
    high_minutes_bonus: 5,
    minutes_pct_threshold: 0.8,
    starter_games_pct: 0.5,
  },
  accolade_weights: {
    all_star: 10,
    ring: 12,
  },
  rookie_bump: {
    max_age: 22,
    bonus: 10,
    min_stat_pct: 0.35,
  },
  cost_controlled_bonus: {
    max_age: 25,
    max_salary_pct: 0.15,
    bonus: 8,
  },
  age_production: {
    role_player_rank_threshold: 10,
    young_role_player_factor: 0.85,
    veteran_role_player_factor: 0.55,
    youth_upside_bonus: 15,
  },
  rfa_mode: "risk",
  normalization_mode: "team_minmax",
  strategy_profiles: undefined,
};

function mapKeysToSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snake] = v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
      ? mapKeysToSnakeCase(v as Record<string, unknown>)
      : v;
  }
  return result;
}

/** Map legacy camelCase keys from ExpansionRules to our scoring shape */
function normalizeRulesJson(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") return obj;
  const o = obj as Record<string, unknown>;
  const protectLimit =
    o.protect_limit_per_team ?? o.protectLimitPerTeam ?? DEFAULT_SCORING_RULES.protect_limit_per_team;
  const scoringWeightsRaw = o.scoring_weights ?? o.scoringWeights;
  const ageCurveRaw = o.age_curve ?? o.ageCurve;
  const contractPenaltyRaw = o.contract_penalty ?? o.contractPenalty;
  const rfaMode = o.rfa_mode ?? o.rfaMode ?? DEFAULT_SCORING_RULES.rfa_mode;
  const scoringWeights = scoringWeightsRaw && typeof scoringWeightsRaw === "object"
    ? (() => {
        const m = mapKeysToSnakeCase(scoringWeightsRaw as Record<string, unknown>);
        return {
          importance: m.importance ?? m.impact ?? DEFAULT_SCORING_RULES.scoring_weights.importance,
          age: m.age ?? DEFAULT_SCORING_RULES.scoring_weights.age,
          contract: m.contract ?? DEFAULT_SCORING_RULES.scoring_weights.contract,
          accolades: m.accolades ?? m.availability ?? DEFAULT_SCORING_RULES.scoring_weights.accolades,
        };
      })()
    : DEFAULT_SCORING_RULES.scoring_weights;
  const ageCurve = ageCurveRaw && typeof ageCurveRaw === "object"
    ? (() => {
        const m = ageCurveRaw as Record<string, unknown>;
        return {
          peak_age_start: m.peak_age_start ?? m.peakAgeStart ?? DEFAULT_SCORING_RULES.age_curve.peak_age_start,
          peak_age_end: m.peak_age_end ?? m.peakAgeEnd ?? DEFAULT_SCORING_RULES.age_curve.peak_age_end,
          decline_start: m.decline_start ?? m.declineStart ?? DEFAULT_SCORING_RULES.age_curve.decline_start,
          steep_decline_start: m.steep_decline_start ?? m.steepDeclineStart ?? DEFAULT_SCORING_RULES.age_curve.steep_decline_start,
        };
      })()
    : DEFAULT_SCORING_RULES.age_curve;
  const contractPenalty = contractPenaltyRaw && typeof contractPenaltyRaw === "object"
    ? (() => {
        const m = contractPenaltyRaw as Record<string, unknown>;
        return {
          salary_weight: m.salary_weight ?? m.salaryWeight ?? DEFAULT_SCORING_RULES.contract_penalty.salary_weight,
          years_weight: m.years_weight ?? m.yearsWeight ?? DEFAULT_SCORING_RULES.contract_penalty.years_weight,
          age_interaction_weight: m.age_interaction_weight ?? m.ageInteractionWeight ?? DEFAULT_SCORING_RULES.contract_penalty.age_interaction_weight,
        };
      })()
    : DEFAULT_SCORING_RULES.contract_penalty;
  return {
    protect_limit_per_team: protectLimit,
    scoring_weights: scoringWeights,
    age_curve: ageCurve,
    contract_penalty: contractPenalty,
    role_bumps: o.role_bumps ?? DEFAULT_SCORING_RULES.role_bumps,
    accolade_weights: o.accolade_weights ?? DEFAULT_SCORING_RULES.accolade_weights,
    rookie_bump: o.rookie_bump ?? o.rookieBump ?? DEFAULT_SCORING_RULES.rookie_bump,
    cost_controlled_bonus: o.cost_controlled_bonus ?? o.costControlledBonus ?? DEFAULT_SCORING_RULES.cost_controlled_bonus,
    age_production: o.age_production ?? o.ageProduction ?? DEFAULT_SCORING_RULES.age_production,
    rfa_mode: rfaMode,
    normalization_mode: o.normalization_mode ?? "team_minmax",
    strategy_profiles: o.strategy_profiles ?? undefined,
  };
}

export function parseScoringRules(rulesJson: unknown): ScoringRules {
  const normalized = normalizeRulesJson(rulesJson);
  const parsed = scoringRulesSchema.safeParse(normalized);
  if (parsed.success) return parsed.data;
  return { ...DEFAULT_SCORING_RULES, ...(typeof normalized === "object" && normalized !== null ? normalized : {}) };
}
