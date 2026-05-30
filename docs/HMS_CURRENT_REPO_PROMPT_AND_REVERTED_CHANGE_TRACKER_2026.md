# HMS Current Repo Prompt And Reverted Change Tracker

Date: 2026-05-28

This document tracks the prompts given in this repo and the useful work that was implemented, reverted, restored, or still needs review. It exists because the large Reservation PMS rebuild was reverted, but that reverted work contained several useful operational and UI improvements that should not be forgotten.

## Why This Exists

The repo went through a large reservation rebuild, then the user asked to revert back to the old reservation pages and logic. Because some useful changes were inside that reverted work, this file records:

- the prompts that drove the work,
- the useful features that were implemented before the revert,
- what has already been restored on top of the current old reservation flow,
- what still needs audit before reintroducing anything.

## Important Prompt Dates: 2026-05-21 And 2026-05-22

These are the dates the user specifically wants to track because they contain many useful prompts and features that may have been mixed with later reverted reservation work.

### 2026-05-21 Prompts

1. Guest Management PMS audit:
  - Prompt: "Audit my hotel management system and specifically review the Guest Management module end-to-end."
  - Main request:
    - scan the whole codebase,
    - compare Guest Management against hotel PMS standards,
    - identify done/partial/missing areas,
    - implement or refactor missing guest management features.
  - Important feature area:
    - guest profile,
    - guest documents,
    - guest history,
    - reservation/billing/housekeeping integration.
  - Specific useful guest-detail changes to track:
    - loyalty points should be system-calculated from posted stays, invoices, and eligible spend, not manually entered from the guest detail UI,
    - guest profile should show loyalty tier, points, next tier progress, and benefits without a staff `Add points` manual control,
    - `Feedback & Sentiment`, `Complaints (ops)`, `Preferences`, `Flags & Communication`, and `Registry & ops` should be clean staff-facing tabs,
    - `Registry & ops` should not show raw JSON; it should show structured sections for guest type, emergency contact, corporate billing, documents, communication log, active stay, internal notes, behavior notes, and sensitive incidents for managers.
2. Unified Folio domain:
  - Prompt: "Audit and refactor hotel PMS financial logic into a unified Folio domain."
  - Main request:
    - create `FolioLedgerService`,
    - standardize tax configuration,
    - remove hardcoded tax mismatches,
    - create folio/transaction tables,
    - centralize charges, payments, balance, deposits, taxes.
  - Important feature area:
    - single source of truth for guest/reservation folio,
    - hotel-level `tax_rate`,
    - ledger posting.
3. Folio frontend/tax follow-up:
  - Prompt: "where can i see that folio changes made, also on frontend i still see 15% vat"
  - Main request:
    - expose folio changes clearly in the frontend,
    - fix VAT display mismatch.
  - Important feature area:
    - invoice/folio UI consistency,
    - tax display using hotel config.
4. Invoice tax issue:
  - Prompt: user showed invoice page still displaying `Tax (15%)`.
  - Main request:
    - fix invoice tax label/calculation mismatch.
  - Important feature area:
    - invoice display,
    - folio tax consistency.
5. Guest complaints and incident workflow:
  - Prompt: "Implement operational complaint and incident workflow for hotel PMS."
  - Main request:
    - create `guest_complaints`,
    - add severity, assignment, SLA workflow, resolution tracking,
    - APIs for create/list/update/assign,
    - complaint list UI,
    - guest profile complaint history,
    - dashboard complaint counts,
    - reports for resolution time and complaint type.
  - Important feature area:
    - guest complaints,
    - incidents,
    - SLA operations.
6. Group and corporate billing routing:
  - Prompt: "Implement group and corporate billing routing in hotel PMS."
  - Main request:
    - create corporate accounts,
    - create group bookings,
    - support billing preferences:
      - `MASTER_PAYS_ALL`,
      - `SPLIT_BILLING`,
      - `GUEST_PAYS_INCIDENTALS`,
    - route charges to master/member folios,
    - add group booking dashboard,
    - enforce checkout rules.
  - Important feature area:
    - group billing,
    - corporate accounts,
    - routed folios.
