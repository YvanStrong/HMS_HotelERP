ALTER TABLE platform_tenants
  DROP CONSTRAINT IF EXISTS platform_tenants_billing_status_check;

ALTER TABLE platform_tenants
  ADD CONSTRAINT platform_tenants_billing_status_check
  CHECK (billing_status IN ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'MANUALLY_BLOCKED'));
