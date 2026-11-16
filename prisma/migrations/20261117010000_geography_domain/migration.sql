-- Enable PostGIS before creating the geography column and GiST index.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "provinces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "hero_image_url" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "province_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "province_id" UUID NOT NULL,
    "district_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "practical_tips" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" geography(Point, 4326),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "cover_photo_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "destination_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "credit" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destination_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_categories" (
    "destination_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "destination_categories_pkey" PRIMARY KEY ("destination_id", "category_id")
);

-- CreateTable
CREATE TABLE "destination_tags" (
    "destination_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "destination_tags_pkey" PRIMARY KEY ("destination_id", "tag_id")
);

-- CreateTable
CREATE TABLE "featured_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "featured_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_collection_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "featured_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_slug_key" ON "provinces"("slug");
CREATE INDEX "provinces_status_idx" ON "provinces"("status");
CREATE INDEX "provinces_name_idx" ON "provinces"("name");

-- CreateIndex
CREATE UNIQUE INDEX "districts_slug_key" ON "districts"("slug");
CREATE INDEX "districts_province_id_idx" ON "districts"("province_id");
CREATE INDEX "districts_status_idx" ON "districts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");
CREATE INDEX "destinations_province_id_idx" ON "destinations"("province_id");
CREATE INDEX "destinations_district_id_idx" ON "destinations"("district_id");
CREATE INDEX "destinations_status_idx" ON "destinations"("status");
CREATE INDEX "destinations_province_id_status_idx" ON "destinations"("province_id", "status");
CREATE INDEX "destinations_name_idx" ON "destinations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "destination_photos_destination_id_sort_order_key" ON "destination_photos"("destination_id", "sort_order");
CREATE INDEX "destination_photos_destination_id_idx" ON "destination_photos"("destination_id");

-- CreateIndex
CREATE INDEX "destination_categories_category_id_idx" ON "destination_categories"("category_id");
CREATE INDEX "destination_tags_tag_id_idx" ON "destination_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "featured_collections_slug_key" ON "featured_collections"("slug");
CREATE INDEX "featured_collections_status_idx" ON "featured_collections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "featured_collection_items_collection_id_destination_id_key" ON "featured_collection_items"("collection_id", "destination_id");
CREATE UNIQUE INDEX "featured_collection_items_collection_id_sort_order_key" ON "featured_collection_items"("collection_id", "sort_order");
CREATE INDEX "featured_collection_items_destination_id_idx" ON "featured_collection_items"("destination_id");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_photos" ADD CONSTRAINT "destination_photos_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_categories" ADD CONSTRAINT "destination_categories_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "destination_categories" ADD CONSTRAINT "destination_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_tags" ADD CONSTRAINT "destination_tags_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "destination_tags" ADD CONSTRAINT "destination_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_collection_items" ADD CONSTRAINT "featured_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "featured_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "featured_collection_items" ADD CONSTRAINT "featured_collection_items_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the PostGIS location in sync with the editable latitude/longitude.
CREATE OR REPLACE FUNCTION sync_destination_location() RETURNS trigger AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.location := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "destinations_location_sync"
BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "destinations"
FOR EACH ROW EXECUTE FUNCTION sync_destination_location();

CREATE INDEX "destinations_location_idx" ON "destinations" USING GIST ("location");
