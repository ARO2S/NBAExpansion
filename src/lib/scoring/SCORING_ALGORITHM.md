# Protection Score Algorithm

This document explains the scoring algorithm used to determine which players an NBA team would likely protect in an expansion draft. The algorithm produces a **Protect Score** from 0 to 100 for each player on a roster. Higher scores indicate players the team would prioritize protecting.

## Overview

The score is a weighted sum of four component scores, plus additive bonuses for young/cheap players, with a safety-net guardrail for elite young contributors.

```
Protect Score =
    0.45 * Importance
  + 0.25 * Age Value
  + 0.25 * Contract Value
  + 0.05 * Accolades
  + Rookie Bump (0-10 bonus)
  + Cost-Controlled Bonus (0-8 bonus)
```

Final score is clamped to [0, 100].

---

## 1. Importance Score (0-100)

Measures how valuable the player is to their current team's on-court production. This is **team-relative**, not league-wide -- a 15 PPG scorer on a bad team ranks higher than a 15 PPG scorer on a stacked roster.

### Calculation

Each player is ranked within their roster for points, assists, and rebounds per game. Rankings are converted to percentiles (rank 1 on a 15-man roster = 1.0 percentile, rank 15 = 0.0).

```
Base = 100 * (0.45 * PTS_pct + 0.35 * AST_pct + 0.20 * REB_pct)
```

Points are weighted heaviest because scoring is the most directly impactful stat in terms of team building priority.

### Role Bumps

Two bonuses can be added on top of the base:

| Condition | Bonus | How it qualifies |
|-----------|-------|------------------|
| Starter | +5 | Started >= 50% of games played |
| High Minutes | +5 | Minutes percentile >= 80th on team |

A player who starts most games AND logs top-tier minutes gets both bonuses (+10 total).

### Examples

- Team's leading scorer who starts and plays heavy minutes: ~100
- Solid rotation player ranked ~7th in scoring: ~45-55
- End-of-bench player ranked last in everything: ~0-5

---

## 2. Age Value Score (0-100)

Models the expansion-draft reality that youth equals long-term value. Teams protect younger players because they have more years of control, are typically on cheaper contracts, and have upside remaining.

### The Age Curve

The curve uses four configurable breakpoints (defaults shown):

| Parameter | Default | Meaning |
|-----------|---------|---------|
| peak_age_start | 24 | Start of prime window |
| peak_age_end | 27 | End of prime window |
| decline_start | 29 | Mild decline begins |
| steep_decline_start | 32 | Steep decline begins |

The resulting scores:

| Age | Score | Zone |
|-----|-------|------|
| <=19 | 60 | Raw prospect, unproven |
| 20 | 68 | Pre-peak ramp |
| 21 | 76 | Pre-peak ramp |
| 22 | 84 | Pre-peak ramp |
| 23 | 92 | Pre-peak ramp |
| 24-27 | 100 | Prime window |
| 28 | 92 | Late prime |
| 29 | 80 | Early decline |
| 30 | 72 | Decline accelerating |
| 31 | 63 | Past prime |
| 32 | 45 | Steep decline |
| 33 | 35 | Likely exposed |
| 34 | 25 | Almost certainly exposed |
| 35+ | 15 | End of career |

Pre-peak ages (20-23) ramp linearly from 60 to 100. Post-peak decline is also linear within each zone but drops much more aggressively than pre-peak rises.

Age is computed as of **July 1** of the season year (approximating the start of the next NBA season).

### Production-Adjusted Age Score

Raw age scores are adjusted based on the player's production role on the team. The logic: being 25 years old is extremely valuable if you're a core contributor, but matters much less if you're the 12th man.

A player is classified as a **role player** if their best stat rank (across PTS, AST, REB) is worse than a configurable threshold (default: 10th on the roster).

| Player Type | Adjustment |
|-------------|------------|
| Core contributor (best rank <= 10) | No adjustment -- full age score |
| Young role player (pre-peak age) | 85% of raw score + youth upside bonus (up to 15 pts, scaling with how far below peak age) |
| Veteran role player (peak age or older) | 55% of raw score |

This means a 25-year-old starter keeps their full age score of 100, while a 25-year-old 13th man gets roughly 55. A 20-year-old end-of-bench player gets a dampened score but retains a meaningful upside bonus reflecting their development potential.

---

## 3. Contract Value Score (0-100)

Measures how favorable the player's contract is. Higher score = more team-friendly deal. An expensive, long-term contract on an aging player is a liability in an expansion draft context.

### Burden Formula