7. Guest analytics dashboard:
  - Prompt: "Implement guest analytics dashboard for hotel PMS."
  - Main request:
    - nationality distribution,
    - repeat guests,
    - VIP guests,
    - no-show rate,
    - average stay duration,
    - lifetime value,
    - revenue per guest,
    - `/reports/guests`,
    - dashboard screen with charts.
  - Important feature area:
    - reporting,
    - guest analytics,
    - charts.
8. Dashboard and Reports graph upgrade:
  - Prompt: "on /app/reports /app/dashboard replace these number stats with different graphs all tabs on reports give graphs, and on dashboard has to be professional graphs"
  - Main request:
    - replace static stat cards with professional charts,
    - add graphs across report tabs,
    - upgrade dashboard visual presentation.
  - Important feature area:
    - charts,
    - dashboard/reports UI.
9. Push/commit follow-ups:
  - Prompts included:
    - "push everything please"
    - "push these too"
    - "push PS D:\PERSONNEL\HMS> git status..."
  - Main request:
    - commit and push changed files.
  - Important feature area:
    - repository state tracking.
10. Group block room type selection:
  - Prompt: "on group block Create Group Block popup i want you to add dropdown that selects room types..."
    - Main request:
      - add room type dropdown to group creation/block flow,
      - show room types from `/app/room-types`,
      - make group block/reserve flow clearer.
    - Important feature area:
      - group blocks,
      - room type selection,
      - group reservation usability.
11. Group room type price visibility:
  - Prompt: "can we show the room type prices too? because i need to know how much price for room type i am booking"
    - Main request:
      - show room type price when choosing group block rooms.
    - Important feature area:
      - group booking pricing clarity.
12. Smart group management availability:
  - Prompt: "on creation of group Demand sketch... show me room type available only not all... if I type 3 guests show me room type as room types available..."
    - Main request:
      - show only available room types,
      - react to guest/room demand,
      - make group management smart/AI-like.
    - Important feature area:
      - availability filtering,
      - AI-style group demand analysis.
13. Group UI responsiveness:
  - Prompt: "ui is not friendly not responsive even not good looking"
    - Main request:
      - improve responsive UI and visual quality.
    - Important feature area:
      - group management UI polish.
14. Group card overflow and future scalability:
  - Prompt: "still overflowing cards the texts, can you also think if i have many rooms... like 25+ rooms how will be displayed..."
    - Main request:
      - fix card overflow,
      - design scalable layout for many rooms.
    - Important feature area:
      - responsive cards,
      - large inventory display.
15. Selectable room type/room fit:
  - Prompt: "NOW MAKE IT SELECTABLE/CLICKABLE... if we have 3 that fits the description I can select one among 3 and direct booking/reservation to that room when I create that group"
    - Main request:
      - make matching options clickable/selectable,
      - carry selected room/room type into group reservation.
    - Important feature area:
      - direct booking from group availability suggestions.

### 2026-05-22 Prompts

1. Reservation form research:
  - Prompt: "okay this is good, now lets look on forms on reservations, what are questions do other system ask or input for reserving room for the guest? are these really enough? add them too"
  - Main request:
    - research what mature PMS systems ask during reservation creation,
    - add missing reservation form fields/questions.
  - Important feature area:
    - reservation form completeness,
    - guest/stay/market/billing/guarantee/preferences.
2. Full Reservation PMS rebuild:
  - Prompt: "implement all reservation system as it is in document update that reservation according to this research make sure everything is implemented"
  - Main request:
    - implement the Reservation PMS Rebuild Plan from `docs/HMS_ERP_COMPETITIVE_GAP_AUDIT_2026.md`.
  - Important feature area:
    - full reservation wizard,
    - reservation backend models,
    - PMS-style reservation detail,
    - group reservation engine,
    - notifications,
    - operational automation.
3. ReservationService compile fix:
  - Prompt: user pasted `mvn clean spring-boot:run` compilation errors in `ReservationService.java`.
  - Main request:
    - fix backend compilation after the reservation rebuild.
