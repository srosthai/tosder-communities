ALTER TABLE "member_profiles" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
CREATE INDEX "member_profiles_deleted_at_idx" ON "member_profiles"("deleted_at");
