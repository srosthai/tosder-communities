DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tosder_app') THEN
    CREATE ROLE tosder_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO tosder_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "user_trips",
  "user_trip_days",
  "user_trip_items",
  "user_trip_checklist_items",
  "saved_templates",
  "saved_destinations",
  "template_likes",
  "trip_reviews",
  "member_notifications"
TO tosder_app;

ALTER TABLE "user_trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_trip_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_trip_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_trip_checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_destinations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_trips_owner" ON "user_trips"
  USING ("owner_id" = current_setting('app.user_id', true))
  WITH CHECK ("owner_id" = current_setting('app.user_id', true));

CREATE POLICY "user_trip_days_owner" ON "user_trip_days"
  USING (EXISTS (
    SELECT 1 FROM "user_trips" t
    WHERE t.id = "user_trip_days"."trip_id"
      AND t."owner_id" = current_setting('app.user_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "user_trips" t
    WHERE t.id = "user_trip_days"."trip_id"
      AND t."owner_id" = current_setting('app.user_id', true)
  ));

CREATE POLICY "user_trip_items_owner" ON "user_trip_items"
  USING (EXISTS (
    SELECT 1 FROM "user_trip_days" d JOIN "user_trips" t ON t.id = d."trip_id"
    WHERE d.id = "user_trip_items"."day_id"
      AND t."owner_id" = current_setting('app.user_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "user_trip_days" d JOIN "user_trips" t ON t.id = d."trip_id"
    WHERE d.id = "user_trip_items"."day_id"
      AND t."owner_id" = current_setting('app.user_id', true)
  ));

CREATE POLICY "user_trip_checklist_owner" ON "user_trip_checklist_items"
  USING (EXISTS (
    SELECT 1 FROM "user_trips" t
    WHERE t.id = "user_trip_checklist_items"."trip_id"
      AND t."owner_id" = current_setting('app.user_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "user_trips" t
    WHERE t.id = "user_trip_checklist_items"."trip_id"
      AND t."owner_id" = current_setting('app.user_id', true)
  ));

CREATE POLICY "saved_templates_owner" ON "saved_templates"
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

CREATE POLICY "saved_destinations_owner" ON "saved_destinations"
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

CREATE POLICY "template_likes_owner" ON "template_likes"
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

CREATE POLICY "trip_reviews_owner" ON "trip_reviews"
  USING ("reviewer_id" = current_setting('app.user_id', true))
  WITH CHECK ("reviewer_id" = current_setting('app.user_id', true));

CREATE POLICY "member_notifications_owner" ON "member_notifications"
  USING ("user_id" = current_setting('app.user_id', true))
  WITH CHECK ("user_id" = current_setting('app.user_id', true));
