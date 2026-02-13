import { z } from "zod";

export const scoringWeightsSchema = z.object({
  impact: z.number().min(0).max(1),
  age: z.number().min(0).max(1),
  contract: z.number().min(0).max(1),
  availability: z.number().min(0).max(1),
});

export const ageCurveSchema = z.object({
  peakAgeStart: z.number(),
  peakAgeEnd: z.number(),
  declineStart: z.number(),
  steepDeclineStart: z.number(),
});

export const contractPenaltySchema = z.object({
  salaryWeight: z.number(),
  yearsWeight: z.number(),
  ageInteractionWeight: z.number(),
});

export const expansionRulesSchema = z.object({
  protectLimitPerTeam: z.number().int().min(1),
  eachExistingTeamCanLoseMax: z.number().int().min(1),
  maxSelectedFromSameTeamTotal: z.number().int().min(1),
  expansionDraftMinPicks: z.number().int().min(1),
  expansionDraftMaxPicks: z.number().int().min(1),
  uFAExemptFromProtection: z.boolean(),
  allowDraftingPlayersWithOptions: z.boolean(),
  rfaMode: z.enum(["risk", "simple"]),
  expansionCapPctYear1: z.number().min(0).max(1),
  expansionCapPctYear2: z.number().min(0).max(1),
  salaryFloorPct: z.number().min(0).max(1),
  scoringWeights: scoringWeightsSchema,
  ageCurve: ageCurveSchema,
  contractPenalty: contractPenaltySchema,
  availabilityWindowYears: z.number().int().min(1),
  positionalBalanceWarnings: z.boolean(),
});

export type ExpansionRules = z.infer<typeof expansionRulesSchema>;
export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;

export const RULES_PRESETS: Record<string, ExpansionRules> = {
  "1995-style": {
    protectLimitPerTeam: 8,
    eachExistingTeamCanLoseMax: 1,
    maxSelectedFromSameTeamTotal: 1,
    expansionDraftMinPicks: 14,
    expansionDraftMaxPicks: 27,
    uFAExemptFromProtection: true,
    allowDraftingPlayersWithOptions: true,
    rfaMode: "risk",
    expansionCapPctYear1: 0.667,
    expansionCapPctYear2: 0.8,
    salaryFloorPct: 0.9,
    scoringWeights: {
      impact: 0.45,
      age: 0.2,
      contract: 0.25,
      availability: 0.1,
    },
    ageCurve: {
      peakAgeStart: 24,
      peakAgeEnd: 30,
      declineStart: 31,
      steepDeclineStart: 34,
    },
    contractPenalty: {
      salaryWeight: 0.4,
      yearsWeight: 0.4,
      ageInteractionWeight: 0.2,
    },
    availabilityWindowYears: 2,
    positionalBalanceWarnings: true,
  },
  "2004-style": {
    protectLimitPerTeam: 8,
    eachExistingTeamCanLoseMax: 1,
    maxSelectedFromSameTeamTotal: 1,
    expansionDraftMinPicks: 14,
    expansionDraftMaxPicks: 28,
    uFAExemptFromProtection: true,
    allowDraftingPlayersWithOptions: true,
    rfaMode: "simple",
    expansionCapPctYear1: 0.667,
    expansionCapPctYear2: 0.8,
    salaryFloorPct: 0.9,
    scoringWeights: {
      impact: 0.45,
      age: 0.2,
      contract: 0.25,
      availability: 0.1,
    },
    ageCurve: {
      peakAgeStart: 24,
      peakAgeEnd: 30,
      declineStart: 31,
      steepDeclineStart: 34,
    },
    contractPenalty: {
      salaryWeight: 0.4,
      yearsWeight: 0.4,
      ageInteractionWeight: 0.2,
    },
    availabilityWindowYears: 2,
    positionalBalanceWarnings: true,
  },
  custom: {
    ...{
      protectLimitPerTeam: 8,
      eachExistingTeamCanLoseMax: 1,
      maxSelectedFromSameTeamTotal: 1,
      expansionDraftMinPicks: 14,
      expansionDraftMaxPicks: 30,
      uFAExemptFromProtection: true,
      allowDraftingPlayersWithOptions: true,
      rfaMode: "risk" as const,
      expansionCapPctYear1: 0.667,
      expansionCapPctYear2: 0.8,
      salaryFloorPct: 0.9,
      scoringWeights: {
        impact: 0.45,
        age: 0.2,
        contract: 0.25,
        availability: 0.1,
      },
      ageCurve: {
        peakAgeStart: 24,
        peakAgeEnd: 30,
        declineStart: 31,
        steepDeclineStart: 34,
      },
      contractPenalty: {
        salaryWeight: 0.4,
        yearsWeight: 0.4,
        ageInteractionWeight: 0.2,
      },
      availabilityWindowYears: 2,
      positionalBalanceWarnings: true,
    },
  },
};
