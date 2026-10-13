ALTER TABLE ebm_device
    ADD COLUMN IF NOT EXISTS training_mode boolean NOT NULL DEFAULT false;
