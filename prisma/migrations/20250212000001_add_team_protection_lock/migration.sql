-- CreateTable
CREATE TABLE "team_protection_lock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "locked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_protection_lock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_protection_lock_run_id_team_id_key" ON "team_protection_lock"("run_id", "team_id");

-- AddForeignKey
ALTER TABLE "team_protection_lock" ADD CONSTRAINT "team_protection_lock_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "draft_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_protection_lock" ADD CONSTRAINT "team_protection_lock_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
