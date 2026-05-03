-- VAT flag: taxable items use 18% on receipt (VAT extracted from VAT-inclusive line totals).
ALTER TABLE depot_products ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE depot_sale_lines ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true;