```
burden_raw = (salary / salary_cap) * 2.5
           + years_remaining * 0.12
           + max(0, age - 30) * 0.15

burden = clamp(burden_raw, 0, 1) * 100
score  = 100 - burden
```

The three components:

| Factor | Weight | What it captures |
|--------|--------|------------------|
| Salary as % of cap | 2.5 | A max contract (~35% of cap) contributes 0.35 * 2.5 = 0.875 to burden |
| Years remaining | 0.12 | Each year adds 0.12 -- a 4-year deal adds 0.48 |
| Age interaction | 0.15 | Each year over 30 adds 0.15 -- a 34-year-old adds 0.60 on top of salary/years |

The **age interaction** is the key term that creates the "Tobias Harris effect." A 34-year-old on $35M/4yr:
- Salary burden: (35/140) * 2.5 = 0.625
- Years burden: 4 * 0.12 = 0.48
- Age burden: 4 * 0.15 = 0.60
- Total: 1.705, clamped to 1.0 -> score = 0

vs. a 25-year-old on the same deal:
- Salary + years: 0.625 + 0.48 = 1.105, clamped to 1.0 -> score = 0
- But no age penalty, and the player's high age score and importance offset the contract burden.

### Contract Flag Penalties

| Condition | Penalty | Flag |
|-----------|---------|------|
| Player option | -10 | OptionRisk |
| Unrestricted free agent after season | -5 | UFA |
| Restricted free agent (risk mode) | -3 | RFA_Risk |

If no salary or years data is available, the player defaults to a score of 50 (neutral).

---

## 4. Accolades Score (0-100)

A small bonus for distinguished career achievements.

| Accolade | Points |
|----------|--------|
| All-Star appearance | 10 each |
| Championship ring | 12 each |

Capped at 100. Most players score 0 here, which is why this component only carries a 5% weight. A 3x All-Star with a ring would score 42.

---

## 5. Rookie / Sophomore Bump (+0 to 10)

An additive bonus (not part of the weighted sum) for very young players who are already producing.

### Eligibility

- Age <= 22 (approximating 1st or 2nd year players)
- Best stat percentile (max of PTS, AST, REB percentile on team) >= 0.35

### Calculation

```
scale = (best_percentile - 0.35) / (1.0 - 0.35)
bonus = 10 * scale
```

The bonus scales linearly: a rookie at the 35th percentile gets essentially 0, while a rookie who leads the team in scoring (100th percentile) gets the full +10.

### Why this matters

A rookie ranked #7 in team PPG on a 15-man roster has a percentile of ~0.57. Their bonus would be:

```
(0.57 - 0.35) / 0.65 * 10 = 3.4 points
```

Combined with their high age score (pre-peak) and likely cheap rookie-scale contract, this pushes them above mediocre veterans who might rank similarly on importance alone.

---

## 6. Cost-Controlled Bonus (+0 to 8)

An additive bonus for young players on team-friendly deals, modeling the surplus value that makes these assets so attractive to protect.

### Eligibility

- Age <= 25
- Salary < 15% of the salary cap (~$21M on a $140M cap)

### Calculation

```
salary_pct = salary / salary_cap
scale = 1 - (salary_pct / 0.15)
bonus = 8 * scale
```

A player earning nothing gets the full +8. A player at 7.5% of the cap gets +4. At 15% of the cap, the bonus drops to 0.

---

## 7. Guardrail

After computing the weighted sum plus bonuses, one safety net is applied:

> If a player is **top-3 in any stat category** (PTS, AST, or REB rank <= 3, OR PTS percentile >= 0.75) **AND under age 30**, their score is floored at **65**.

This prevents a core young player from being algorithmically exposed due to an unusual contract situation or missing data. It's set low enough (65) that the natural formula still creates meaningful spread at the top of the roster.

---

## 8. Position Guardrails (Post-Scoring)

After all players are scored and the top 8 are selected for protection, two positional checks run:

