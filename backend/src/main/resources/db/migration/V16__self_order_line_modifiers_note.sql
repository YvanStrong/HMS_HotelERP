-- Optional per-line guest notes (modifiers, allergens, "no ice", etc.) for self-service orders.
DO $migration$
BEGIN
  IF to_regclass('public.self_service_order_lines') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE self_service_order_lines ADD COLUMN IF NOT EXISTS modifiers_note VARCHAR(280)';
  END IF;
END$migration$;
