-- Legal/company details used on settings, invoices, and official documents.

ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS tin_number VARCHAR(64);

UPDATE hotels
SET company_name = name
WHERE company_name IS NULL;
