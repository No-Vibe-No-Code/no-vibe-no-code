CREATE TABLE IF NOT EXISTS nfc_cards (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'claimed', 'disabled')),
  claimed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TEXT,
  scan_count INTEGER NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  last_scanned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS nfc_cards_status_idx ON nfc_cards(status, created_at);
CREATE INDEX IF NOT EXISTS nfc_cards_claimed_user_idx ON nfc_cards(claimed_by_user_id);
