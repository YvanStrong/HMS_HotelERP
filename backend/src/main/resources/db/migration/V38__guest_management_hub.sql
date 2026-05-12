-- Extended guest registry (profile, corporate, emergency) + document & communication logs

ALTER TABLE guests ADD COLUMN IF NOT EXISTS guest_type VARCHAR(30) NOT NULL DEFAULT 'RETURNING';

ALTER TABLE guests ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(128);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(64);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(64);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS behavior_notes TEXT;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS loyalty_member_number VARCHAR(64);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS corporate_company_name VARCHAR(200);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS corporate_account_code VARCHAR(64);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS corporate_billing_instructions TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS corporate_credit_limit NUMERIC(14, 2);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS corporate_negotiated_rate_note TEXT;

CREATE TABLE IF NOT EXISTS guest_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES app_users(id)
);

CREATE INDEX IF NOT EXISTS idx_guest_documents_guest ON guest_documents(guest_id);

CREATE TABLE IF NOT EXISTS guest_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    channel VARCHAR(30) NOT NULL,
    subject VARCHAR(200),
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES app_users(id)
);

CREATE INDEX IF NOT EXISTS idx_guest_comm_guest ON guest_communications(guest_id, created_at DESC);
