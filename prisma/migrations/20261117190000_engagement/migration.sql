ALTER TYPE "UsageStatus" ADD VALUE IF NOT EXISTS 'INVALID';
ALTER TYPE "UsageStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';

CREATE TYPE "EngagementType" AS ENUM ('VIEW', 'LIKE', 'SAVE', 'USE_STARTED');

ALTER TABLE "travel_templates" ADD COLUMN "use_started_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "usage_events"
  ADD COLUMN "period_key" TEXT,
  ADD COLUMN "rule_version" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN "qualified_at" TIMESTAMPTZ(6),
  ADD COLUMN "decided_at" TIMESTAMPTZ(6),
  ADD COLUMN "decision_reason" TEXT,
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "usage_events_user_id_template_id_period_key_key" ON "usage_events"("user_id", "template_id", "period_key");
CREATE INDEX "usage_events_template_id_period_key_idx" ON "usage_events"("template_id", "period_key");

CREATE TABLE "template_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "template_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "template_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_likes_user_id_template_id_key" ON "template_likes"("user_id", "template_id");
CREATE INDEX "template_likes_template_id_idx" ON "template_likes"("template_id");

CREATE TABLE "engagement_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "user_id" TEXT,
    "event_type" "EngagementType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupe_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "engagement_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engagement_events_dedupe_key_key" ON "engagement_events"("dedupe_key");
CREATE INDEX "engagement_events_template_id_event_type_occurred_at_idx" ON "engagement_events"("template_id", "event_type", "occurred_at");
CREATE INDEX "engagement_events_user_id_occurred_at_idx" ON "engagement_events"("user_id", "occurred_at");
CREATE INDEX "engagement_events_occurred_at_idx" ON "engagement_events"("occurred_at");

ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "member_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
