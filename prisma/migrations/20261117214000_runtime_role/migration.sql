DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tosder_runtime') THEN
    CREATE ROLE tosder_runtime LOGIN;
  END IF;
END
$$;

-- The application does not yet set a per-request app.user_id, so the runtime
-- role bypasses RLS. It still has no DDL rights; owner credentials are reserved
-- for migrations and administration.
ALTER ROLE tosder_runtime BYPASSRLS;

GRANT USAGE ON SCHEMA public TO tosder_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tosder_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tosder_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tosder_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tosder_runtime;
