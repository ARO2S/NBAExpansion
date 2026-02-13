import { describe, it, expect } from "vitest";
import {
  getAgeAtSeasonStart,
  ageValueScore,
  computeTeamRanks,
  computeProtectScoreForPlayer,
  scoreRoster,
} from "../protectScore";
import { DEFAULT_SCORING_RULES } from "../rules-schema";
import type { RosterPlayerForScoring } from "../protectScore";

const curve = DEFAULT_SCORING_RULES.age_curve;

describe("protectScore", () => {
  describe("getAgeAtSeasonStart", () => {
    it("computes age at July 1", () => {
      const birthdate = new Date(2000, 5, 15);
      expect(getAgeAtSeasonStart(birthdate, 2024)).toBe(24);
      expect(getAgeAtSeasonStart(birthdate, 2025)).toBe(25);
    });
    it("handles birthday after July 1", () => {
      const birthdate = new Date(2000, 7, 15); // Aug 15
      expect(getAgeAtSeasonStart(birthdate, 2024)).toBe(23);
    });
  });

  describe("ageValueScore", () => {
    it("returns 100 for peak ages 24-27", () => {
      expect(ageValueScore(24, curve)).toBe(100);
      expect(ageValueScore(26, curve)).toBe(100);
      expect(ageValueScore(27, curve)).toBe(100);
    });
    it("returns 92 for late prime (age 28)", () => {
      expect(ageValueScore(28, curve)).toBe(92);
    });
    it("returns declining values post-peak", () => {
      // decline_start (29) through steep_decline_start-1 (31): 80→55
      expect(ageValueScore(29, curve)).toBe(80);
      expect(ageValueScore(30, curve)).toBeLessThan(80);
      expect(ageValueScore(31, curve)).toBeLessThan(ageValueScore(30, curve));
      // steep decline (32-34): 45→25
      expect(ageValueScore(32, curve)).toBe(45);
      expect(ageValueScore(34, curve)).toBe(25);
    });
    it("returns 15 for age 35+", () => {
      expect(ageValueScore(35, curve)).toBe(15);
      expect(ageValueScore(38, curve)).toBe(15);
    });
    it("returns 60 for age 19 and ramps up to peak", () => {
      expect(ageValueScore(19, curve)).toBe(60);
      expect(ageValueScore(20, curve)).toBeGreaterThan(60);
      expect(ageValueScore(23, curve)).toBeGreaterThan(ageValueScore(21, curve));
      expect(ageValueScore(23, curve)).toBeLessThanOrEqual(100);
    });
  });

  describe("team rank percentile logic", () => {
    it("assigns rank 1 to highest stat, percentile 1 for single player", () => {
      const roster: RosterPlayerForScoring[] = [
        {
          playerId: "1",
          firstName: "A",
          lastName: "B",
          birthdate: new Date(1995, 0, 1),
          primaryPosition: "PG",
          gamesPlayed: 82,
          minutesPerGame: 35,
          starts: 82,
          pointsPerGame: 25,
          assistsPerGame: 8,
          reboundsPerGame: 5,
          overallRating: 90,
        },
      ];
      const ranks = computeTeamRanks(roster);
      const r = ranks.get("1")!;
      expect(r.pts_rank).toBe(1);
      expect(r.pts_pct).toBe(1);
      expect(r.ast_rank).toBe(1);
      expect(r.reb_rank).toBe(1);
    });
    it("assigns correct percentiles for multiple players", () => {
      const roster: RosterPlayerForScoring[] = [
        {
          playerId: "1",
          firstName: "High",
          lastName: "Pts",
          birthdate: new Date(1995, 0, 1),
          primaryPosition: "SF",
          gamesPlayed: 82,
          minutesPerGame: 35,
          starts: 82,
          pointsPerGame: 25,
          assistsPerGame: 2,
          reboundsPerGame: 5,
          overallRating: null,
        },
        {
          playerId: "2",
          firstName: "Low",
          lastName: "Pts",
          birthdate: new Date(1996, 0, 1),
          primaryPosition: "SG",
          gamesPlayed: 82,
          minutesPerGame: 20,
          starts: 10,
          pointsPerGame: 5,
          assistsPerGame: 1,
          reboundsPerGame: 2,
          overallRating: null,
        },
      ];
      const ranks = computeTeamRanks(roster);
      const r1 = ranks.get("1")!;
      const r2 = ranks.get("2")!;
      expect(r1.pts_rank).toBe(1);
      expect(r2.pts_rank).toBe(2);
      expect(r1.pts_pct).toBe(1);
      expect(r2.pts_pct).toBe(0);
    });
  });

  describe("contract penalty", () => {
    it("increases burden with salary and years", () => {
      const base: RosterPlayerForScoring = {
        playerId: "1",
        firstName: "A",
        lastName: "B",
        birthdate: new Date(1998, 0, 1),
        primaryPosition: "PG",
        gamesPlayed: 82,
        minutesPerGame: 30,
        starts: 82,
        pointsPerGame: 15,
        assistsPerGame: 5,
        reboundsPerGame: 4,
        overallRating: null,
      };
      const roster1: RosterPlayerForScoring[] = [
        { ...base, salary: 5_000_000, yearsRemaining: 1 },
      ];
      const roster2: RosterPlayerForScoring[] = [
        { ...base, salary: 40_000_000, yearsRemaining: 4 },
      ];
      const cap = 140_000_000;
      const { scored: s1 } = scoreRoster(roster1, cap, 2024, {});
      const { scored: s2 } = scoreRoster(roster2, cap, 2024, {});
      expect(s2[0].result.breakdown.contract_value).toBeLessThan(
        s1[0].result.breakdown.contract_value
      );
    });
  });

  describe("guardrail", () => {
    it("sets minimum 65 for young top-3 importance players", () => {
      const roster: RosterPlayerForScoring[] = [
        {
          playerId: "1",
          firstName: "Star",
          lastName: "Player",
          birthdate: new Date(2002, 0, 1), // age 22 in 2024
          primaryPosition: "SF",
          gamesPlayed: 82,
          minutesPerGame: 36,
          starts: 82,
          pointsPerGame: 28,
          assistsPerGame: 6,
          reboundsPerGame: 8,
          overallRating: null,
          salary: 3_000_000,
          yearsRemaining: 2,
          hasPlayerOption: false,
          hasTeamOption: false,
          isUFAAfterSeason: false,
          isRFAAfterSeason: false,
        },
        {
          playerId: "2",
          firstName: "Bench",
          lastName: "Player",
          birthdate: new Date(1995, 0, 1),
          primaryPosition: "SG",
          gamesPlayed: 20,
          minutesPerGame: 8,
          starts: 0,
          pointsPerGame: 2,
          assistsPerGame: 0,
          reboundsPerGame: 1,
          overallRating: null,
        },
      ];
      const { scored } = scoreRoster(roster, 140_000_000, 2024, {});
      const star = scored.find((s) => s.player.playerId === "1")!;
      expect(star.result.protect_score).toBeGreaterThanOrEqual(65);
    });
  });

  describe("rookie bump", () => {
    it("gives bonus to productive rookie over mediocre prime-age player", () => {
      const roster: RosterPlayerForScoring[] = [
        {
          playerId: "rookie",
          firstName: "Young",
          lastName: "Gun",
          birthdate: new Date(2003, 0, 1), // age 21 in 2024
          primaryPosition: "SG",
          gamesPlayed: 72,
          minutesPerGame: 28,
          starts: 50,
          pointsPerGame: 14,
          assistsPerGame: 3,
          reboundsPerGame: 4,
          overallRating: null,
          salary: 4_000_000,
          yearsRemaining: 3,
        },
        {
          playerId: "vet",
          firstName: "Prime",
          lastName: "Vet",
          birthdate: new Date(1998, 0, 1), // age 26 in 2024
          primaryPosition: "SF",
          gamesPlayed: 75,
          minutesPerGame: 22,
          starts: 20,
          pointsPerGame: 8,
          assistsPerGame: 2,
          reboundsPerGame: 3,
          overallRating: null,
          salary: 12_000_000,
          yearsRemaining: 2,
        },
      ];
      const { scored } = scoreRoster(roster, 140_000_000, 2024, {});
      const rookieScore = scored.find((s) => s.player.playerId === "rookie")!;
      const vetScore = scored.find((s) => s.player.playerId === "vet")!;
      // Rookie producing more on cheaper deal should outscore mediocre vet
      expect(rookieScore.result.protect_score).toBeGreaterThan(vetScore.result.protect_score);
      expect(rookieScore.result.breakdown.flags).toContain("RookieBump");
    });
  });

  describe("cost controlled bonus", () => {
    it("gives bonus to young player on cheap deal", () => {
      const roster: RosterPlayerForScoring[] = [
        {
          playerId: "cheap",
          firstName: "Cheap",
          lastName: "Young",
          birthdate: new Date(2001, 0, 1), // age 23 in 2024
          primaryPosition: "PF",
          gamesPlayed: 70,
          minutesPerGame: 25,
          starts: 40,
          pointsPerGame: 12,
          assistsPerGame: 2,
          reboundsPerGame: 6,
          overallRating: null,
          salary: 5_000_000,
          yearsRemaining: 2,
        },
      ];
      const cap = 140_000_000;
      const { scored } = scoreRoster(roster, cap, 2024, {});
      expect(scored[0].result.breakdown.flags).toContain("CostControlled");
    });
  });
});
