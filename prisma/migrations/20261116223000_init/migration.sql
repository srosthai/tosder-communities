-- CreateTable
CREATE TABLE "todos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- The todos table is a temporary connectivity check. Keep it readable so the
-- sample Astro page and the /api/todos endpoint can prove the Supabase link.
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_public_read" ON "todos"
    FOR SELECT
    USING (true);
