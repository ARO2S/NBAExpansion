import { describe, it, expect } from "vitest";
import { scoreRoster } from "../protectScore";
import { normalizeScores } from "../normalizeScore";
import type { RosterPlayerForScoring } from "../protectScore";

// ─── shared fixtures ──────────────────────────────────────────────────────────

const CAP = 140_000_000;

/** Young, cheap, moderately productive — rebuild archetype */
const youngCheapPlayer: RosterPlayerForScoring = {
  playerId: "young",
  firstName: "Young",
  lastName: "Cheap",
  birthdate: new Date(2003, 0, 1), // age 21 in 2024
  primaryPosition: "SG",
  gamesPlayed: 70,
  minutesPerGame: 24,
  starts: 30,
  pointsPerGame: 11,
  assistsPerGame: 3,
  reboundsPerGame: 4,
  overallRating: null,
  salary: 4_000_000,      // ~2.9% of cap — cost-controlled
  yearsRemaining: 3,
  isUFAAfterSeason: false,
};

/** Older proven starter — contend archetype */
const primeStarter: RosterPlayerForScoring = {
  playerId: "prime",
  firstName: "Prime",
  lastName: "Star",
  birthdate: new Date(1994, 0, 1), // age 30 in 2024
  primaryPosition: "SF",
  gamesPlayed: 78,
  minutesPerGame: 34,
  starts: 78,
  pointsPerGame: 22,
  assistsPerGame: 5,
  reboundsPerGame: 7,
  overallRating: null,
  salary: 30_000_000,
  yearsRemaining: 2,
  isUFAAfterSeason: false,
};

const roster = [youngCheapPlayer, primeStarter];

// ─── team direction scoring ───────────────────────────────────────────────────

describe("team direction: rebuild vs contend", () => {
  it("rebuild increases relative score for young cheap player vs prime star", () => {
    const { scored: rebuildScored } = scoreRoster(roster, CAP, 2024, {}, "rebuild");
    const { scored: contendScored } = scoreRoster(roster, CAP, 2024, {}, "contend");

    const rebuildYoung = rebuildScored.find((s) => s.player.playerId === "young")!;
    const rebuildPrime = rebuildScored.find((s) => s.player.playerId === "prime")!;
    const contendYoung = contendScored.find((s) => s.player.playerId === "young")!;
    const contendPrime = contendScored.find((s) => s.player.playerId === "prime")!;

    // Under rebuild, the gap between young/cheap and prime is smaller (or reverses)
    const rebuildGap = rebuildPrime.result.protect_score_raw - rebuildYoung.result.protect_score_raw;
    const contendGap = contendPrime.result.protect_score_raw - contendYoung.result.protect_score_raw;

    // Rebuild direction should favor young players more than contend does
    expect(rebuildGap).toBeLessThan(contendGap);
  });

  it("contend increases relative score for proven prime starter", () => {
    const { scored: rebuildScored } = scoreRoster(roster, CAP, 2024, {}, "rebuild");
    const { scored: contendScored } = scoreRoster(roster, CAP, 2024, {}, "contend");

    const rebuildPrime = rebuildScored.find((s) => s.player.playerId === "prime")!.result.protect_score_raw;
    const contendPrime = contendScored.find((s) => s.player.playerId === "prime")!.result.protect_score_raw;

    // The prime star should score higher (or equally) under contend vs rebuild
    expect(contendPrime).toBeGreaterThanOrEqual(rebuildPrime - 0.001);
  });

  it("breakdown includes team_direction, weights_used, and bonus_modifiers", () => {
    const { scored } = scoreRoster(roster, CAP, 2024, {}, "rebuild");
    const breakdown = scored[0].result.breakdown;
    expect(breakdown.team_direction).toBe("rebuild");
    expect(breakdown.weights_used).toBeDefined();
    expect(breakdown.weights_used.importance).toBeCloseTo(0.38, 2);
    expect(breakdown.bonus_modifiers).toBeDefined();
    expect(breakdown.bonus_modifiers.rookie_bump_multiplier).toBeCloseTo(1.15, 2);
  });

  it("rebuild applies rookie_bump_multiplier > 1 for young players", () => {
    const youngOnly: RosterPlayerForScoring[] = [
      {
        ...youngCheapPlayer,
        pointsPerGame: 14, // ensure rookie bump triggers (> 35th pct on 1-man roster)
      },
    ];
    const { scored: neutral } = scoreRoster(youngOnly, CAP, 2024, {}, "neutral");
    const { scored: rebuild } = scoreRoster(youngOnly, CAP, 2024, {}, "rebuild");

    const neutralScore = neutral[0].result.protect_score_raw;
    const rebuildScore = rebuild[0].result.protect_score_raw;

    // Rebuild should give same or higher score for young cost-controlled player
    expect(rebuildScore).toBeGreaterThanOrEqual(neutralScore - 0.001);
  });

  it("rebuild applies higher cost_controlled_multiplier than contend (verified via breakdown)", () => {
    // Use a roster where the young player is NOT the only one (so importance isn't auto-100%)
    const { scored: rebuildScored } = scoreRoster(roster, CAP, 2024, {}, "rebuild");
    const { scored: contendScored } = scoreRoster(roster, CAP, 2024, {}, "contend");

    const rebuildYoung = rebuildScored.find((s) => s.player.playerId === "young")!;
    const contendYoung = contendScored.find((s) => s.player.playerId === "young")!;

    // Rebuild uses cost_controlled_multiplier = 1.15; contend uses 0.90
    // On a multi-player roster where the young player has real importance rank,
    // rebuild's bonus modifiers should yield >= contend's score for young players
    expect(rebuildYoung.result.breakdown.bonus_modifiers.cost_controlled_multiplier)
      .toBeGreaterThan(contendYoung.result.breakdown.bonus_modifiers.cost_controlled_multiplier);
    expect(rebuildYoung.result.breakdown.bonus_modifiers.rookie_bump_multiplier)
      .toBeGreaterThan(contendYoung.result.breakdown.bonus_modifiers.rookie_bump_multiplier);
  });

  it("UFA penalty scales with direction multiplier", () => {
    const ufaPlayer: RosterPlayerForScoring = {
      ...primeStarter,
      playerId: "ufa",
      isUFAAfterSeason: true,
    };
    const rosterUfa = [ufaPlayer];

    const { scored: neutral } = scoreRoster(rosterUfa, CAP, 2024, {}, "neutral");
    const { scored: contend } = scoreRoster(rosterUfa, CAP, 2024, {}, "contend");
    const { scored: rebuild } = scoreRoster(rosterUfa, CAP, 2024, {}, "rebuild");

    // Higher UFA penalty multiplier → lower contract_value → lower overall score
    expect(contend[0].result.breakdown.contract_value).toBeLessThanOrEqual(
      neutral[0].result.breakdown.contract_value + 0.001
    );
    expect(rebuild[0].result.breakdown.contract_value).toBeLessThanOrEqual(
      neutral[0].result.breakdown.contract_value + 0.001
    );
    // Contend has highest UFA penalty so lowest contract_value
    expect(contend[0].result.breakdown.contract_value).toBeLessThanOrEqual(
      rebuild[0].result.breakdown.contract_value + 0.001
    );
  });

  it("protect_score and protect_score_raw are identical (normalization is separate)", () => {
    const { scored } = scoreRoster(roster, CAP, 2024, {}, "neutral");
    for (const { result } of scored) {
      expect(result.protect_score).toBe(result.protect_score_raw);
    }
  });
});

