-- Hide outlet copies of products that are already deactivated, so POS does not list them.
UPDATE depot_products dp
SET is_active = false
FROM inventory_items i
WHERE dp.inventory_item_id = i.id
  AND i.is_active = false;

-- Past invoices, purchase orders, and transfers keep their text when a product is deleted.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_class frel ON frel.oid = con.confrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
  WHERE con.contype = 'f'
    AND rel.relname = 'inv_sales_invoice_items'
    AND frel.relname = 'inventory_items'
    AND att.attname = 'item_id';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inv_sales_invoice_items DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE inv_sales_invoice_items ALTER COLUMN item_id DROP NOT NULL;
  ALTER TABLE inv_sales_invoice_items
    ADD CONSTRAINT inv_sales_invoice_items_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;

  cname := NULL;
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_class frel ON frel.oid = con.confrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
  WHERE con.contype = 'f'
    AND rel.relname = 'purchase_order_lines'
    AND frel.relname = 'inventory_items'
    AND att.attname = 'item_id';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE purchase_order_lines DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE purchase_order_lines ALTER COLUMN item_id DROP NOT NULL;
  ALTER TABLE purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;

  cname := NULL;
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_class frel ON frel.oid = con.confrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
  WHERE con.contype = 'f'
    AND rel.relname = 'inv_stock_transfer_items'
    AND frel.relname = 'inventory_items'
    AND att.attname = 'item_id';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inv_stock_transfer_items DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE inv_stock_transfer_items ALTER COLUMN item_id DROP NOT NULL;
  ALTER TABLE inv_stock_transfer_items
    ADD CONSTRAINT inv_stock_transfer_items_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;
END $$;
