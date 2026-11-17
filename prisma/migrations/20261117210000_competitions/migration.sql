CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'FINALIZED');
CREATE TYPE "LeaderboardStatus" AS ENUM ('PROVISIONAL', 'FINAL', 'SUPERSEDED');
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'VOID');

CREATE TABLE "competitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "rules_url" TEXT,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "prize_pool_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "funding_source" TEXT,
    "created_by_id" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "finalized_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "change_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competitions_date_order" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at"),
    CONSTRAINT "competitions_prize_pool_nonnegative" CHECK ("prize_pool_cents" IS NULL OR "prize_pool_cents" >= 0)
);
CREATE UNIQUE INDEX "competitions_slug_key" ON "competitions"("slug");
CREATE INDEX "competitions_status_starts_at_idx" ON "competitions"("status", "starts_at");

CREATE TABLE "competition_prizes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "label" TEXT,
    CONSTRAINT "competition_prizes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competition_prizes_rank_positive" CHECK ("rank" > 0),
    CONSTRAINT "competition_prizes_amount_nonnegative" CHECK ("amount_cents" >= 0)
);
CREATE UNIQUE INDEX "competition_prizes_competition_id_rank_key" ON "competition_prizes"("competition_id", "rank");
CREATE INDEX "competition_prizes_competition_id_idx" ON "competition_prizes"("competition_id");

CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "LeaderboardStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "rule_version" TEXT NOT NULL DEFAULT 'v1',
    "entries" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,
    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leaderboard_snapshots_version_positive" CHECK ("version_number" > 0)
);
CREATE UNIQUE INDEX "leaderboard_snapshots_competition_id_version_number_key" ON "leaderboard_snapshots"("competition_id", "version_number");
CREATE INDEX "leaderboard_snapshots_competition_id_status_idx" ON "leaderboard_snapshots"("competition_id", "status");

CREATE TABLE "rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competition_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "payout_reference" TEXT,
    "payout_method" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "proof_url" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rewards_rank_positive" CHECK ("rank" > 0),
    CONSTRAINT "rewards_amount_nonnegative" CHECK ("amount_cents" >= 0)
);
CREATE UNIQUE INDEX "rewards_competition_id_rank_key" ON "rewards"("competition_id", "rank");
CREATE UNIQUE INDEX "rewards_payout_reference_key" ON "rewards"("payout_reference");
CREATE INDEX "rewards_competition_id_status_idx" ON "rewards"("competition_id", "status");
CREATE INDEX "rewards_recipient_id_idx" ON "rewards"("recipient_id");

ALTER TABLE "competition_prizes" ADD CONSTRAINT "competition_prizes_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "member_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_leaderboard_snapshot_update()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'leaderboard_snapshots rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leaderboard_snapshots_immutable
BEFORE UPDATE ON "leaderboard_snapshots"
FOR EACH ROW EXECUTE FUNCTION prevent_leaderboard_snapshot_update();
