-- Link menu outlets (inventory_depots) to ERP warehouses (inv_warehouses) for unified store selection.

ALTER TABLE inventory_depots
    ADD COLUMN IF NOT EXISTS inv_warehouse_id UUID REFERENCES inv_warehouses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_depots_inv_wh ON inventory_depots (inv_warehouse_id);

-- Match by identical codes where possible
UPDATE inventory_depots d
SET inv_warehouse_id = w.id
FROM inv_warehouses w
WHERE d.inv_warehouse_id IS NULL
  AND w.hotel_id = d.hotel_id
  AND upper(trim(w.code)) = upper(trim(d.code));

-- Principal depot (PRINC) ↔ PRINCIPAL warehouse
UPDATE inventory_depots d
SET inv_warehouse_id = w.id
FROM inv_warehouses w
WHERE d.inv_warehouse_id IS NULL
  AND upper(trim(d.code)) = 'PRINC'
  AND w.hotel_id = d.hotel_id
  AND upper(trim(w.code)) = 'PRINCIPAL';
