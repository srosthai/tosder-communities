ALTER TABLE "destinations" ADD COLUMN "save_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "saved_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "template_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_templates_user_id_template_id_key" ON "saved_templates"("user_id", "template_id");
CREATE INDEX "saved_templates_template_id_idx" ON "saved_templates"("template_id");
CREATE INDEX "saved_templates_user_id_created_at_idx" ON "saved_templates"("user_id", "created_at");

CREATE TABLE "saved_destinations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "destination_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_destinations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_destinations_user_id_destination_id_key" ON "saved_destinations"("user_id", "destination_id");
CREATE INDEX "saved_destinations_destination_id_idx" ON "saved_destinations"("destination_id");
CREATE INDEX "saved_destinations_user_id_created_at_idx" ON "saved_destinations"("user_id", "created_at");

ALTER TABLE "saved_templates" ADD CONSTRAINT "saved_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_templates" ADD CONSTRAINT "saved_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "travel_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_destinations" ADD CONSTRAINT "saved_destinations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_destinations" ADD CONSTRAINT "saved_destinations_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
