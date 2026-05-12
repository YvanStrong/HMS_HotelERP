-- Folio / hotel policy default VAT 18%. Legacy final invoices stored "Tax (15%)" line items.
-- 1) Move hotels still on ~15% to 0.18 (narrow band so we do not touch 16% or mixed regimes).
-- 2) Restate matching tax rows to 18% of the pre-tax subtotal (sum of positive lines before that row, excluding tax/VAT lines).
-- 3) Recompute invoice header total as the sum of line items (matches how invoices were originally composed).

UPDATE hotels
SET tax_rate = 0.18
WHERE tax_rate IS NOT NULL
  AND tax_rate >= 0.149
  AND tax_rate <= 0.151;

WITH tax_rows AS (
    SELECT li.id,
           li.invoice_id,
           li.line_order,
           li.amount AS old_tax
    FROM invoice_line_items li
    WHERE li.amount > 0
      AND li.description ~* '^tax\s*\(15%?|^vat\s*\(15%?'
),
pretax AS (
    SELECT t.id,
           COALESCE(
                   (
                       SELECT SUM(li2.amount)
                       FROM invoice_line_items li2
                       WHERE li2.invoice_id = t.invoice_id
                         AND li2.line_order < t.line_order
                         AND li2.amount > 0
                         AND li2.description !~* '^(tax|vat)\s*\('
                   ),
                   0
           ) AS subtotal
    FROM tax_rows t
)
UPDATE invoice_line_items li
SET amount       = ROUND((pretax.subtotal * 0.18)::numeric, 2),
    description = CASE
                      WHEN li.description ~* '^vat' THEN 'VAT (18%)'
                      ELSE 'Tax (18%)'
                  END
FROM pretax
WHERE li.id = pretax.id
  AND pretax.subtotal > 0;

UPDATE invoices i
SET total_amount = s.line_sum
FROM (
         SELECT invoice_id, SUM(amount) AS line_sum
         FROM invoice_line_items
         GROUP BY invoice_id
     ) s
WHERE i.id = s.invoice_id;
