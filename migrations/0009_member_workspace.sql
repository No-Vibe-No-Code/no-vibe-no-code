ALTER TABLE projects ADD COLUMN cover_image_key TEXT;
ALTER TABLE projects ADD COLUMN labels_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(labels_json));
ALTER TABLE teams ADD COLUMN avatar_image_key TEXT;
ALTER TABLE teams ADD COLUMN introduction_markdown TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN website_url TEXT;
ALTER TABLE notifications ADD COLUMN saved_at TEXT;

CREATE TABLE IF NOT EXISTS workspace_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(preferences_json)),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_updated_id_idx ON projects(updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS projects_title_id_idx ON projects(title COLLATE NOCASE,id);
CREATE INDEX IF NOT EXISTS teams_updated_id_idx ON teams(updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS notifications_saved_idx ON notifications(recipient_user_id,saved_at) WHERE saved_at IS NOT NULL;
