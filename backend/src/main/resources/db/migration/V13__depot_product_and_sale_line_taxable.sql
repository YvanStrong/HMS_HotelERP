-- VAT flag: taxable items use 18% on receipt (tables may be created by JPA / InventoryDepotSchemaPatch after Flyway).
DO $migration$
BEGIN
  IF to_regclass('public.depot_products') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE depot_products ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true';
  END IF;
  IF to_regclass('public.depot_sale_lines') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE depot_sale_lines ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true';
  END IF;
END$migration$;
