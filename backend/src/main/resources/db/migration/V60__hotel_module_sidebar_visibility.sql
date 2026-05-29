ALTER TABLE hotel_module_entitlements
  ADD COLUMN IF NOT EXISTS show_when_disabled BOOLEAN NOT NULL DEFAULT FALSE;
