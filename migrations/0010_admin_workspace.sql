ALTER TABLE contacts ADD COLUMN assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN updated_at TEXT;
ALTER TABLE contacts ADD COLUMN resolved_at TEXT;
UPDATE contacts SET updated_at=created_at WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_status_created_idx ON contacts(status,created_at DESC,id DESC);

ALTER TABLE form_responses ADD COLUMN reviewed_at TEXT;
ALTER TABLE form_responses ADD COLUMN reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS form_responses_reviewed_idx ON form_responses(form_id,reviewed_at,submitted_at DESC,id DESC);

ALTER TABLE broadcasts ADD COLUMN updated_at TEXT;
ALTER TABLE broadcasts ADD COLUMN scheduled_at TEXT;
ALTER TABLE broadcasts ADD COLUMN send_started_at TEXT;
ALTER TABLE broadcasts ADD COLUMN send_claim_token TEXT;
ALTER TABLE broadcasts ADD COLUMN send_completed_at TEXT;
ALTER TABLE broadcasts ADD COLUMN last_error TEXT;
ALTER TABLE broadcasts ADD COLUMN recipient_total INTEGER NOT NULL DEFAULT 0;
UPDATE broadcasts SET updated_at=created_at,send_started_at=sent_at,send_completed_at=sent_at WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS broadcasts_due_idx ON broadcasts(status,scheduled_at,send_started_at,send_completed_at);

ALTER TABLE broadcast_deliveries ADD COLUMN claim_token TEXT;
ALTER TABLE broadcast_deliveries ADD COLUMN claim_at TEXT;
CREATE INDEX IF NOT EXISTS broadcast_deliveries_work_idx ON broadcast_deliveries(broadcast_id,status,claim_at);
