CREATE TABLE IF NOT EXISTS design_votes (
  id TEXT PRIMARY KEY,
  variant_slug TEXT NOT NULL CHECK (variant_slug IN ('skyline-ribbon', 'blueberry-window', 'blueprint-paws', 'cloud-cat', 'after-school-club')),
  voter_cookie_hash TEXT NOT NULL UNIQUE,
  device_fingerprint_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS design_votes_variant_idx ON design_votes(variant_slug, created_at);
