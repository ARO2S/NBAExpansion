-- Fix Team table: name/abbrev were swapped - name has abbrev (LAC, TOR), abbrev has numbers (28, 10)
-- Run via Supabase SQL Editor. Uses your team IDs - adjust if different.

-- Map: current "name" (the real abbrev) -> correct (abbrev, full_name)
-- GS->GSW, SA->SAS, NO->NOP, NY->NYK, PHO->PHX

UPDATE "Team" SET name = 'Atlanta Hawks', abbrev = 'ATL' WHERE name = 'ATL';
UPDATE "Team" SET name = 'Boston Celtics', abbrev = 'BOS' WHERE name = 'BOS';
UPDATE "Team" SET name = 'Brooklyn Nets', abbrev = 'BKN' WHERE name = 'BKN';
UPDATE "Team" SET name = 'Charlotte Hornets', abbrev = 'CHA' WHERE name = 'CHA';
UPDATE "Team" SET name = 'Chicago Bulls', abbrev = 'CHI' WHERE name = 'CHI';
UPDATE "Team" SET name = 'Cleveland Cavaliers', abbrev = 'CLE' WHERE name = 'CLE';
UPDATE "Team" SET name = 'Dallas Mavericks', abbrev = 'DAL' WHERE name = 'DAL';
UPDATE "Team" SET name = 'Denver Nuggets', abbrev = 'DEN' WHERE name = 'DEN';
UPDATE "Team" SET name = 'Detroit Pistons', abbrev = 'DET' WHERE name = 'DET';
UPDATE "Team" SET name = 'Golden State Warriors', abbrev = 'GSW' WHERE name = 'GS';
UPDATE "Team" SET name = 'Houston Rockets', abbrev = 'HOU' WHERE name = 'HOU';
UPDATE "Team" SET name = 'Indiana Pacers', abbrev = 'IND' WHERE name = 'IND';
UPDATE "Team" SET name = 'Los Angeles Clippers', abbrev = 'LAC' WHERE name = 'LAC';
UPDATE "Team" SET name = 'Los Angeles Lakers', abbrev = 'LAL' WHERE name = 'LAL';
UPDATE "Team" SET name = 'Memphis Grizzlies', abbrev = 'MEM' WHERE name = 'MEM';
UPDATE "Team" SET name = 'Miami Heat', abbrev = 'MIA' WHERE name = 'MIA';
UPDATE "Team" SET name = 'Milwaukee Bucks', abbrev = 'MIL' WHERE name = 'MIL';
UPDATE "Team" SET name = 'Minnesota Timberwolves', abbrev = 'MIN' WHERE name = 'MIN';
UPDATE "Team" SET name = 'New Orleans Pelicans', abbrev = 'NOP' WHERE name = 'NO';
UPDATE "Team" SET name = 'New York Knicks', abbrev = 'NYK' WHERE name = 'NY';
UPDATE "Team" SET name = 'Oklahoma City Thunder', abbrev = 'OKC' WHERE name = 'OKC';
UPDATE "Team" SET name = 'Orlando Magic', abbrev = 'ORL' WHERE name = 'ORL';
UPDATE "Team" SET name = 'Philadelphia 76ers', abbrev = 'PHI' WHERE name = 'PHI';
UPDATE "Team" SET name = 'Phoenix Suns', abbrev = 'PHX' WHERE name = 'PHO';
UPDATE "Team" SET name = 'Portland Trail Blazers', abbrev = 'POR' WHERE name = 'POR';
UPDATE "Team" SET name = 'Sacramento Kings', abbrev = 'SAC' WHERE name = 'SAC';
UPDATE "Team" SET name = 'San Antonio Spurs', abbrev = 'SAS' WHERE name = 'SA';
UPDATE "Team" SET name = 'Toronto Raptors', abbrev = 'TOR' WHERE name = 'TOR';
UPDATE "Team" SET name = 'Utah Jazz', abbrev = 'UTA' WHERE name = 'UTA';
UPDATE "Team" SET name = 'Washington Wizards', abbrev = 'WAS' WHERE name = 'WAS';

-- Delete bogus 2TM/3TM teams (remove dependent rows first, order matters)
DO $$
DECLARE
  bogus_ids UUID[] := ARRAY(SELECT id FROM "Team" WHERE abbrev IN ('2TM', '3TM'));
BEGIN
  DELETE FROM "ProtectionListItem" WHERE "protection_list_id" IN (SELECT id FROM "ProtectionList" WHERE "team_id" = ANY(bogus_ids));
  DELETE FROM "ProtectionList" WHERE "team_id" = ANY(bogus_ids);
  DELETE FROM "TeamProtectionLock" WHERE "team_id" = ANY(bogus_ids);
  DELETE FROM "DraftPick" WHERE "from_team_id" = ANY(bogus_ids);
  DELETE FROM "PlayerSeasonMetric" WHERE "team_id" = ANY(bogus_ids);
  DELETE FROM "Contract" WHERE "team_id" = ANY(bogus_ids);
  DELETE FROM "Team" WHERE id = ANY(bogus_ids);
END $$;
