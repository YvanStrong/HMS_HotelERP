-- Extra EBM ACK fields for invoice/refund SDC INFORMATION blocks
ALTER TABLE taxable_sale_event
    ADD COLUMN IF NOT EXISTS ebm_internal_data TEXT,
    ADD COLUMN IF NOT EXISTS ebm_invoice_no VARCHAR(64);