4. GroupBookingService compile fix:
  - Prompt: user pasted `mvn clean spring-boot:run` compilation errors in `GroupBookingService.java`.
  - Main request:
    - fix backend compilation in group booking logic.
5. Zero-money reservation bug:
  - Prompt: user showed a created reservation with:
    - `Balance due 0 USD`,
    - `Room charges 0 USD`,
    - `Total 0 USD`,
    - and said the system allowed creating without calculating room money.
  - Main request:
    - prevent reservations from being created without a real room rate,
    - calculate room charges correctly.
  - Important feature area:
    - reservation pricing validation,
    - backend rate enforcement,
    - frontend submit guards.
6. Group reservation check:
  - Prompt: "what about group reservation did you also look about it?"
  - Main request:
    - ensure group reservation flow also has correct pricing and logic.
7. Push everything:
  - Prompt: "do git push everything don't left anything uncommited or pushed"
  - Main request:
    - commit and push all implemented reservation work.
8. Revert reservation rebuild:
  - Prompt: "i need you to revert and come back to old reservation pages and logics look commit before that we made and return there"
  - Main request:
    - revert the full Reservation PMS rebuild,
    - restore old reservation pages and logic.
  - Important note:
    - this is the key revert that caused useful changes to be lost or mixed with reverted work.
9. Feature audit after reverting:
  - Prompt included required features:
    - search availability by date + room type,
    - auto-suggest room based on preferences,
    - calculate total price with taxes,
    - collect deposit/full payment,
    - generate unique booking reference,
    - send confirmation email/SMS,
    - modify dates with rebooking fee,
    - room upgrade/change,
    - extend stay,
    - add extra services,
    - attach documents,
    - cancellation policy enforcement,
    - partial/full refund calculation,
    - cancellation reason tracking,
    - group reservations,
    - individual check-in/out per room,
    - master bill/split billing.
  - Main request:
    - check if these are implemented with correct logic,
    - implement missing gaps on the old/current reservation flow.
10. Reservation confirmation email and cancellation/refund check:
  - Prompt: "i need email reservation confirming that user has reserved that room within that period... everything send in email during reservation... also is this working Cancellation & Refunds..."
    - Main request:
      - send complete reservation confirmation email,
      - confirm cancellation/refund logic works.
11. Marketing consent birthday automation and Flyway error:
  - Prompt: user asked for marketing-consent birthday emails and pasted backend startup/Flyway validation errors.
    - Main request:
      - send birthday wishes only for guests with marketing consent,
      - include hotel name,
      - fix Flyway validation after revert.
12. Reservation email not received:
  - Prompt: "i created reservation but didnt receive email"
    - Main request:
      - debug reservation confirmation email queue/sending.
13. Consistent email template formatting:
  - Prompt: "make sure all email templates format are formatted as this reservations, i don't need to have one looking good and other looks plain raw texts"
    - Main request:
      - apply branded HTML formatting to all email templates.

## Prompt History

1. Reservation form research:
  - Prompt: "okay this is good, now lets look on forms on reservations, what are questions do other system ask or input for reserving room for the guest? are these really enough? add them too"
  - Intent: Improve reservation forms with mature PMS-style guest, stay, billing, preference, and guarantee fields.
2. Full Reservation PMS rebuild:
  - Prompt: "implement all reservation system as it is in document update that reservation according to this research make sure everything is implemented"
  - Intent: Implement the comprehensive plan in `docs/HMS_ERP_COMPETITIVE_GAP_AUDIT_2026.md`.
3. Backend compile fixes:
  - Prompt: user pasted `mvn clean spring-boot:run` compilation errors in `ReservationService.java`.
  - Intent: Fix backend compilation after the reservation rebuild.
4. Group booking compile fixes:
  - Prompt: user pasted `mvn clean spring-boot:run` compilation errors in `GroupBookingService.java`.
  - Intent: Fix backend compilation after group booking changes.
5. Zero room-charge reservation bug:
  - Prompt: user showed a reservation with `Balance due 0 USD`, `Room charges 0 USD`, and said the system allowed creating a booking without calculating room money.
  - Intent: Prevent zero-value reservations and enforce real room rate calculation.
