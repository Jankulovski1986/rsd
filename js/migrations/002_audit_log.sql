DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM ('create','update','delete','export','login');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  row_pk JSONB NOT NULL,
  before JSONB,
  after JSONB,
  actor_user_id INTEGER,
  actor_email TEXT,
  ip INET,
  user_agent TEXT,
  request_id UUID
);
CREATE INDEX IF NOT EXISTS audit_at_idx ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_table_idx ON audit_log (table_name);
CREATE INDEX IF NOT EXISTS audit_rowpk_gin ON audit_log USING GIN (row_pk);

