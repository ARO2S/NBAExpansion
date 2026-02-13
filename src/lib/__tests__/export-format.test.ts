import { describe, it, expect } from "vitest";
import {
  formatTextExport,
  formatTextContractsExport,
} from "../export-format";
import type { ExpansionRules } from "../rules-schema";

const mockRules: ExpansionRules = {
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

const mockCtx = {
  runName: "Test Draft",
  runDate: "February 11, 2025",
  picks: [
    {
      pickNumber: 1,
      playerName: "John Smith",
      position: "PG",
      age: 25,
      rating: 82,
      salary: 10_000_000,
      yearsRemaining: 3,
      hasPlayerOption: false,
      hasTeamOption: false,
      isUFA: false,
      isRFA: false,
      fromTeam: "Boston Celtics",
    },
    {
      pickNumber: 2,
      playerName: "Jane Doe",
      position: "SF",
      age: 28,
      fromTeam: "LA Lakers",
    },
  ],
  expansionTeamName: "Seattle SuperSonics",
  totalSalary: 25_000_000,
  expansionCap: 93_380_000,
  salaryFloor: 84_042_000,
  rules: mockRules,
};

describe("export-format", () => {
  it("formats text export with header and roster", () => {
    const out = formatTextExport(mockCtx);
    expect(out).toContain("NBA EXPANSION DRAFT: Test Draft");
    expect(out).toContain("Date: February 11, 2025");
    expect(out).toContain("--- Seattle SuperSonics Roster ---");
    expect(out).toContain("PGs:");
    expect(out).toContain("1. John Smith (Boston Celtics)");
    expect(out).toContain("SFs:");
    expect(out).toContain("2. Jane Doe (LA Lakers)");
    expect(out).toContain("Total picks: 2");
  });

  it("formats text+contracts export with salary info", () => {
    const out = formatTextContractsExport(mockCtx);
    expect(out).toContain("NBA EXPANSION DRAFT: Test Draft");
    expect(out).toContain("John Smith");
    expect(out).toContain("$10.00M");
    expect(out).toContain("3 yrs");
    expect(out).toContain("--- Cap Summary ---");
    expect(out).toContain("Total Salary: $25.00M");
    expect(out).toContain("Expansion Cap:  $93.38M");
  });
});
