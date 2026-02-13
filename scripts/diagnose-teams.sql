-- DIAGNOSTIC: See your teams, seasons, and what data points to which team
-- Run in Supabase SQL Editor

-- 1. Seasons and team counts
SELECT 
  s.id AS season_id,
  s.year,
  COUNT(t.id) AS team_count
FROM "Season" s
LEFT JOIN "Team" t ON t.season_id = s.id AND t.is_expansion = false
GROUP BY s.id, s.year
ORDER BY s.year DESC;

-- 2. Teams per season with abbrev - spot duplicates (same abbrev multiple times)
SELECT 
  s.year,
  t.abbrev,
  COUNT(*) AS copies,
  array_agg(t.id) AS team_ids,
  array_agg(t.name) AS names
FROM "Team" t
JOIN "Season" s ON s.id = t.season_id
WHERE t.is_expansion = false
GROUP BY s.year, t.abbrev
HAVING COUNT(*) > 1
ORDER BY s.year DESC, copies DESC;

-- 3. Contracts per team (which team IDs have contracts)
SELECT 
  t.id,
  t.abbrev,
  t.name,
  s.year,
  (SELECT COUNT(*) FROM "Contract" c WHERE c.team_id = t.id) AS contracts,
  (SELECT COUNT(*) FROM "PlayerSeasonMetric" m WHERE m.team_id = t.id) AS metrics
FROM "Team" t
JOIN "Season" s ON s.id = t.season_id
WHERE t.is_expansion = false
ORDER BY s.year DESC, t.abbrev;