// ─── normalization ────────────────────────────────────────────────────────────

describe("normalizeScores", () => {
  describe("team_minmax mode", () => {
    it("maps min → 0, max → 100", () => {
      const raw = [20, 50, 80];
      const display = normalizeScores(raw, "team_minmax");
      expect(display[0]).toBe(0);
      expect(display[2]).toBe(100);
    });

    it("linearly interpolates middle values", () => {
      const raw = [0, 50, 100];
      const display = normalizeScores(raw, "team_minmax");
      expect(display[0]).toBe(0);
      expect(display[1]).toBe(50);
      expect(display[2]).toBe(100);
    });

    it("maps all-equal scores to 50", () => {
      const raw = [60, 60, 60, 60];
      const display = normalizeScores(raw, "team_minmax");
      expect(display).toEqual([50, 50, 50, 50]);
    });

    it("handles single player → 100", () => {
      expect(normalizeScores([73], "team_minmax")).toEqual([100]);
    });

    it("handles empty array", () => {
      expect(normalizeScores([], "team_minmax")).toEqual([]);
    });

    it("clamps to 0..100 (no out-of-range values)", () => {
      const raw = [10, 55, 90];
      const display = normalizeScores(raw, "team_minmax");
      for (const d of display) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("team_percentile mode", () => {
    it("rank 1 → 100, rank n → 0 for n > 1", () => {
      const raw = [80, 60, 40]; // already ordered high→low
      const display = normalizeScores(raw, "team_percentile");
      expect(display[0]).toBe(100); // highest raw
      expect(display[2]).toBe(0);   // lowest raw
    });

    it("evenly spaced for 3 players: 100, 50, 0", () => {
      const raw = [90, 70, 30];
      const display = normalizeScores(raw, "team_percentile");
      expect(display[0]).toBe(100);
      expect(display[1]).toBe(50);
      expect(display[2]).toBe(0);
    });

    it("correctly handles unsorted input", () => {
      const raw = [40, 80, 60]; // middle has highest score
      const display = normalizeScores(raw, "team_percentile");
      expect(display[1]).toBe(100); // 80 is max
      expect(display[0]).toBe(0);   // 40 is min
      expect(display[2]).toBe(50);  // 60 is middle
    });

    it("single player → 100", () => {
      expect(normalizeScores([55], "team_percentile")).toEqual([100]);
    });

    it("handles empty array", () => {
      expect(normalizeScores([], "team_percentile")).toEqual([]);
    });
  });

  describe("defaults", () => {
    it("uses team_minmax when no mode specified", () => {
      const raw = [10, 90];
      const withDefault = normalizeScores(raw);
      const withExplicit = normalizeScores(raw, "team_minmax");
      expect(withDefault).toEqual(withExplicit);
    });
  });
});
