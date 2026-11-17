ALTER TABLE "audit_events"
  ADD COLUMN "request_id" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB;

CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");
CREATE INDEX "audit_events_entity_type_created_at_idx" ON "audit_events"("entity_type", "created_at");

CREATE OR REPLACE FUNCTION prevent_audit_event_update()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_events rows are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_update();
