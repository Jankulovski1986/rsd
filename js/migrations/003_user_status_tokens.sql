DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending','active','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'active';

-- For existing rows without explicit status, default applies.

DO $$ BEGIN
  CREATE TYPE token_type AS ENUM ('invite','reset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type token_type NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_tokens_idx ON user_tokens (user_id, type, expires_at);

