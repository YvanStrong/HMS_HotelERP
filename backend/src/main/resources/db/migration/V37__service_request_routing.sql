ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS target_department VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_sr_department ON service_requests(target_department);
