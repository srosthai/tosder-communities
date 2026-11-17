-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNLISTED', 'ARCHIVED');
CREATE TYPE "TemplateItemType" AS ENUM ('ATTRACTION', 'FOOD', 'REST', 'TRANSPORT', 'SHOPPING', 'ACCOMMODATION', 'CUSTOM');

-- CreateTable
CREATE TABLE "member_profiles" (
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "social_links" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_profiles_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "member_profiles_username_format" CHECK ("username" ~ '^[a-z0-9][a-z0-9-]{2,29}$')
);

CREATE UNIQUE INDEX "member_profiles_username_key" ON "member_profiles"("username");
CREATE INDEX "member_profiles_username_idx" ON "member_profiles"("username");

-- CreateTable
CREATE TABLE "travel_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" TEXT NOT NULL,
    "province_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "cover_photo_url" TEXT,
    "duration_days" INTEGER NOT NULL DEFAULT 1,
    "budget_min_cents" INTEGER,
    "budget_max_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "season" TEXT,
    "transport" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "audience" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "published_version_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "save_count" INTEGER NOT NULL DEFAULT 0,
    "qualified_use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "travel_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "travel_templates_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT "travel_templates_duration_positive" CHECK ("duration_days" > 0),
    CONSTRAINT "travel_templates_budget_nonnegative" CHECK (
        ("budget_min_cents" IS NULL OR "budget_min_cents" >= 0) AND
        ("budget_max_cents" IS NULL OR "budget_max_cents" >= 0)
    ),
    CONSTRAINT "travel_templates_budget_order" CHECK (
        "budget_min_cents" IS NULL OR "budget_max_cents" IS NULL OR "budget_min_cents" <= "budget_max_cents"
    )
);

CREATE UNIQUE INDEX "travel_templates_slug_key" ON "travel_templates"("slug");
CREATE UNIQUE INDEX "travel_templates_published_version_id_key" ON "travel_templates"("published_version_id");
CREATE INDEX "travel_templates_creator_id_idx" ON "travel_templates"("creator_id");
CREATE INDEX "travel_templates_province_id_idx" ON "travel_templates"("province_id");
CREATE INDEX "travel_templates_status_idx" ON "travel_templates"("status");
CREATE INDEX "travel_templates_published_at_idx" ON "travel_templates"("published_at");
CREATE INDEX "travel_templates_status_published_at_idx" ON "travel_templates"("status", "published_at");
CREATE INDEX "travel_templates_title_idx" ON "travel_templates"("title");

-- CreateTable
CREATE TABLE "template_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "template_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "template_days_day_number_positive" CHECK ("day_number" > 0)
);

CREATE UNIQUE INDEX "template_days_template_id_day_number_key" ON "template_days"("template_id", "day_number");
CREATE INDEX "template_days_template_id_idx" ON "template_days"("template_id");

-- CreateTable
CREATE TABLE "template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_id" UUID NOT NULL,
    "destination_id" UUID,
    "title" TEXT NOT NULL,
    "type" "TemplateItemType" NOT NULL DEFAULT 'ATTRACTION',
    "description" TEXT,
    "practical_tips" TEXT,
    "start_time" TEXT,
    "end_time" TEXT,
    "duration_minutes" INTEGER,
    "estimated_cost_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "photo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "template_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "template_items_sort_order_nonnegative" CHECK ("sort_order" >= 0),
    CONSTRAINT "template_items_duration_nonnegative" CHECK ("duration_minutes" IS NULL OR "duration_minutes" >= 0),
    CONSTRAINT "template_items_cost_nonnegative" CHECK ("estimated_cost_cents" IS NULL OR "estimated_cost_cents" >= 0),
    CONSTRAINT "template_items_start_time_format" CHECK ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "template_items_end_time_format" CHECK ("end_time" IS NULL OR "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "template_items_time_order" CHECK (
        "start_time" IS NULL OR "end_time" IS NULL OR "end_time" >= "start_time"
    )
);

CREATE UNIQUE INDEX "template_items_day_id_sort_order_key" ON "template_items"("day_id", "sort_order");
CREATE INDEX "template_items_day_id_idx" ON "template_items"("day_id");
CREATE INDEX "template_items_destination_id_idx" ON "template_items"("destination_id");

-- CreateTable
CREATE TABLE "template_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "validation" JSONB,
    "change_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "template_versions_version_positive" CHECK ("version_number" > 0)
);

CREATE UNIQUE INDEX "template_versions_template_id_version_number_key" ON "template_versions"("template_id", "version_number");
CREATE INDEX "template_versions_template_id_idx" ON "template_versions"("template_id");
CREATE INDEX "template_versions_created_at_idx" ON "template_versions"("created_at");

-- AddForeignKey
ALTER TABLE "travel_templates" ADD CONSTRAINT "travel_templates_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "travel_templates" ADD CONSTRAINT "travel_templates_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "template_days" ADD CONSTRAINT "template_days_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "template_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "travel_templates" ADD CONSTRAINT "travel_templates_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Published snapshots are immutable. Draft tables remain editable; publishing
-- copies them into a version row that can never be updated in place.
CREATE OR REPLACE FUNCTION prevent_template_version_update()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'template_versions rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_versions_immutable
BEFORE UPDATE ON "template_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_template_version_update();