6. Group reservation audit:
  - Prompt: "what about group reservation did you also look about it?"
  - Intent: Ensure group reservations were also reviewed and protected from zero-price booking.
7. Git push request:
  - Prompt: "do git push everything don't left anything uncommited or pushed"
  - Intent: Commit and push the implemented changes.
8. Revert request:
  - Prompt: "i need you to revert and come back to old reservation pages and logics look commit before that we made and return there"
  - Intent: Revert the full Reservation PMS rebuild and restore previous reservation UI/logic.
9. Reservation feature audit after revert:
  - Prompt included key features:
    - Search availability by date + room type
    - Auto-suggest room based on preferences
    - Calculate total price with taxes
    - Collect deposit or full payment
    - Generate unique booking reference
    - Send confirmation email/SMS
    - Modify dates with rebooking fee
    - Room upgrade/change
    - Extend stay
    - Add extra services
    - Attach documents
    - Cancellation policy enforcement
    - Partial/full refund calculation
    - Cancellation reason tracking
    - Group reservations, master bill, split billing
  - Intent: Audit and implement missing pieces without bringing back the full rebuilt reservation pages.
10. Reservation confirmation email:
  - Prompt: "i need email reservation confirming that user has reserved that room within that period... everything send in email during reservation..."
    - Intent: Send a complete transactional confirmation email with full reservation details, independent of marketing consent.
11. Marketing consent and birthday automation:
  - Prompt: user asked that guests with marketing consent and known birthday receive automated birthday wishes, including hotel name for multi-hotel use.
    - Intent: Add consent-based marketing automation and hotel-specific branding.
12. Flyway validation failure:
  - Prompt: user pasted backend startup logs showing Flyway validation errors after the revert.
    - Intent: Restore missing migration files or align Flyway state so backend can start.
13. Email not received:
  - Prompt: "i created reservation but didnt receive email"
    - Intent: Debug email queueing/dispatch and make reservation emails actually send.
14. Consistent email formatting:
  - Prompt: "make sure all email templates format are formatted as this reservations..."
    - Intent: Make every guest-facing email use the same branded HTML style, not plain text.
15. Email dispatcher crash:
  - Prompt: user pasted `Not in multipart mode` stack trace from `EmailNotificationDispatcher`.
    - Intent: Fix HTML email dispatch so queued emails send successfully.
16. Smart Ops restore:
  - Prompt: user requested restored useful features from the reverted commit, including:
    - global notification bell,
    - mark all read,
    - click notification to mark as read,
    - per-hotel localStorage read state,
    - changed alert details reappear,
    - all caught up empty state,
    - overdue reservation sections,
    - bell on all staff pages,
    - smarter ERP-style operational notifications,
    - redesigned settings page,
    - hotel company profile fields,
    - extend stay instead of overstay charge for valid extra nights.
    - Intent: Restore useful operational UX without changing current reservation pages.
17. Audit logs restore:
  - Prompt: user added that the reverted work moved `Recent Activity` from Dashboard to Audit Logs and upgraded Audit Logs.
    - Intent: Restore that Audit Logs upgrade and keep Dashboard cleaner.
18. Prompt tracker and bell readability:
  - Prompt: user asked for this document and reported that the notification bell dropdown was overflowing behind page content with unreadable green gradient text.
    - Intent: Fix bell layout/colors and document all current repo prompts/useful reverted changes.

## Large Reverted Reservation PMS Rebuild

The reverted rebuild was intended to replace the reservation workflow with a mature PMS reservation engine. Useful ideas from that work included:

- richer reservation wizard,
- PMS-style event stream on reservation detail,
- stronger guest/stay/billing/preference capture,
- group reservation enhancements,
- operational notifications and queues,
- better folio/action grouping,
- smarter audit and activity views,
- improved settings/company profile UX.

The full rebuild was reverted because the user wanted to return to the old reservation pages and logic. Any future reintroduction should be selective and should not replace the current reservation flow unless explicitly requested.

## Useful Changes Already Restored On Current Flow

### Reservation Pricing Safety

