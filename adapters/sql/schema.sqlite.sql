-- Schema cho SQLite / Cloudflare D1.
-- NGUYÊN TẮC: không tạo bảng trùng với CRM. Nếu CRM đã có bảng users/customers/deals,
-- chỉ THÊM CỘT vào bảng deal hiện có (xem khối ALTER bên dưới) và tạo 3 bảng mới.

-- ── 1. Thêm cột vào bảng deal/khách hàng sẵn có của CRM ──
-- ALTER TABLE deals ADD COLUMN stage_entered_at TEXT;          -- YYYY-MM-DD
-- ALTER TABLE deals ADD COLUMN last_activity_at TEXT;
-- ALTER TABLE deals ADD COLUMN next_follow_up_at TEXT;
-- ALTER TABLE deals ADD COLUMN skip_demo_requested INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE deals ADD COLUMN skip_demo_reason TEXT;
-- ALTER TABLE deals ADD COLUMN skip_demo_approval TEXT;        -- 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'
-- ALTER TABLE deals ADD COLUMN outcome TEXT;                   -- 'Win' | 'Fail'

-- ── 2. Bảng mới ──
CREATE TABLE IF NOT EXISTS sr_stage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id TEXT NOT NULL,
  sales_name TEXT NOT NULL,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  reason TEXT DEFAULT '',
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sr_history_deal ON sr_stage_history(deal_id);

CREATE TABLE IF NOT EXISTS sr_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id TEXT NOT NULL,
  sales_id TEXT NOT NULL,
  sales_name TEXT NOT NULL,
  type TEXT NOT NULL,             -- 'BC Demo' | 'BC Skip Demo' | ...
  stage TEXT NOT NULL,            -- stage lúc nộp
  file_url TEXT NOT NULL,         -- link Google Drive (hoặc storage của CRM)
  file_name TEXT, file_type TEXT, file_size INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Đã nộp',  -- Nháp | Đã nộp | Đã duyệt | Từ chối
  reviewed_by TEXT,
  review_note TEXT DEFAULT '',
  submitted_at TEXT NOT NULL,
  updated_at TEXT,
  -- chừa sẵn cho Report Quality (MVP 4) — chưa dùng
  quality_has_images INTEGER, quality_has_conclusion INTEGER,
  quality_has_next_action INTEGER, quality_has_requirement INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sr_reports_deal ON sr_reports(deal_id);
CREATE INDEX IF NOT EXISTS idx_sr_reports_sales_month ON sr_reports(sales_name, submitted_at);

CREATE TABLE IF NOT EXISTS sr_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  by_user TEXT NOT NULL,
  action TEXT NOT NULL,           -- STAGE_CHANGED | REPORT_SUBMITTED | SKIP_APPROVED | ...
  deal_id TEXT,
  detail TEXT
);

-- ── 3. Cấu hình (1 dòng JSON, Admin sửa được) ──
CREATE TABLE IF NOT EXISTS sr_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO sr_settings(key, value) VALUES
  ('remindDays', '[3,5,7]'),
  ('stageOverdueDays', '14'),
  ('requiredReports', '{"Demo":"BC Demo"}'),
  ('requireLeaderApprovalForSkip', 'true');
