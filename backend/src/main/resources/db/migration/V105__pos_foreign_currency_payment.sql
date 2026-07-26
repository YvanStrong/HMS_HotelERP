-- Foreign-currency tender on POS sales (e.g. customer pays USD/EUR, hotel books in RWF).
ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(14, 2);

COMMENT ON COLUMN depot_sales.payment_currency IS 'Currency the customer tendered (e.g. USD, EUR). Null/blank means hotel base currency.';
COMMENT ON COLUMN depot_sales.exchange_rate IS 'Hotel-currency units per 1 unit of payment_currency (e.g. RWF per 1 USD).';
COMMENT ON COLUMN depot_sales.foreign_amount IS 'Amount received in payment_currency.';
