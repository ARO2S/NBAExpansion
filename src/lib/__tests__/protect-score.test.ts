import { describe, it, expect } from "vitest";
import {
  computeProtectScore,
  getAgeAtSeasonStart,
  getPlayerBadges,
} from "../protect-score";
import type { ExpansionRules } from "../rules-schema";

const defaultRules: ExpansionRules = {
  protectLimitPerTeam: 8,
  eachExistingTeamCanLoseMax: 1,
  maxSelectedFromSameTeamTotal: 1,
  expansionDraftMinPicks: 14,
  expansionDraftMaxPicks: 30,
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
};

describe("protect-score", () => {
  it("computes age at season start", () => {
    const birthdate = new Date(2000, 5, 15);
    expect(getAgeAtSeasonStart(birthdate, 2024)).toBe(24);
    expect(getAgeAtSeasonStart(birthdate, 2025)).toBe(25);
  });

  it("computes protect score for a good young player", () => {
    const player = {
      birthdate: new Date(1998, 3, 1),
      overallRating: 85,
      minutesPerGame: 32,
      starts: 82,
      gamesPlayed: 78,
      salary: 5_000_000,
      yearsRemaining: 2,
      hasPlayerOption: false,
      hasTeamOption: false,
      isUFAAfterSeason: false,
      isRFAAfterSeason: false,
    };
    const { score } = computeProtectScore(player, defaultRules, 2024);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("computes protect score for an expensive vet", () => {
    const player = {
      birthdate: new Date(1988, 0, 1),
      overallRating: 65,
      minutesPerGame: 20,
      starts: 10,
      gamesPlayed: 60,
      salary: 35_000_000,
      yearsRemaining: 3,
      hasPlayerOption: false,
      hasTeamOption: false,
      isUFAAfterSeason: false,
      isRFAAfterSeason: false,
    };
    const { score } = computeProtectScore(player, defaultRules, 2024);
    expect(score).toBeLessThan(0.7);
  });

  it("returns badges for player traits", () => {
    const youngAsset = {
      birthdate: new Date(2002, 0, 1),
      overallRating: 70,
      minutesPerGame: 25,
      starts: 20,
      gamesPlayed: 70,
      salary: 3_000_000,
      yearsRemaining: 1,
      hasPlayerOption: false,
      hasTeamOption: false,
      isUFAAfterSeason: false,
      isRFAAfterSeason: false,
    };
    const badges = getPlayerBadges(youngAsset, 2024);
    expect(badges).toContain("Young Asset");

    const expiring = {
      ...youngAsset,
      yearsRemaining: 0,
      hasPlayerOption: false,
    };
    expect(getPlayerBadges(expiring, 2024)).toContain("Expiring");

    const optionRisk = {
      ...youngAsset,
      hasPlayerOption: true,
    };
    expect(getPlayerBadges(optionRisk, 2024)).toContain("Option Risk");
  });
});
