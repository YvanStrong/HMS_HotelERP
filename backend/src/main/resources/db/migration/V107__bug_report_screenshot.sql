-- Bug report screenshot / attachment evidence
ALTER TABLE bug_reports
    ADD COLUMN IF NOT EXISTS screenshot_data TEXT,
    ADD COLUMN IF NOT EXISTS screenshot_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS screenshot_content_type VARCHAR(128);
