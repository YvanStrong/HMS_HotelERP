UPDATE hotels
SET tax_rate = 0.03
WHERE tax_rate IS NULL
   OR tax_rate <= 0
   OR (tax_rate >= 0.179 AND tax_rate <= 0.181)
   OR (tax_rate >= 17.9 AND tax_rate <= 18.1);