- Backend validation prevents creating reservations with zero or negative nightly room rate.
- Frontend guards prevent submitting a reservation when selected rate/total is missing or zero.
- Group reservation UI guards prevent booking a group block with no positive room rate.

### Cancellation And Refund Logic

- Cancellation reason tracking added.
- Cancellation penalty/refundable amount fields added.
- Backend calculates cancellation decision based on policy timing.
- Frontend cancellation flow shows penalty/refund feedback.

### Modify / Extend Stay

- Existing reservation detail page keeps the `Modify / extend stay` modal.
- Checked-in stays can only change departure date.
- For checked-in extensions, backend now treats another night as `Extend Stay`, not overstay:
  - validates availability,
  - updates checkout date,
  - posts incremental `ROOM_NIGHT` charge,
  - reverses matching overstay/late-checkout charges when applicable.

### Email System

- Reservation confirmation email is transactional and does not require marketing consent.
- Confirmation email includes full reservation, guest, stay, room, price, deposit, and policy details.
- Birthday greetings are marketing/consent-based.
- Check-in reminders and checkout/thank-you emails are transactional.
- All guest-facing email bodies now use branded HTML templates.
- Email dispatcher was fixed to send multipart HTML + plain-text fallback correctly.

### Smart Notification Bell

- Global staff bell added through `HotelStaffShell`.
- Appears across hotel staff pages:
  - Dashboard
  - Reports
  - Accounting
  - Guest analytics
  - Room Types
  - Rooms
  - Room Blocks
  - Reservations
  - Groups & Events
  - Invoices
  - Guests
  - Staff
  - Housekeeping
  - My HK tasks
  - Service Requests
  - Facilities
  - Menu
  - POS
  - Self orders
  - Inventory
  - F&B
  - Pricing
  - Channels
  - IoT & Smart Room
  - Audit Logs
  - Settings
- Supports:
  - unread count,
  - `Mark all read`,
  - click to mark read,
  - per-hotel localStorage dismissed state,
  - changed signatures reappearing,
  - `All caught up` empty state.
- Current alert sources:
  - overdue checked-in stays,
  - departures due today,
  - arrivals today,
  - existing operations alert cards from executive dashboard.

### Overdue Reservation Visibility

- Bell links to filtered reservation attention views, such as:
  - `/app/reservations?attention=overdue`
  - `/app/reservations?attention=departures`
  - `/app/reservations?attention=arrivals`
- Reservation list now shows a clear `Smart notification view` section so staff can understand why they landed there.
- Rows show operational badges such as `Overdue checkout`, `Due today`, and `Arriving today`.

### Audit Logs Upgrade

- `Recent Activity` was removed from Dashboard.
- Audit Logs now contains:
  - operational header,
  - summary cards,
  - recent activity section,
  - search/filter controls,
  - action badges,
  - full audit trail table.

### Settings And Company Profile

- Settings page redesigned into compact cards:
  - Company profile
  - Branding
  - Operations
- Added fields:
  - hotel display name,
  - company name,
  - email,
  - telephone,
  - location/address,
  - TIN number,
  - invoice prefix,
  - logo,
  - cover image,
  - currency,
  - timezone,
  - check-in/check-out time,
  - tax rate.
- Backend settings response/update supports:
  - `companyName`,
  - `tinNumber`,
  - `imageUrl`.
- Settings update is partial-safe and no longer nulls unrelated fields when the UI sends a limited payload.

## Useful Reverted Ideas Still Worth Reviewing

These should be reviewed before reintroducing:

- Full PMS reservation wizard step-by-step form.
- PMS event timeline with richer event types.
- Room preference auto-assignment beyond current availability logic.
- Document attachment workflow for ID scan/contract on reservations.
- Full group booking master/split billing UX polish.
- Notification preference center and role-targeted alerts.
- More backend-generated notification inbox records instead of only frontend-computed smart signals.
- Overstay charge lifecycle with explicit charge status/voiding instead of reversal entries.

## Safety Rule For Future Work

Do not restore the reverted Reservation PMS rebuild wholesale unless explicitly requested. Restore useful features selectively on top of the current reservation pages and current backend flow.