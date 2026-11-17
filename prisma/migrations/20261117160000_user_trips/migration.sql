-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'PLANNED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "UsageStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REJECTED', 'VOID');

-- CreateTable
CREATE TABLE "user_trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" DATE,
    "end_date" DATE,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
    "notes" TEXT,
    "source_template_id" UUID,
    "source_template_version_id" UUID,
    "source_template_title" TEXT,
    "source_version_number" INTEGER,
    "copy_key" TEXT,
    "copied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_trips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_trips_date_order" CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"),
    CONSTRAINT "user_trips_source_pair" CHECK (
        ("source_template_id" IS NULL AND "source_template_version_id" IS NULL) OR
        ("source_template_id" IS NOT NULL AND "source_template_version_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "user_trips_owner_id_copy_key_key" ON "user_trips"("owner_id", "copy_key");
CREATE INDEX "user_trips_owner_id_status_idx" ON "user_trips"("owner_id", "status");
CREATE INDEX "user_trips_owner_id_start_date_idx" ON "user_trips"("owner_id", "start_date");
CREATE INDEX "user_trips_source_template_id_idx" ON "user_trips"("source_template_id");

-- CreateTable
CREATE TABLE "user_trip_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE,
    "title" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_trip_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_trip_days_day_number_positive" CHECK ("day_number" > 0)
);

CREATE UNIQUE INDEX "user_trip_days_trip_id_day_number_key" ON "user_trip_days"("trip_id", "day_number");
CREATE INDEX "user_trip_days_trip_id_idx" ON "user_trip_days"("trip_id");

-- CreateTable
CREATE TABLE "user_trip_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_id" UUID NOT NULL,
    "destination_id" UUID,
    "title" TEXT NOT NULL,
    "type" "TemplateItemType" NOT NULL DEFAULT 'ATTRACTION',
    "description" TEXT,
    "practical_tips" TEXT,
    "notes" TEXT,
    "start_time" TEXT,
    "end_time" TEXT,
    "duration_minutes" INTEGER,
    "estimated_cost_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "photo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_trip_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_trip_items_sort_order_nonnegative" CHECK ("sort_order" >= 0),
    CONSTRAINT "user_trip_items_duration_nonnegative" CHECK ("duration_minutes" IS NULL OR "duration_minutes" >= 0),
    CONSTRAINT "user_trip_items_cost_nonnegative" CHECK ("estimated_cost_cents" IS NULL OR "estimated_cost_cents" >= 0),
    CONSTRAINT "user_trip_items_start_time_format" CHECK ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "user_trip_items_end_time_format" CHECK ("end_time" IS NULL OR "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "user_trip_items_time_order" CHECK (
        "start_time" IS NULL OR "end_time" IS NULL OR "end_time" >= "start_time"
    )
);

CREATE UNIQUE INDEX "user_trip_items_day_id_sort_order_key" ON "user_trip_items"("day_id", "sort_order");
CREATE INDEX "user_trip_items_day_id_idx" ON "user_trip_items"("day_id");
CREATE INDEX "user_trip_items_destination_id_idx" ON "user_trip_items"("destination_id");

-- CreateTable
CREATE TABLE "user_trip_checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_trip_checklist_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_trip_checklist_items_sort_order_nonnegative" CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX "user_trip_checklist_items_trip_id_sort_order_key" ON "user_trip_checklist_items"("trip_id", "sort_order");
CREATE INDEX "user_trip_checklist_items_trip_id_idx" ON "user_trip_checklist_items"("trip_id");

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "template_id" UUID,
    "template_version_id" UUID,
    "trip_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'template_copy',
    "status" "UsageStatus" NOT NULL DEFAULT 'PENDING',
    "request_id" TEXT,
    "idempotency_key" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_events_trip_id_key" ON "usage_events"("trip_id");
CREATE UNIQUE INDEX "usage_events_user_id_idempotency_key_key" ON "usage_events"("user_id", "idempotency_key");
CREATE INDEX "usage_events_user_id_status_idx" ON "usage_events"("user_id", "status");
CREATE INDEX "usage_events_template_id_idx" ON "usage_events"("template_id");
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- AddForeignKey
ALTER TABLE "user_trips" ADD CONSTRAINT "user_trips_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trips" ADD CONSTRAINT "user_trips_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "travel_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_trips" ADD CONSTRAINT "user_trips_source_template_version_id_fkey" FOREIGN KEY ("source_template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_trip_days" ADD CONSTRAINT "user_trip_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "user_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trip_items" ADD CONSTRAINT "user_trip_items_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "user_trip_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trip_items" ADD CONSTRAINT "user_trip_items_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_trip_checklist_items" ADD CONSTRAINT "user_trip_checklist_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "user_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "user_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Owner and source attribution are immutable once a trip exists.
CREATE OR REPLACE FUNCTION prevent_trip_attribution_change()
RETURNS trigger AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'user_trips.owner_id is immutable';
    END IF;
    IF OLD.source_template_id IS NOT NULL AND (
        NEW.source_template_id IS DISTINCT FROM OLD.source_template_id OR
        NEW.source_template_version_id IS DISTINCT FROM OLD.source_template_version_id
    ) THEN
        RAISE EXCEPTION 'user_trips source attribution is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_trips_attribution_immutable
BEFORE UPDATE ON "user_trips"
FOR EACH ROW EXECUTE FUNCTION prevent_trip_attribution_change();
