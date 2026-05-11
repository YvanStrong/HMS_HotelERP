-- Ensure currency is never null (fix for intermittent null values)
UPDATE hotels SET currency = 'USD' WHERE currency IS NULL;
ALTER TABLE hotels ALTER COLUMN currency SET NOT NULL;
ALTER TABLE hotels ALTER COLUMN currency SET DEFAULT 'USD';
