-- Add team_direction to protection_lists
ALTER TABLE "protection_lists" ADD COLUMN IF NOT EXISTS "team_direction" TEXT NOT NULL DEFAULT 'neutral';

-- Add protect_score_raw and protect_score_display to protection_list_items
ALTER TABLE "protection_list_items" ADD COLUMN IF NOT EXISTS "protect_score_raw" DECIMAL(8,4);
ALTER TABLE "protection_list_items" ADD COLUMN IF NOT EXISTS "protect_score_display" INTEGER;

-- Backfill protect_score_raw from existing protect_score
UPDATE "protection_list_items" SET "protect_score_raw" = "protect_score" WHERE "protect_score_raw" IS NULL AND "protect_score" IS NOT NULL;
