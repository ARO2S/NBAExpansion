-- CLEANUP: Consolidate duplicate teams to one per (season_id, canonical abbrev)
-- Run diagnose-teams.sql first. Handles abbrev variants: GS->GSW, NO->NOP, NY->NYK, PHO->PHX, SA->SAS.
-- Keeps the team with most (contracts + metrics), redirects all refs, deletes the rest.

DO $$
DECLARE
  r RECORD;
  keep_id UUID;
  dup_id UUID;
  ids_to_delete UUID[] := '{}';
  canonical_abbrev TEXT;
BEGIN
  -- Map variant abbrevs to canonical
  FOR r IN
    WITH team_counts AS (
      SELECT t.id, t.season_id, t.abbrev,
        (SELECT COUNT(*) FROM "Contract" c WHERE c.team_id = t.id) AS contract_count,
        (SELECT COUNT(*) FROM "PlayerSeasonMetric" m WHERE m.team_id = t.id) AS metric_count
      FROM "Team" t
      WHERE t.is_expansion = false
    ),
    with_canonical AS (
      SELECT *, 
        CASE abbrev
          WHEN 'GS' THEN 'GSW'
          WHEN 'NO' THEN 'NOP'
          WHEN 'NY' THEN 'NYK'
          WHEN 'PHO' THEN 'PHX'
          WHEN 'SA' THEN 'SAS'
          ELSE abbrev
        END AS canonical
      FROM team_counts
    ),
    grouped AS (
      SELECT season_id, canonical,
        (array_agg(id ORDER BY (contract_count + metric_count) DESC, id))[1] AS keep_id,
        array_agg(id) AS all_ids
      FROM with_canonical
      GROUP BY season_id, canonical
      HAVING COUNT(*) > 1
    )
    SELECT * FROM grouped
  LOOP
    keep_id := r.keep_id;
    
    -- Redirect all references from duplicate teams to keep_id
    FOR dup_id IN 
      SELECT x FROM unnest(r.all_ids) AS x WHERE x IS DISTINCT FROM keep_id
    LOOP
      -- Skip if same id (safety)
      IF dup_id = keep_id THEN CONTINUE; END IF;
      UPDATE "Contract" SET team_id = keep_id WHERE team_id = dup_id;
      UPDATE "PlayerSeasonMetric" SET team_id = keep_id WHERE team_id = dup_id;
      UPDATE "ProtectionList" SET team_id = keep_id WHERE team_id = dup_id;
      UPDATE "TeamProtectionLock" SET team_id = keep_id WHERE team_id = dup_id;
      UPDATE "DraftPick" SET from_team_id = keep_id WHERE from_team_id = dup_id;
      
      -- CanonicalProtectionList: delete dup's list (keep_id may already have one; user can regenerate GM Key)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CanonicalProtectionList') THEN
        DELETE FROM "CanonicalProtectionList" WHERE team_id = dup_id;
      END IF;
      
      ids_to_delete := array_append(ids_to_delete, dup_id);
    END LOOP;
  END LOOP;
  
  -- Delete duplicate teams (now orphaned)
  IF array_length(ids_to_delete, 1) > 0 THEN
    DELETE FROM "Team" WHERE id = ANY(ids_to_delete);
    RAISE NOTICE 'Deleted % duplicate team(s)', array_length(ids_to_delete, 1);
  ELSE
    RAISE NOTICE 'No duplicates found.';
  END IF;

  -- Normalize abbrevs: GS->GSW, NO->NOP, NY->NYK, PHO->PHX, SA->SAS
  UPDATE "Team" SET abbrev = 'GSW' WHERE abbrev = 'GS' AND is_expansion = false;
  UPDATE "Team" SET abbrev = 'NOP' WHERE abbrev = 'NO' AND is_expansion = false;
  UPDATE "Team" SET abbrev = 'NYK' WHERE abbrev = 'NY' AND is_expansion = false;
  UPDATE "Team" SET abbrev = 'PHX' WHERE abbrev = 'PHO' AND is_expansion = false;
  UPDATE "Team" SET abbrev = 'SAS' WHERE abbrev = 'SA' AND is_expansion = false;

  RAISE NOTICE 'Abbrevs normalized.';
END $$;
