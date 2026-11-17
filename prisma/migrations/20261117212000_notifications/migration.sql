CREATE TABLE "member_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "member_notifications_user_id_created_at_idx" ON "member_notifications"("user_id", "created_at");
ALTER TABLE "member_notifications" ADD CONSTRAINT "member_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "member_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
