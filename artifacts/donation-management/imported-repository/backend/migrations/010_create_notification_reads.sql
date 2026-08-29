CREATE TABLE IF NOT EXISTS donation_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notification_key TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_lookup
  ON donation_notification_reads (organization_id, user_id);