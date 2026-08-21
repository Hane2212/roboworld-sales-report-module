-- Schema cho PostgreSQL (Supabase / Neon / Vercel Postgres). Tương đương schema.sqlite.sql.

-- ALTER TABLE deals
--   ADD COLUMN stage_entered_at DATE,
--   ADD COLUMN last_activity_at DATE,
--   ADD COLUMN next_follow_up_at DATE,
--   ADD COLUMN skip_demo_requested BOOLEAN NOT NULL DEFAULT FALSE,
--   ADD COLUMN skip_demo_reason TEXT,
--   ADD COLUMN skip_demo_approval TEXT CHECK (skip_demo_approval IN ('Chờ duyệt','Đã duyệt','Từ chối')),
--   ADD COLUMN outcome TEXT CHECK (outcome IN ('Win','Fail'));

CREATE TABLE IF NOT EXISTS sr_stage_history (
  id BIGSERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL,
  sales_name TEXT NOT NULL,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  reason TEXT DEFAULT '',
  changed_at DATE NOT NULL,
  changed_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sr_history_deal ON sr_stage_history(deal_id);

CREATE TABLE IF NOT EXISTS sr_reports (
  id BIGSERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL,
  sales_id TEXT NOT NULL,
  sales_name TEXT NOT NULL,
  type TEXT NOT NULL,
  stage TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT, file_type TEXT, file_size BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Đã nộp' CHECK (status IN ('Nháp','Đã nộp','Đã duyệt','Từ chối')),
  reviewed_by TEXT,
  review_note TEXT DEFAULT '',
  submitted_at DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  quality_has_images BOOLEAN, quality_has_conclusion BOOLEAN,
  quality_has_next_action BOOLEAN, quality_has_requirement BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_sr_reports_deal ON sr_reports(deal_id);
CREATE INDEX IF NOT EXISTS idx_sr_reports_sales_month ON sr_reports(sales_name, submitted_at);

CREATE TABLE IF NOT EXISTS sr_audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  by_user TEXT NOT NULL,
  action TEXT NOT NULL,
  deal_id TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS sr_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
INSERT INTO sr_settings(key, value) VALUES
  ('remindDays', '[3,5,7]'),
  ('stageOverdueDays', '14'),
  ('requiredReports', '{"Demo":"BC Demo"}'),
  ('requireLeaderApprovalForSkip', 'true')
ON CONFLICT (key) DO NOTHING;