1. **Center check**: If the team has a Center averaging > 12 MPG but none are in the protected 8, the lowest-scoring protected player (who isn't a PG) is swapped out for the best-scoring unprotected Center.

2. **Point Guard check**: Same logic -- if no PG is protected but the team has a qualifying PG, the lowest-scoring protected player is swapped out.

This ensures every team protects at least one viable player at each critical position.

---

## Component Weights Summary

| Component | Weight | Range | Nature |
|-----------|--------|-------|--------|
| Importance | 0.45 | 0-100 | Team-relative production |
| Age Value | 0.25 | 0-100 | Youth premium, production-adjusted |
| Contract Value | 0.25 | 0-100 | Salary burden with age interaction |
| Accolades | 0.05 | 0-100 | All-Star + rings |
| Rookie Bump | additive | 0-10 | Productive 1st/2nd year players |
| Cost-Controlled | additive | 0-8 | Young + cheap = surplus value |

Theoretical range: 0 to 118 (clamped to 100).

---

## Worked Examples

All examples assume a $140M salary cap, 2024-25 season, and a 15-man roster.

### Example A: Young Star (age 25, $30M/yr, 2yr deal, team's leading scorer)

| Component | Sub-score | Weighted |
|-----------|-----------|----------|
| Importance | ~100 (rank 1 in pts, starter + high minutes) | 45.0 |
| Age Value | 100 (peak age, core contributor) | 25.0 |
| Contract Value | ~36 (high salary burden) | 9.0 |
| Accolades | 0 | 0.0 |
| **Weighted Total** | | **79.0** |
| Rookie Bump | 0 (age 25 > 22) | +0 |
| Cost-Controlled | 0 (salary > 15% of cap) | +0 |
| **Final Score** | | **~79** |

### Example B: Productive Rookie (age 21, $4M/yr, 3yr deal, ranked #7 in PPG)

| Component | Sub-score | Weighted |
|-----------|-----------|----------|
| Importance | ~50 (mid-roster ranking, starter) | 22.5 |
| Age Value | 76 (pre-peak ramp) | 19.0 |
| Contract Value | ~93 (very low salary burden) | 23.3 |
| Accolades | 0 | 0.0 |
| **Weighted Total** | | **64.8** |
| Rookie Bump | ~3.4 (57th percentile in PPG) | +3.4 |
| Cost-Controlled | ~6.5 (salary ~2.9% of cap) | +6.5 |
| **Final Score** | | **~75** |

### Example C: Tobias Harris Type (age 33, $35M/yr, 2yr deal, ranked ~8th in PPG)

| Component | Sub-score | Weighted |
|-----------|-----------|----------|
| Importance | ~45 (mid-roster, starter) | 20.3 |
| Age Value | 35 (steep decline zone) | 8.8 |
| Contract Value | ~0 (maxed out burden: high salary + age interaction) | 0.0 |
| Accolades | 10 (1x All-Star) | 0.5 |
| **Weighted Total** | | **29.5** |
| Rookie Bump | 0 | +0 |
| Cost-Controlled | 0 | +0 |
| **Final Score** | | **~30** |

### Example D: Veteran Role Player (age 30, $10M/yr, 1yr deal, ranked ~11th in PPG)

| Component | Sub-score | Weighted |
|-----------|-----------|----------|
| Importance | ~25 (low production rank, bench role) | 11.3 |
| Age Value | ~40 (72 raw, dampened to 55% as veteran role player) | 10.0 |
| Contract Value | ~82 (modest salary, short deal) | 20.5 |
| Accolades | 0 | 0.0 |
| **Weighted Total** | | **41.8** |
| Rookie Bump | 0 | +0 |
| Cost-Controlled | 0 | +0 |
| **Final Score** | | **~42** |

---

## Score Distribution Goals

The algorithm is designed to produce a wide spread that mirrors real GM decision-making:

| Tier | Score Range | Who lands here |
|------|-------------|----------------|
| Must protect | 80-100 | Stars in their prime, elite young talent on rookie deals |
| Strong protect | 65-80 | Quality starters, productive young players |
| Borderline | 45-65 | Average starters, good role players, young projects |
| Likely exposed | 25-45 | Overpaid veterans, declining players, deep bench |
| Clearly exposed | 0-25 | Aging max contracts, end-of-bench players, 35+ veterans |

---

## Flags

Each player's score breakdown includes diagnostic flags that explain which special rules were applied:

| Flag | Meaning |
|------|---------|
| Starter | Started >= 50% of games |
| HighMinutes | Minutes percentile >= 80th on team |
| OptionRisk | Has a player option (adds uncertainty) |
| UFA | Unrestricted free agent after this season |
| RFA_Risk | Restricted free agent (risk mode) |
| RookieBump | Received the rookie/sophomore production bonus |
| CostControlled | Received the cost-controlled young player bonus |
| AgeProductionAdj | Age score was dampened due to low production role |

---

## Configuration

All parameters are configurable per draft run via `rules_snapshot_json`. The defaults described in this document are stored in `rules-schema.ts` and can be overridden when creating a new draft run. This allows tuning the algorithm without code changes.
