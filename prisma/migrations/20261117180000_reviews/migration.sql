CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'REPORTED', 'HIDDEN');

CREATE TABLE "trip_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "template_version_id" UUID,
    "reviewer_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "report_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "edited_at" TIMESTAMPTZ(6),

    CONSTRAINT "trip_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trip_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "trip_reviews_body_length" CHECK ("body" IS NULL OR char_length("body") <= 4000)
);

CREATE UNIQUE INDEX "trip_reviews_trip_id_key" ON "trip_reviews"("trip_id");
CREATE INDEX "trip_reviews_template_id_status_idx" ON "trip_reviews"("template_id", "status");
CREATE INDEX "trip_reviews_reviewer_id_idx" ON "trip_reviews"("reviewer_id");
CREATE INDEX "trip_reviews_created_at_idx" ON "trip_reviews"("created_at");

ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "user_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
