CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  english_name TEXT NOT NULL,
  chinese_name TEXT NOT NULL,
  wechat_id TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('non-member', 'member', 'maintainer', 'club-leader', 'teacher')),
  password_hash TEXT NOT NULL,
  profile_image_key TEXT,
  terms_accepted_at TEXT NOT NULL,
  is_initial_leader INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  wechat_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('competition_active', 'false');
