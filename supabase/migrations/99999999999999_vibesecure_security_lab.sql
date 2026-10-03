-- VibeSecure security test fixture.
-- Intentionally insecure: this table is created without enabling RLS.
-- Do not use this migration on a real production database.

CREATE TABLE insecure_profiles (
  id uuid PRIMARY KEY,
  email text,
  role text,
  notes text
);
