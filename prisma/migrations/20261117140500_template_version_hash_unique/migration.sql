CREATE UNIQUE INDEX "template_versions_template_id_content_hash_key"
ON "template_versions"("template_id", "content_hash");
