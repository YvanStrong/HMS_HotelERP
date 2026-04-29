-- Phase 1 Step 4: track when DND was enabled (supervisor stale-DND alerts).
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS dnd_set_at TIMESTAMPTZ;
UPDATE rooms SET dnd_set_at = updated_at WHERE dnd = true AND dnd_set_at IS NULL;

-- Phase 1 Step 5: auto-release operational holds by instant.
ALTER TABLE room_blocks ADD COLUMN IF NOT EXISTS auto_release BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE room_blocks ADD COLUMN IF NOT EXISTS blocked_until_instant TIMESTAMPTZ;
