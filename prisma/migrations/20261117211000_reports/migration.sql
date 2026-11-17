CREATE TYPE "ReportTargetType" AS ENUM ('TEMPLATE', 'REVIEW', 'USER', 'COMMENT');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED');
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" TEXT NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "internal_note" TEXT,
    "assigned_to_id" TEXT,
    "resolution_action" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reports_reporter_id_target_type_target_id_key" ON "reports"("reporter_id", "target_type", "target_id");
CREATE INDEX "reports_status_priority_created_at_idx" ON "reports"("status", "priority", "created_at");
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
