ALTER TABLE users ADD COLUMN github_profile_url TEXT;
ALTER TABLE users ADD COLUMN github_readme_enabled INTEGER NOT NULL DEFAULT 0 CHECK (github_readme_enabled IN (0, 1));
ALTER TABLE users ADD COLUMN github_username TEXT;
ALTER TABLE users ADD COLUMN github_default_branch TEXT;
ALTER TABLE users ADD COLUMN github_readme_etag TEXT;
ALTER TABLE users ADD COLUMN github_readme_html TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN github_avatar_url TEXT;
ALTER TABLE users ADD COLUMN github_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN github_bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN github_synced_at TEXT;
ALTER TABLE users ADD COLUMN github_sync_error TEXT NOT NULL DEFAULT '';

UPDATE users
SET github_profile_url = 'https://github.com/UnoxyRich',
    github_readme_enabled = 1
WHERE display_name = 'UnoxyRich' COLLATE NOCASE
  AND github_profile_url IS NULL;
