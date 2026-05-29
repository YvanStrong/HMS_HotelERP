ALTER TABLE platform_tenants
  ADD COLUMN IF NOT EXISTS manually_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_block_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_by UUID,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_payment_confirmed_at TIMESTAMP;

UPDATE platform_tenants
SET billing_status = 'EXPIRING_SOON'
WHERE billing_status = 'PAST_DUE';

UPDATE platform_tenants
SET billing_status = 'EXPIRED'
WHERE billing_status = 'SUSPENDED';

CREATE TABLE IF NOT EXISTS tenant_subscription_audit (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32),
  actor_id UUID,
  note TEXT,
  old_expiry TIMESTAMP,
  new_expiry TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscription_audit_hotel_created
  ON tenant_subscription_audit(hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_payment_record (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  months_paid INTEGER NOT NULL,
  amount NUMERIC(14, 2),
  currency VARCHAR(8),
  payment_reference VARCHAR(128),
  confirmed_by UUID,
  confirmed_at TIMESTAMP NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_record_hotel_created
  ON tenant_payment_record(hotel_id, created_at DESC);
