DO $$
BEGIN
  EXECUTE format('GRANT tosder_app TO %I', current_user);
END
$$;
