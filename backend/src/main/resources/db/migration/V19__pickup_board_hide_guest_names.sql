-- When true, public pickup-board API omits guest call-out names (codes + table/location still shown). Kitchen KDS unchanged.
ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS pickup_board_hide_guest_names BOOLEAN NOT NULL DEFAULT FALSE;
