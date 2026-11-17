ALTER TABLE "member_profiles"
  ADD COLUMN "trusted_creator" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "template_versions"
  ADD COLUMN "content_hash" TEXT;
