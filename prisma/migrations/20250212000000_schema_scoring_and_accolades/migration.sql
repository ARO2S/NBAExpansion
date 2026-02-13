-- CreateTable
CREATE TABLE IF NOT EXISTS "PlayerAccolade" (
    "player_id" UUID NOT NULL,
    "all_star_appearances" INTEGER NOT NULL DEFAULT 0,
    "championships" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "PlayerAccolade_pkey" PRIMARY KEY ("player_id")
);

-- Add created_at to Team if missing
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
UPDATE "Team" SET "created_at" = now() WHERE "created_at" IS NULL;
ALTER TABLE "Team" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "Team" ALTER COLUMN "created_at" SET DEFAULT now();

-- Add created_at to Player if missing
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
UPDATE "Player" SET "created_at" = now() WHERE "created_at" IS NULL;
ALTER TABLE "Player" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "Player" ALTER COLUMN "created_at" SET DEFAULT now();

-- Add team_id to PlayerSeasonMetric (nullable first for backfill)
ALTER TABLE "PlayerSeasonMetric" ADD COLUMN IF NOT EXISTS "team_id" UUID;

-- Backfill team_id from Contract
UPDATE "PlayerSeasonMetric" m
SET "team_id" = c."team_id"
FROM "Contract" c
WHERE m."season_id" = c."season_id" AND m."player_id" = c."player_id"
  AND m."team_id" IS NULL;

-- For any rows still null, use first team in season as fallback (edge case)
UPDATE "PlayerSeasonMetric" m
SET "team_id" = (SELECT t."id" FROM "Team" t WHERE t."season_id" = m."season_id" AND t."is_expansion" = false LIMIT 1)
WHERE m."team_id" IS NULL;

-- Make team_id NOT NULL (only if all rows have values)
ALTER TABLE "PlayerSeasonMetric" ALTER COLUMN "team_id" SET NOT NULL;

-- Add FK
ALTER TABLE "PlayerSeasonMetric" ADD CONSTRAINT "PlayerSeasonMetric_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add PTS/APG/RPG columns
ALTER TABLE "PlayerSeasonMetric" ADD COLUMN IF NOT EXISTS "points_per_game" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "PlayerSeasonMetric" ADD COLUMN IF NOT EXISTS "assists_per_game" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "PlayerSeasonMetric" ADD COLUMN IF NOT EXISTS "rebounds_per_game" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Make overall_rating nullable
ALTER TABLE "PlayerSeasonMetric" ALTER COLUMN "overall_rating" DROP NOT NULL;

-- Add default for DraftRun status
ALTER TABLE "DraftRun" ALTER COLUMN "status" SET DEFAULT 'setup';

-- Add created_at to ProtectionListItem
ALTER TABLE "ProtectionListItem" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
UPDATE "ProtectionListItem" SET "created_at" = now() WHERE "created_at" IS NULL;
ALTER TABLE "ProtectionListItem" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "ProtectionListItem" ALTER COLUMN "created_at" SET DEFAULT now();

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlayerSeasonMetric_season_id_team_id_idx" ON "PlayerSeasonMetric"("season_id", "team_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_season_id_team_id_idx" ON "Contract"("season_id", "team_id");

-- Unique constraint protection_lists
CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionList_runId_teamId_key" ON "ProtectionList"("run_id", "team_id");

-- Unique constraint protection_list_items
CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionListItem_protectionListId_playerId_key" ON "ProtectionListItem"("protection_list_id", "player_id");

-- Add FK for PlayerAccolade
ALTER TABLE "PlayerAccolade" ADD CONSTRAINT "PlayerAccolade_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: Enable on draft_runs, protection_lists, protection_list_items
ALTER TABLE "DraftRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProtectionList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProtectionListItem" ENABLE ROW LEVEL SECURITY;

-- RLS: draft_runs owner-only (allow service role to bypass)
DROP POLICY IF EXISTS "draft_runs_owner_read" ON "DraftRun";
DROP POLICY IF EXISTS "draft_runs_owner_write" ON "DraftRun";
CREATE POLICY "draft_runs_owner_read" ON "DraftRun"
  FOR SELECT USING (
    owner_user_id IS NULL OR auth.uid() = owner_user_id
  );
CREATE POLICY "draft_runs_owner_write" ON "DraftRun"
  FOR ALL USING (
    owner_user_id IS NULL OR auth.uid() = owner_user_id
  );

-- RLS: protection_lists via run ownership
DROP POLICY IF EXISTS "protection_lists_owner" ON "ProtectionList";
CREATE POLICY "protection_lists_owner" ON "ProtectionList"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "DraftRun" r
      WHERE r.id = "ProtectionList"."run_id"
        AND (r.owner_user_id IS NULL OR r.owner_user_id = auth.uid())
    )
  );

-- RLS: protection_list_items via run ownership
DROP POLICY IF EXISTS "protection_list_items_owner" ON "ProtectionListItem";
CREATE POLICY "protection_list_items_owner" ON "ProtectionListItem"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "ProtectionList" pl
      JOIN "DraftRun" r ON r.id = pl."run_id"
      WHERE pl.id = "ProtectionListItem"."protection_list_id"
        AND (r.owner_user_id IS NULL OR r.owner_user_id = auth.uid())
    )
  );
