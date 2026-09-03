ALTER TABLE users ADD COLUMN public_slug TEXT;
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(skills_json));
ALTER TABLE users ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(links_json));
ALTER TABLE users ADD COLUMN readme_draft TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN readme_published TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN privacy_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(privacy_json));
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived'));

UPDATE users
SET public_slug =
  trim(
    replace(replace(replace(replace(replace(lower(display_name), ' ', '-'), '_', '-'), '.', '-'), '/', '-'), '--', '-'),
    '-'
  ) || '-' || lower(substr(replace(id, '-', ''), 1, 8))
WHERE public_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_public_slug_unique ON users(public_slug);
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users(role, status);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_status_idx ON team_members(user_id, status);
CREATE INDEX IF NOT EXISTS team_members_team_status_idx ON team_members(team_id, status);

CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  message TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  responded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique
  ON team_invitations(team_id, invited_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS team_invitations_invitee_idx
  ON team_invitations(invited_user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL DEFAULT '',
  demo_url TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'changes-requested', 'approved', 'published', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'private')),
  moderation_notes TEXT NOT NULL DEFAULT '',
  moderated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TEXT,
  moderated_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS projects_owner_status_idx ON projects(owner_user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS projects_team_status_idx ON projects(team_id, status, updated_at);
CREATE INDEX IF NOT EXISTS projects_visibility_status_idx ON projects(visibility, status, published_at);

CREATE TABLE IF NOT EXISTS project_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_assets_project_idx ON project_assets(project_id, sort_order);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  action_url TEXT,
  related_type TEXT,
  related_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  read_at TEXT,
  archived_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON notifications(recipient_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications(recipient_user_id, created_at DESC) WHERE read_at IS NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  access TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'members', 'staff')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_revision_id TEXT,
  opens_at TEXT,
  closes_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS form_revisions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  schema_json TEXT NOT NULL CHECK (json_valid(schema_json)),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE(form_id, revision_number)
);

CREATE INDEX IF NOT EXISTS form_revisions_form_idx ON form_revisions(form_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS form_responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL REFERENCES form_revisions(id) ON DELETE RESTRICT,
  respondent_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'withdrawn')),
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS form_responses_form_idx ON form_responses(form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS form_responses_user_idx ON form_responses(respondent_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS form_answers (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  created_at TEXT NOT NULL,
  UNIQUE(response_id, field_id)
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all', 'role')),
  audience_value TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'cancelled')),
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending', 'delivered', 'failed')),
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(broadcast_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS broadcast_deliveries_recipient_idx
  ON broadcast_deliveries(recipient_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  visibility TEXT NOT NULL DEFAULT 'staff' CHECK (visibility IN ('public', 'members', 'staff')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_events_subject_idx ON activity_events(subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_created_idx ON activity_events(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON admin_audit_log(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_notes (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_notes_subject_idx ON staff_notes(subject_type, subject_id, created_at DESC);
