CREATE TABLE IF NOT EXISTS design_ratings (
  id TEXT PRIMARY KEY,
  variant_slug TEXT NOT NULL CHECK (variant_slug IN ('skyline-ribbon', 'blueberry-window', 'blueprint-paws', 'cloud-cat', 'after-school-club')),
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
  voter_cookie_hash TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (variant_slug, voter_cookie_hash),
  UNIQUE (variant_slug, device_fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS design_ratings_variant_idx ON design_ratings(variant_slug, created_at);
