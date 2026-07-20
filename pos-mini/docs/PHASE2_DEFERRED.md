# POS Mini — Phase 2 deferred features

The following items are intentionally **not** implemented. Search the codebase for matching `TODO(phase-2)` comments.

## Still deferred


| Feature                            | Reason                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Customer display second screen     | Requires dual-screen / external display APIs                                                          |
| Sale drafts synced across devices  | Needs cloud transport and conflict resolution                                                         |
| Full Excel import/export (`.xlsx`) | CSV export + validated CSV import exist; Excel adds heavy native deps                                 |
| Google Drive OAuth API             | Share sheet only; true OAuth is out of standalone scope                                               |
| HMS cloud sync Phase 8             | Out of pos-mini standalone scope                                                                      |
| USB/WiFi printers                  | Bluetooth thermal only in current native module                                                       |
| SMS/WhatsApp integrations          | Platform messaging APIs + compliance                                                                  |
| Multi-currency FX                  | Single currency per business today; FX needs rate source, rounding rules, and receipt/report redesign |
| Global landscape layouts           | Only sales checkout (`sales/new`) unlocks orientation; other screens stay portrait                    |


## Recently implemented (this pass)

- **Home chart removed** — weekly sales graph dropped from landing screen.
- **Onboarding tour** — first-launch walkthrough; `onboarding_complete` in `app_meta`.
- **Table/service mode (Phase G)** — schema v10: `pos_tables`, `sales.table_id`, pending open bills, merge tables, tables UI for restaurant/bar (`table_service`).
- **Composite/bundle products** — `product_bundles` table; edit on product detail. **Cart policy:** bundle parent sold as **one line** at parent price; stock deducted from **child** SKUs on checkout.
- **CSV bulk import preview** — `settings/import-csv` validates rows before import.
- **Landscape on sales checkout** — `expo-screen-orientation` unlocks while on `sales/new`, locks back to portrait on leave.

