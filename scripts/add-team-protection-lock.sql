-- Add TeamProtectionLock table (Prisma uses PascalCase table names)
-- Run this via Supabase SQL Editor or psql directly (bypasses Prisma/session pooler)

CREATE TABLE IF NOT EXISTS "TeamProtectionLock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "locked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamProtectionLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamProtectionLock_run_id_team_id_key"
    ON "TeamProtectionLock"("run_id", "team_id");

ALTER TABLE "TeamProtectionLock"
    DROP CONSTRAINT IF EXISTS "TeamProtectionLock_run_id_fkey";
ALTER TABLE "TeamProtectionLock"
    ADD CONSTRAINT "TeamProtectionLock_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "DraftRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamProtectionLock"
    DROP CONSTRAINT IF EXISTS "TeamProtectionLock_team_id_fkey";
ALTER TABLE "TeamProtectionLock"
    ADD CONSTRAINT "TeamProtectionLock_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
