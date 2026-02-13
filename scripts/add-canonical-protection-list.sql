-- Add CanonicalProtectionList and CanonicalProtectionListItem (GM Key - generated once per season)
-- Run via Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "CanonicalProtectionList" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalProtectionList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanonicalProtectionList_season_id_team_id_key"
    ON "CanonicalProtectionList"("season_id", "team_id");

ALTER TABLE "CanonicalProtectionList"
    DROP CONSTRAINT IF EXISTS "CanonicalProtectionList_season_id_fkey";
ALTER TABLE "CanonicalProtectionList"
    ADD CONSTRAINT "CanonicalProtectionList_season_id_fkey"
    FOREIGN KEY ("season_id") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanonicalProtectionList"
    DROP CONSTRAINT IF EXISTS "CanonicalProtectionList_team_id_fkey";
ALTER TABLE "CanonicalProtectionList"
    ADD CONSTRAINT "CanonicalProtectionList_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CanonicalProtectionListItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canonical_list_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "is_protected" BOOLEAN NOT NULL,
    "protect_score" DECIMAL(8,4),
    "score_breakdown_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalProtectionListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanonicalProtectionListItem_canonical_list_id_player_id_key"
    ON "CanonicalProtectionListItem"("canonical_list_id", "player_id");

ALTER TABLE "CanonicalProtectionListItem"
    DROP CONSTRAINT IF EXISTS "CanonicalProtectionListItem_canonical_list_id_fkey";
ALTER TABLE "CanonicalProtectionListItem"
    ADD CONSTRAINT "CanonicalProtectionListItem_canonical_list_id_fkey"
    FOREIGN KEY ("canonical_list_id") REFERENCES "CanonicalProtectionList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanonicalProtectionListItem"
    DROP CONSTRAINT IF EXISTS "CanonicalProtectionListItem_player_id_fkey";
ALTER TABLE "CanonicalProtectionListItem"
    ADD CONSTRAINT "CanonicalProtectionListItem_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
