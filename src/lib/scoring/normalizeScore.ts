/**
 * Score normalization: maps raw algorithmic scores to 0–100 display scores.
 *
 * Normalization is TEAM-RELATIVE — each team's roster is normalized
 * independently.  This ensures the best player always shows ~100 and
 * the worst ~0, giving a satisfying spread regardless of the raw score
 * distribution.
 *
 * IMPORTANT: normalization is presentation-only.
 * - Use protect_score_raw for all sorting / protection selection logic.
 * - Use protect_score_display only for UI and exports.
 */

export type NormalizationMode = "team_minmax" | "team_percentile";

/**
 * Normalize an array of raw scores to 0–100 display integers.
 *
 * MODE: 'team_minmax' (default)
 *   display = round( (raw - min) / (max - min) * 100 )
 *   If all scores are equal → 50 for all.
 *
 * MODE: 'team_percentile'
 *   Rank players by raw score descending.
 *   pct = 1 - (rank - 1) / (n - 1)   [1.0 for rank 1, 0.0 for rank n]
 *   display = round(pct * 100)
 *   For n = 1 → display = 100.
 *
 * @param rawScores  Array of raw protect scores in the same order as your roster.
 * @param mode       Normalization mode (default: 'team_minmax').
 * @returns          Array of integer display scores in the same order.
 */
export function normalizeScores(
  rawScores: number[],
  mode: NormalizationMode = "team_minmax"
): number[] {
  if (rawScores.length === 0) return [];
  if (rawScores.length === 1) return [100];

  if (mode === "team_percentile") {
    return normalizePercentile(rawScores);
  }
  return normalizeMinMax(rawScores);
}

function normalizeMinMax(rawScores: number[]): number[] {
  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  if (max === min) return rawScores.map(() => 50);
  return rawScores.map((s) =>
    Math.min(100, Math.max(0, Math.round(((s - min) / (max - min)) * 100)))
  );
}

function normalizePercentile(rawScores: number[]): number[] {
  const n = rawScores.length;
  // Build index array sorted by score descending
  const indexed = rawScores.map((score, idx) => ({ score, idx }));
  indexed.sort((a, b) => b.score - a.score);

  const result = new Array<number>(n);
  indexed.forEach(({ idx }, rank) => {
    const pct = n === 1 ? 1 : 1 - rank / (n - 1);
    result[idx] = Math.round(pct * 100);
  });
  return result;
}
