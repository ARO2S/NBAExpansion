import { describe, it, expect } from "vitest";
import { validateDraftPick, getCapFloorWarnings } from "../draft-constraints";
import type { ExpansionRules } from "../rules-schema";
import type { ExposedPlayer } from "../eligibility";

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
  scoringWeights: { impact: 0.45, age: 0.2, contract: 0.25, availability: 0.1 },
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

const pool: ExposedPlayer[] = [
  {
    playerId: "p1",
    teamId: "t1",
    contractId: "c1",
    salary: 10_000_000,
    yearsRemaining: 2,
    hasPlayerOption: false,
    hasTeamOption: false,
    isUFAAfterSeason: false,
    isRFAAfterSeason: false,
    isProtected: false,
  },
  {
    playerId: "p2",
    teamId: "t2",
    contractId: "c2",
    salary: 5_000_000,
    yearsRemaining: 1,
    hasPlayerOption: false,
    hasTeamOption: false,
    isUFAAfterSeason: false,
    isRFAAfterSeason: false,
    isProtected: false,
  },
];

describe("draft-constraints", () => {
  it("allows valid pick", () => {
    const err = validateDraftPick(
      "p1",
      "t1",
      "et1",
      pool,
      new Set(),
      0,
      defaultRules,
      1
    );
    expect(err).toBeNull();
  });

  it("rejects pick when player not in pool", () => {
    const err = validateDraftPick(
      "p99",
      "t1",
      "et1",
      pool,
      new Set(),
      0,
      defaultRules,
      1
    );
    expect(err).not.toBeNull();
    expect(err?.type).toBe("player_unavailable");
  });

  it("rejects pick when team already lost player", () => {
    const err = validateDraftPick(
      "p2",
      "t2",
      "et1",
      pool,
      new Set(["t2"]),
      0,
      defaultRules,
      1
    );
    expect(err).not.toBeNull();
    expect(err?.type).toBe("team_already_lost");
  });

  it("computes cap/floor warnings", () => {
    const cap = 100_000_000;
    const { overCap, underFloor } = getCapFloorWarnings(
      95_000_000,
      cap,
      defaultRules
    );
    expect(overCap).toBe(false);
    expect(underFloor).toBe(false);

    const { overCap: oc2 } = getCapFloorWarnings(110_000_000, cap, defaultRules);
    expect(oc2).toBe(true);

    const floor = cap * defaultRules.salaryFloorPct;
    const { underFloor: uf2 } = getCapFloorWarnings(
      floor - 1_000_000,
      cap,
      defaultRules
    );
    expect(uf2).toBe(true);
  });
});
