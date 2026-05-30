-- Allow fabrication stock movements in the legacy stock transaction type check.

ALTER TABLE stock_transactions
    DROP CONSTRAINT IF EXISTS stock_transactions_type_check;

ALTER TABLE stock_transactions
    ADD CONSTRAINT stock_transactions_type_check
    CHECK (type IN (
        'RECEIPT',
        'CONSUMPTION',
        'ADJUSTMENT',
        'TRANSFER',
        'WASTE',
        'FABRICATION_CONSUME',
        'FABRICATION_OUTPUT'
    ));
