# HMS ERP Competitive Gap Audit and 1000% Power Roadmap

Generated: 2026-05-22  
Repository: `D:/PERSONNEL/HMS`

## Purpose

This document scans the current HMS ERP/PMS project and compares it with mature systems abroad:

- Oracle OPERA Cloud PMS
- Mews PMS
- Cloudbeds PMS / Channel Manager / Revenue Intelligence
- Odoo ERP
- SAP S/4HANA Cloud ERP
- NetSuite Hospitality ERP

The goal is not to copy those systems. The goal is to identify the gaps that prevent this HMS from feeling like a serious modern ERP, then define the roadmap that can make it stronger than a normal hotel system.

## Scan Method

This audit was done at module, page, controller, service, entity, migration, and workflow level. It reviewed the staff ERP route tree, shared shell/navigation, major frontend pages, backend controllers/services/entities, and database migrations.

It was not a literal line-by-line review of every function implementation in the repository. The function-level comparison needed for a final engineering sign-off should be done in a second pass, module by module, with runnable workflows and test cases. The best next step is to turn this document into a checklist where each module is verified by:

- UI page behavior
- API endpoint behavior
- database tables/migrations
- workflow edge cases
- permissions/RBAC
- audit/notification side effects
- reporting/accounting side effects
- comparison against benchmark products

## High-Level Verdict

The project already has a surprisingly wide module surface: reservations, rooms, housekeeping, guests, folio, invoices, accounting, inventory, F&B, POS, self orders, facilities, channels, pricing, reports, IoT, audit logs, settings, and platform/tenant backend pieces.

The biggest gap is not "missing pages." The biggest gap is that many pages behave like isolated tools instead of one connected ERP brain.

Current maturity estimate:


| Area                  | Current State                 | Mature ERP/PMS Expectation                                           | Gap Severity |
| --------------------- | ----------------------------- | -------------------------------------------------------------------- | ------------ |
| PMS operations        | Broadly implemented           | Real-time command center with guided workflows                       | Medium       |
| UI/UX consistency     | Mixed quality                 | Consistent design system and responsive patterns                     | High         |
| Automation            | Some schedulers/jobs          | Workflow engine, triggers, SLA escalation, AI suggestions            | High         |
| Notifications         | Frontend smart bell added     | Persistent, user-specific, actionable notification center            | High         |
| Finance/accounting    | Operational accounting exists | Full GL, bank reconciliation, period close, audit controls           | High         |
| Inventory/procurement | Strong for hotel scale        | Advanced warehouse, approval, reorder, valuation, landed cost        | Medium-High  |
| Channel/revenue       | Basic channel/pricing exists  | OTA-grade ARI sync, restrictions, RMS forecasting                    | High         |
| Guest CRM             | Good profile surface          | Segmentation, campaigns, lifecycle journeys, consent center          | Medium-High  |
| Reporting             | Many reports exist            | Drill-through BI, scheduled delivery, forecasting, custom dashboards | Medium-High  |
| Integrations          | Some specific integrations    | Open API, webhooks, marketplace, connector monitoring                | High         |


## What Mature ERP/PMS Systems Do Better

### Oracle OPERA Cloud

Relevant patterns:

- Centralized front desk, inventory, rate, guest profile, housekeeping, and reporting.
- Rich guest profile with preferences, stay history, communications, membership, spend, and marketing data.
- Property-level and groupwide dashboards.
- Report scheduler for email/print/export.
- Housekeeping schedules tied to reservations and stay extensions.
- Rate management with rate plans, daily schedules, best available rates, restrictions, and distribution.
- OPERA Cloud Distribution publishes availability/rates/inventory to OTA and channel systems.

Gap for HMS:

HMS has many operational pieces, but needs stronger reservation-linked housekeeping schedules, proper rate plan/restriction depth, and distribution-grade channel publishing.

### Mews PMS

Relevant patterns:

- Visual reservation calendar/timeline.
- Drag-and-drop reservation operations.
- Automated guest communication flows.
- Embedded payments and tokenized payment workflows.
- Self-service check-in/check-out.
- Marketplace/API-first integration model.
- Housekeeping task app and real-time operational updates.

Gap for HMS:

HMS needs a visual reservation/tape chart, better payment automation, guest journey automation, and an API/webhook marketplace mindset.

### Cloudbeds

Relevant patterns:

- Unified command center with smart filters, instant search, predictive actions, and real-time work.
- Integrated PMS, booking engine, channel manager, payments, housekeeping, groups, and reporting.
- Channel manager with 300+ OTA connections.
- Revenue Intelligence with demand forecasting and dynamic price recommendations.
- Strong mobile/responsive experience.

Gap for HMS:

HMS needs a real command center, OTA-grade ARI sync, mobile-first layouts, and pricing recommendations beyond manual rules.

### Odoo ERP

Relevant patterns:

- Accounting creates journal entries automatically from invoices, POS, inventory, vendor bills, and expenses.
- Bank synchronization and reconciliation models.
- Inventory routes, replenishment rules, serial/lot tracking, valuation, landed cost, scrap, warehouse operations.
- Approvals, access rights, audit trails, and modular app ecosystem.

Gap for HMS:

HMS needs a real accounting backbone: GL, journal entries, bank reconciliation, fiscal periods, vendor bills, approvals, and inventory valuation tied to accounting.

### SAP S/4HANA

Relevant patterns:

- Deep finance, procurement, inventory accounting, operational procurement, approvals, compliance logs, analytics.
- Material ledger with multi-currency valuation.
- Procure-to-pay workflows with requisitions, purchase orders, invoice management, supplier management, and analytics.
- Embedded AI and role-based process automation.

Gap for HMS:

HMS needs enterprise-grade controls: approval workflows, procurement lifecycle, audit evidence, multi-currency valuation, and role-based exception handling.

### NetSuite Hospitality ERP

Relevant patterns:

- Unified PMS/POS/back-office finance database.
- Night audit and POS revenue automatically post to GL.
- Multi-property P&L, RevPAR, GOPPAR, departmental margin, rolling cashflow.
- Par-level inventory and purchasing triggers across properties/outlets.
- Automated bank feeds, reconciliation, consolidations, and audit trails.

Gap for HMS:

HMS has operational modules but needs the back-office finance engine that connects every room charge, POS sale, inventory movement, vendor purchase, and payment to one auditable ledger.

## Current Project Surface

### Frontend Shell

Main shell: `frontend/src/components/HotelStaffShell.tsx`

Navigation covers:

- Overview: Dashboard, Reports, Accounting, Guest analytics
- Rooms: Room Types, Rooms, Room Blocks
- Guests & Bookings: Reservations, Groups & Events, Invoices, Guests, Staff, Housekeeping, My HK tasks, Service Requests
- Services: Facilities, Menu, POS, Self orders, Inventory, F&B, Pricing, Channels
- Administration: Staff, IoT & Smart Room, Audit Logs, Settings

New global notification bell:

- `frontend/src/components/GlobalNotificationBell.tsx`
- It currently calculates smart alerts client-side from multiple APIs.
- It supports read state in localStorage.
- It is not yet a server-backed notification inbox.

### Backend Surface

Important controller/service areas scanned:

- `ReservationController`, `ReservationService`
- `RoomController`, `RoomService`, `RoomManagementService`
- `FolioController`, `FolioLedgerService`
- `InvoiceController`, `InvoiceService`, `InvoicePdfService`
- `ReportController`, `ReportService`
- `AccountingController`, `AccountingService`
- `GuestController`, `GuestService`, `GuestComplaintController`
- `HousekeepingController`, `HousekeepingTaskService`
- `FacilityController`, `FacilityService`
- `InventoryController`, `InventoryService`, `InvExtService`
- `FbController`, `FbService`
- `PublicSelfOrderController`, `SelfOrderService`
- `PricingController`, `DynamicPricingService`
- `ChannelManagerController`
- `IoTController`
- `AuditLogController`
- `HotelSettingsController`

Important migrations found:

- Notifications table: `V5__notifications_table.sql`
- Housekeeping tasks: `V3__housekeeping_tasks.sql`
- Guest profile expansion: `V6__guest_full_profile.sql`
- Dynamic pricing/promotions: `V26__dynamic_pricing_and_promotions.sql`
- Service requests: `V27__service_requests.sql`, `V37__service_request_routing.sql`
- Channel manager: `V28__channel_manager.sql`
- IoT devices: `V29__iot_devices.sql`
- Report schedules: `V30__report_schedules.sql`
- Inventory extensions: `V33__inventory_extensions.sql`, `V40__ensure_inventory_extensions.sql`
- Guest folio ledger: `V42__guest_folio_ledger.sql`
- Guest complaints: `V44__guest_complaints.sql`
- Group booking planning: `V41__group_booking_planning.sql`, `V47__group_preferred_room_type.sql`
- Overstay policy: `V52__hotel_overstay_policy.sql`
- Company profile: `V53__hotel_company_profile.sql`

## Page-by-Page ERP Gap Scan

### Overview / Dashboard

Current:

- Executive dashboard exists.
- Pulls executive dashboard, room dashboard, occupancy grid, real-time dashboard, sales analytics.
- Has KPI cards, charts, arrivals, departures, operations alerts.

Gaps:

- Dashboard does not yet feel like a single operational cockpit.
- No customizable widgets by role.
- No drag/drop tile layout.
- No saved dashboard views.
- No cross-module drill-through consistency.
- Alert cards are not backed by a persistent notification/event engine.
- No AI summary such as "today's operational risk."

1000% upgrades:

- Role-based cockpit: GM, front desk, finance, housekeeping, F&B, owner.
- Daily command summary: arrivals, departures, dirty rooms, overdues, unpaid folios, pending requests, low stock, channel sync failures.
- AI action queue: "Do these 7 things before 12:00."
- Drill-through every KPI into filtered data.
- Live websocket refresh for operational counters.

### Reports

Current:

- Executive, occupancy, guests, complaints, audit/night-audit history surfaces exist.
- Some export/report schedule backend exists.

Gaps:

- Reporting is still page-specific, not a BI layer.
- No custom report builder.
- No saved filters.
- No scheduled delivery UI for report schedules.
- No PDF/CSV/XLSX consistency across all reports.
- No drill-down from summary to transactions.
- No owner/department P&L packs.

1000% upgrades:

- Report builder with dimensions: stay date, booking date, source, rate code, room type, outlet, staff, channel.
- Scheduled reports with recipient lists.
- Finance pack: P&L, cashflow, AR aging, revenue breakdown, tax report.
- Hospitality KPIs: ADR, RevPAR, TRevPAR, GOPPAR, occupancy, cancellation, no-show, pickup, LOS.
- AI report commentary: "Why revenue moved this week."

### Accounting

Current:

- Accounting dashboard, sales analytics, expenses, petty cash workflows.
- Some approval/disbursement endpoints.

Gaps:

- No full chart of accounts.
- No automatic journal entries for every operational event.
- No accounts receivable/payable aging.
- No vendor bills.
- No bank feeds or reconciliation.
- No period close, locks, or adjustment entries.
- No multi-currency realized/unrealized gain/loss.
- No tax filing pack.

1000% upgrades:

- Build a real GL: accounts, journals, journal entries, fiscal periods.
- Auto-post room revenue, F&B, POS, inventory COGS, tax, payments, refunds, discounts.
- Bank reconciliation model like Odoo.
- Night audit close posting to GL.
- AR aging by guest/company/group.
- Vendor bills and AP workflow.
- Period locks and audit trail.

### Guest Analytics

Current:

- Guest analytics page exists with date range, guest dashboard, nationality distribution, repeat booking trend.

Gaps:

- No segmentation workbench.
- No guest lifetime value detail drill.
- No campaign performance.
- No consent/privacy dashboard.
- No churn/return likelihood scoring.
- No preference clustering or upsell recommendations.

1000% upgrades:

- Segments: VIP, corporate, OTA, direct, repeat, local, high spend, complaint risk.
- Guest journey funnel: search -> booking -> check-in -> spend -> review -> return.
- AI preference summary and next-best-offer.
- Consent-aware email/SMS campaigns.

### Room Types

Current:

- Room type list/detail/create pages.
- Nightly rates page exists.

Gaps:

- Room type setup still looks operational, not revenue-grade.
- No occupancy-based rate plan matrix.
- No restrictions by room type: min stay, closed to arrival, closed to departure.
- No packaged products/add-ons by room type.
- No photo/amenity quality scoring.

1000% upgrades:

- Room type scorecard: rate, occupancy, revenue, conversion, channel mapping health.
- Rate calendar embedded in room type.
- Amenity/photo completeness checker.
- Restrictions matrix per room type.

### Rooms

Current:

- Rooms list/detail/new pages.
- Dashboard, room availability, room blocks, DND, status history exist on backend.
- Room detail drawer/component exists.

Gaps:

- No visual floor plan / housekeeping map.
- No drag-and-drop room assignment.
- Room status UI consistency needs polish.
- Maintenance and DND need stronger SLA/alert treatment.
- No mobile-first room attendant experience except HK tasks.

1000% upgrades:

- Interactive room rack/floor plan.
- Live room status board with filters and bulk actions.
- Maintenance SLA and cost log per room.
- Room profitability: revenue, maintenance cost, complaints, downtime.

### Room Blocks

Current:

- Room blocks page exists.
- Backend has room block APIs and auto-release fields.

Gaps:

- No calendar visualization of block windows.
- No conflict explanation/resolution assistant.
- No approval for long blocks.
- No cost-of-out-of-order calculation.

1000% upgrades:

- Block calendar and impact forecast.
- "This block will remove X sellable nights and estimated revenue."
- Auto-escalate blocks older than threshold.

### Reservations

Current:

- Reservation list, new reservation wizard, detail workspace.
- Check-in/out, folio, overstay, extend stay, guest preferences.
- Notification link now opens overdue view and card filters exist.
- Backend supports availability, public/staff booking, assignment suggestions, staff detail, no-show, cancellation, check-in, checkout, overstay status, extend stay, reassign room, folio, room charges, payments, invoice printing, and guest preference application.
- Frontend supports reservation board filters, availability preview, new reservation wizard with guest search/create, group link, deposit/payment fields, confirmation printing, and a detailed command-center style reservation page.

How strong systems handle reservations:

- OPERA Cloud uses "Look To Book" to search availability by date, room type, room features, property, rate, and policy. It supports room assignment, waitlist, multi-room, linked reservations, shared reservations, split reservations, mass cancellation, quick checkout, scheduled checkout, table/list/card/console views, deposit/cancellation schedules, credit-rating-based policies, auto room assignment, and AI/enhanced room assignment.
- Mews focuses on a live reservation timeline. Staff can see gaps and overbookings, manage room allocations, move reservations, manage pricing, release unused group inventory, and connect payments/reservations in one flow.
- Cloudbeds emphasizes one reservation command center with real-time availability, smart filters, booking engine, channel sync, group allotment blocks, reservation pickup/status, and connected payments/reporting.
- Modern PMS products treat reservations as the center of the hotel. A reservation is not just a row in a table. It is a timeline, contract, payment plan, room assignment plan, guest journey, housekeeping schedule, revenue object, channel object, and audit object.

Gaps:

- No visual tape chart / booking calendar.
- No drag-and-drop date/room changes.
- List/card UI still needs consistency.
- Reservation notifications are calculated client-side, not persisted.
- No duplicate guest/reservation risk flags.
- No automatic communication timeline.
- No cancellation/refund policy engine depth.
- No waitlist workflow when availability is unavailable.
- No share-with / companion guest model for multiple occupants.
- No first-class split reservation for room moves across stay dates.
- No linked/back-to-back reservation model.
- No room move workflow with audit, housekeeping, folio, and key impact.
- No reservation queue: arrivals waiting, rooms not ready, pre-arrival incomplete, deposit missing, ID missing, payment failed.
- No tape chart showing gaps, overbookings, room blocks, room moves, dirty/clean status, and group allocations.
- No strong deposit schedule engine: due dates, auto payment, reminders, failed deposit alerts.
- No cancellation policy engine with rule previews, penalties, refund handling, and approval.
- No editable history window / period lock control for past reservations.
- No channel reservation reconciliation: imported OTA modifications, cancellations, duplicate booking detection.
- No message center tied to reservation: confirmation, pre-arrival, payment request, room ready, checkout reminder, post-stay.
- No document/signature flow: registration card, ID scan/OCR, terms, invoice acknowledgment.
- No reservation risk score: unpaid balance, blacklisted guest, duplicate profile, overbooking risk, dirty room, policy conflict.
- No "I Want To..." action menu that exposes the exact next actions by reservation status.
- No booking source profitability view on each reservation.
- No audit timeline that shows who changed dates, rates, room, status, charges, payments, and policies.
- No bulk operations for arrivals, departures, mass cancellation, auto assignment, print registration cards, or send reminders.

1000% upgrades:

- Reservation tape chart with drag/drop.
- Smart booking assistant: best room, upsell, risk, payment due.
- Reservation timeline: created, modified, emails, payments, room changes, notes.
- Policy engine: cancellation, no-show, deposit, refund, overstay, early check-in.
- Look-to-book search like OPERA: dates, room type, room features, rate plan, package, source, company, group, guest preferences, and multi-property later.
- Waitlist: create waitlist reservation, auto-alert when inventory opens, convert waitlist to confirmed.
- Reservation queue board: arrivals today, departures today, overdue checkout, room not ready, deposit missing, payment due, ID missing, guest preferences pending.
- Tape chart / room rack:
  - rows = rooms grouped by type/floor/status
  - columns = dates/hours
  - blocks = reservations, maintenance blocks, group allotments, DND, out-of-order
  - drag to change room or dates with server-side validation
  - visual conflict/overbooking line
  - color only by status, not decoration
- Auto room assignment:
  - match guest preferences, accessibility, VIP, smoking/non-smoking, bed type, floor, room readiness
  - minimize one-night gaps
  - avoid high-maintenance rooms
  - respect group adjacency
  - show explanation: "assigned room 5220 because clean, same room type, preferred high floor, no back-to-back conflict."
- Room move workflow:
  - scheduled move date/time
  - old room release task
  - new room inspection task
  - digital key update
  - folio continuity
  - audit event
- Multi-guest / companion registration:
  - primary guest plus companions
  - ID/document per adult
  - registration cards
  - guest-specific preferences
- Split/share reservation support:
  - split by date, split by room, split by guest
  - shared room reservations with separate folios
  - linked reservations for back-to-back stays
- Deposit/payment plan:
  - deposit rules by rate plan/source/company/credit rating
  - scheduled due dates
  - auto payment request links
  - reminders and failed payment notifications
  - manager override with reason
- Cancellation/no-show/refund engine:
  - rule preview before cancellation
  - automatic penalty calculation
  - refund/credit note routing
  - approval required for waivers
  - no-show automation based on arrival date and guarantee type
- Guest communication timeline:
  - confirmation sent
  - deposit request sent/paid
  - pre-arrival reminder
  - room ready message
  - checkout reminder
  - post-stay feedback
  - manual notes/messages
- Reservation audit and timeline:
  - created, changed, room moved, rate changed, payment posted, charge added, guest changed, policy overridden
  - before/after diff
  - staff name, timestamp, reason
- Smart reservation assistant:
  - "Collect deposit before check-in"
  - "Room is dirty; assign another clean room"
  - "Guest has VIP preference: high floor"
  - "Reservation is past checkout; choose Extend stay or Check out"
  - "OTA booking modified dates; confirm rate difference"

Reservation page target design:

- Top: guest/stay summary, balance, status, risk badges.
- Left: timeline of events and communications.
- Center: operational command area with status-specific actions.
- Right: smart assistant panel with warnings and next best action.
- Tabs: Folio, Guest, Room Assignment, Communications, Documents, Audit, Policies.
- Every card/action must drill to exact records, not generic lists.

Reservation data model target:

- `reservation_guests` for companions/share-with.
- `reservation_segments` for split stays, room moves, multi-rate nights.
- `reservation_links` for linked/back-to-back/share/group relationships.
- `reservation_policy_snapshot` for deposit/cancel/no-show rules at booking time.
- `reservation_events` append-only timeline.
- `reservation_messages` for communications.
- `reservation_documents` for registration card/ID/signature.
- `waitlist_entries`.
- `reservation_assignment_score` or assignment explanation snapshot.

Reservation API target:

- `GET /reservations/tape-chart?from=&to=&roomType=`
- `POST /reservations/{id}/move-room`
- `POST /reservations/{id}/split`
- `POST /reservations/{id}/share`
- `POST /reservations/{id}/link`
- `POST /reservations/{id}/deposit-request`
- `GET /reservations/{id}/timeline`
- `GET /reservations/{id}/policy-preview?action=cancel`
- `POST /reservations/waitlist`
- `POST /reservations/waitlist/{id}/convert`
- `POST /reservations/bulk/auto-assign`
- `POST /reservations/bulk/send-reminders`
- `POST /reservations/{id}/documents`

Reservation form questions and inputs:

Current HMS new reservation form collects a useful core set:

- Existing guest search.
- Full name.
- National ID.
- Date of birth.
- Email.
- Phone and country code.
- Country / province / district / sector / cell / village / street / address notes.
- Nationality.
- Gender.
- ID type.
- ID document number.
- ID expiry.
- VIP level.
- Marketing consent.
- Guest notes.
- Check-in date.
- Check-out date.
- Adults.
- Room availability lookup.
- Room type.
- Preferred room.
- Special requests.
- Early check-in request.
- Deposit amount.
- Payment method.
- Group link through query parameter.
- Booking source derived as `WALK_IN` or `FRONT_DESK`.

This is enough for a basic front-desk reservation, but it is not yet enough for a proud, mature PMS reservation. Mature systems ask more because reservation data feeds revenue reporting, guest experience, channel analytics, policy automation, housekeeping, billing, and compliance.

Questions mature systems ask or infer:

#### 1. Stay Search / Availability Questions

- What are the arrival and departure dates?
- What is the estimated arrival time?
- What is the estimated departure time?
- How many rooms are needed?
- How many adults?
- How many children?
- What are the children ages?  
Reason: pricing, occupancy rules, breakfast, extra bed, tax exemptions.
- Is this a day-use, overnight, extended stay, or walk-in reservation?
- Is this booking linked to a group, company, travel agent, event, or block code?
- Should unavailable inventory create a waitlist record?
- Is the guest flexible with dates or room type?

Recommended HMS additions:

- `arrivalTime`
- `departureTime`
- `roomsRequested`
- `children`
- `childAges`
- `stayPurpose`
- `bookingIntent`: `NORMAL`, `WALK_IN`, `DAY_USE`, `EXTENDED_STAY`, `WAITLIST`
- `waitlistAllowed`
- `flexibleDates`

#### 2. Guest / Profile Questions

- Is this an existing guest, company guest, agency guest, or new profile?
- Who is the primary guest?
- Are there additional adult guests / companions?
- Do all adult guests have IDs?
- What is the guest preferred name?
- What is the communication language?
- What is the preferred communication channel: SMS, WhatsApp, email, phone?
- Does the guest consent to marketing messages?
- Does the guest consent to operational SMS/WhatsApp/email?
- Is the guest VIP, blacklisted, corporate, loyalty member, or repeat guest?
- Does the guest have accessibility needs?
- Does the guest have dietary restrictions or allergies?
- Does the guest have room preferences: high floor, quiet room, near elevator, view, bed type, accessible room, connecting room?

Recommended HMS additions:

- `preferredName`
- `preferredLanguage`
- `communicationPreference`
- `operationalMessageConsent`
- `companions[]`
- `accessibilityNeeds`
- `dietaryRestrictions`
- `allergies`
- `roomFeaturePreferences[]`
- `bedPreference`
- `floorPreference`
- `quietRoomPreference`
- `connectingRoomRequired`

#### 3. Room / Rate Questions

- Which rate code / rate plan is selected?
- Which package is selected?
- Which room type is booked?
- Which room type should be charged?
- Is the assigned room an upgrade?
- Is the rate overridden?
- If rate is overridden, what is the reason and approver?
- Is the room number assigned now or later?
- Are there room features requested?
- Are there add-ons: breakfast, airport pickup, extra bed, parking, spa, late checkout, early check-in?
- Are there restrictions: minimum stay, closed-to-arrival, closed-to-departure?

Recommended HMS additions:

- `ratePlanId`
- `rateCode`
- `roomTypeToChargeId`
- `manualRateOverride`
- `rateOverrideReason`
- `rateOverrideApprovedBy`
- `packages[]`
- `addOns[]`
- `roomFeatures[]`
- `upgradeReason`

#### 4. Source / Market / Sales Questions

Mature systems make these fields important because owners ask where revenue came from.

- What is the booking source?
- What is the market segment?
- What is the origin code?
- What is the channel?
- Is there a travel agent?
- Is there a company/corporate account?
- Is there a commissionable party?
- Is there a promo code, coupon, or negotiated rate?
- Is there a campaign code?
- Who created the booking?

OPERA-style fields to add:

- `reservationType`
- `marketCode`
- `sourceCode`
- `originCode`
- `channelCode`
- `companyId`
- `travelAgentId`
- `commissionable`
- `commissionPercent`
- `promoCode`
- `campaignCode`
- `bookedByUserId`

Why this matters:

Without market/source/origin/rate codes, reports cannot properly answer:

- Which channel brings profitable guests?
- Which segment cancels most?
- Which source has high no-show?
- Which company produces room nights?
- Which promotion produces revenue?

#### 5. Guarantee / Deposit / Payment Questions

Mature PMS products usually ask "Guaranteed by?" not just "payment method."

- Is the reservation guaranteed?
- Guaranteed by credit card, company, cash, deposit, voucher, OTA, direct bill, or no guarantee?
- Does the reservation deduct inventory?
- Is a deposit required?
- How much is due now?
- When is the deposit due?
- Is payment authorized, captured, or only recorded?
- Is card token stored?
- Is direct bill allowed for this company?
- Is the guest tax exempt?
- Is there a credit limit?
- Who approved guarantee override?

Recommended HMS additions:

- `guaranteeType`: `CREDIT_CARD`, `CASH`, `COMPANY`, `DIRECT_BILL`, `OTA`, `VOUCHER`, `NONE`
- `deductInventory`
- `depositRequired`
- `depositAmount`
- `depositDueDate`
- `paymentStatus`
- `paymentTokenId`
- `authorizationCode`
- `directBillCompanyId`
- `taxExempt`
- `taxExemptReason`
- `guaranteeOverrideReason`
- `guaranteeOverrideApprovedBy`

#### 6. Policies / Legal Questions

- Which cancellation policy applies?
- Which no-show policy applies?
- Which deposit policy applies?
- Which check-in/check-out policy applies?
- Has the guest accepted terms?
- Has the guest signed registration?
- Is the guest eligible for tax exemption?
- Are there age restrictions?

Recommended HMS additions:

- `cancellationPolicyId`
- `depositPolicyId`
- `noShowPolicyId`
- `termsAccepted`
- `termsAcceptedAt`
- `registrationCardSigned`
- `policySnapshot`

Important:

The reservation should store a snapshot of the policies at the time of booking. If hotel settings change later, old reservations should still follow the policy they were booked under unless staff explicitly updates them.

#### 7. Operational Questions

- Is pickup/transport needed?
- Flight number or arrival transport details?
- Is early check-in requested?
- Is late checkout requested?
- Is luggage storage needed?
- Is room cleaning preference known?
- Should housekeeping prepare amenities?
- Should F&B prepare welcome item?
- Any internal note not visible to guest?
- Any guest-facing note?

Recommended HMS additions:

- `arrivalTransportType`
- `flightNumber`
- `pickupRequired`
- `pickupTime`
- `lateCheckoutRequested`
- `housekeepingInstructions`
- `amenityInstructions`
- `internalNotes`
- `guestFacingNotes`

#### 8. Group Reservation Form Questions

For group reservations, mature systems ask different questions before creating individual reservations.

- Who is the group account/profile?
- What is the event name?
- What is the event type: wedding, conference, tour, team, corporate, delegation?
- What is the group status: Lead, Tentative, Definite?
- What is the arrival/departure window?
- How many rooms by room type and date?
- What is the negotiated group rate?
- What is the release/cutoff date?
- What is the deposit schedule?
- Who pays: master, guest, company, split?
- Which charges route to master: room, tax, F&B, facilities, incidentals?
- Is there a rooming list?
- Should attendees book themselves through a link?
- What is the attrition rule?
- What is the cancellation rule?
- Who is the organizer/contact person?
- Are event spaces, menus, equipment, or staff needed?

Recommended HMS group form additions:

- `groupStatus`: `LEAD`, `TENTATIVE`, `DEFINITE`
- `eventName`
- `eventType`
- `organizerName`
- `organizerPhone`
- `organizerEmail`
- `releaseDate`
- `cutoffDate`
- `attritionPercent`
- `depositSchedule[]`
- `allotmentBlocks[]`
- `billingRoutingRules`
- `attendeeBookingLinkEnabled`
- `roomingListImport`
- `beoRequired`

#### 9. What Should Be Required vs Optional

Do not make every field required. Mature systems keep forms fast but structured.

Minimum required for a normal front-desk booking:

- Guest profile or guest full name.
- Phone or email.
- Arrival date.
- Departure date.
- Adults.
- Room type.
- Rate plan / rate code.
- Reservation type / guarantee type.
- Source code.
- Market code.
- Payment method or guarantee.

Required when applicable:

- Company if guarantee/direct bill is company.
- Deposit amount and due date if policy requires deposit.
- Reason if rate is manually overridden.
- Approval if discount/waiver exceeds staff permission.
- ID details for check-in or local compliance.
- Rooming list fields for group pickup.

Optional but valuable:

- Arrival time.
- Departure time.
- Children ages.
- Flight/pickup details.
- Room feature preferences.
- Dietary/allergy/accessibility notes.
- Guest-facing notes.
- Internal notes.
- Promo/campaign code.
- Communication preference.

#### 10. Reservation Form UX Recommendation

HMS should not show one huge form. It should be progressive:

1. Search stay:
  - dates, nights, rooms, adults, children, group/block code.
2. Select product:
  - room type, rate plan, package, policies, available room count.
3. Guest:
  - search existing or create new guest, companion guests optional.
4. Preferences:
  - room features, arrival time, special requests, accessibility, notes.
5. Guarantee:
  - reservation type, source/market, deposit, payment, policy preview.
6. Review:
  - total price, taxes, deposit due, cancellation/no-show rules, room assignment, warning badges.

The review step should show warnings before saving:

- Guest is blacklisted.
- Guest profile duplicate likely.
- Deposit required but missing.
- Rate override needs approval.
- Room type has low availability.
- Selected room is dirty/out of order.
- Group block not definite.
- Check-in date is today: offer "check in now."
- Arrival is outside normal check-in time.

Best final target:

The reservation form should feel like a guided sales workflow, not data entry. Staff should always know why a field is requested and what risk exists before pressing Book.

### Groups & Events

Current:

- Groups list/detail/reserve pages.
- Group booking planning, preferred room type, billing dashboard, room block reserve flow.
- Backend includes group booking, room target planning, preferred room type, group reservation creation, group billing routing, master/member folio concepts, and corporate account linking.

How strong systems handle group reservations:

- OPERA treats a block reservation as a group of rooms held for an event, meeting, wedding, convention, company, travel agent, or tour series. It supports block inventory, room/rate allocations, policies, deposit/cancellation handling, rooming workflows, and multiple reservation views.
- Cloudbeds uses a hierarchy: Profile -> Event -> Allotment Block. Each event can hold multiple allotment blocks with room types, dates, rates, and billing routing. Block status matters: Lead/Tentative does not deduct inventory, Definite deducts inventory and accepts reservations. Unused rooms can be released. Pickup reporting shows how many rooms are booked from the block.
- Mews supports smarter group allocations, live availability, automatic release of unused rooms on a release date, and group reservation/payment handling through APIs.

The key mature-system idea:

A group reservation is not just multiple reservations. It is a sales contract plus inventory allocation plus pickup tracking plus rooming list plus billing instructions plus event/service tasks.

Gaps:

- No banquet/event operations layer.
- No BEO (banquet event order).
- No group pickup curve.
- No rooming list import/export.
- No attrition/cutoff/deposit schedule.
- No formal group lifecycle status: Lead, Tentative, Definite, Cancelled, Completed.
- No rule that only Definite blocks deduct inventory.
- No release/cutoff automation that returns unused rooms to public sale.
- No room block grid by date and room type.
- No pickup dashboard comparing contracted, picked up, remaining, released, washed, and actualized rooms.
- No attrition calculation: contracted vs actual pickup and penalty.
- No group rate plan/package per block.
- No group booking engine/link where attendees book themselves against a block code.
- No rooming list import from Excel/CSV with validation.
- No delegate/attendee profiles under the group.
- No master billing instructions by charge category: room, tax, F&B, facilities, incidentals.
- No deposit milestone schedule for group contract.
- No group contract/proposal document workflow.
- No task plan for sales, front desk, housekeeping, F&B, facilities, finance.
- No event agenda/BEO tied to facilities, menus, rooms, staffing, and equipment.
- No multi-property group support.
- No group forecast impact on availability and revenue.

1000% upgrades:

- Group contract, room block pickup, cutoff date, attrition rules.
- Rooming list upload.
- Master folio and split billing.
- Event agenda/BEO with F&B/facility/staff tasks.
- Group hierarchy:
  - Account/Profile: company, agency, wedding planner, tour operator
  - Event: conference, wedding, team stay, tour series
  - Allotment Blocks: dates, room types, counts, rates, release date, billing
  - Reservations: guests/delegates under each block
- Group lifecycle:
  - Lead: sales opportunity, no inventory deducted
  - Tentative: quoted/negotiating, optional soft hold
  - Definite: contract/deposit received, inventory deducted
  - In-house: active event/stay
  - Completed: final billing
  - Cancelled/Lost: release inventory and track reason
- Block inventory grid:
  - rows = room types
  - columns = dates
  - cells = contracted / picked up / remaining / released
  - visual warning when pickup exceeds allocation
- Release/cutoff automation:
  - release unused rooms X days before arrival
  - notify sales/manager before release
  - prevent release below picked-up rooms
  - record release event in audit
- Pickup reporting:
  - pickup by day, room type, source, attendee type
  - lead time and pace
  - forecast final pickup
  - rooms at risk of attrition
- Rooming list:
  - CSV/Excel import
  - validate guest names, dates, room type, sharing, payment responsibility
  - duplicate detection
  - bulk create/update reservations
  - export current rooming list
- Group billing:
  - master pays all
  - master pays room/tax only
  - guests pay incidentals
  - split by department
  - corporate credit limit
  - deposit milestones
  - final settlement statement
- Group booking link:
  - public/private link for attendees
  - block code
  - attendee books from allocated inventory
  - show group rate/packages
  - close link after cutoff
- Event/BEO:
  - agenda
  - meeting rooms/facilities
  - F&B menus
  - equipment
  - staff assignments
  - service times
  - billing instructions
  - printable BEO
- Smart group assistant:
  - "Pickup is below pace; contact organizer"
  - "Release date is tomorrow with 14 unused rooms"
  - "Deposit milestone overdue"
  - "Group exceeds corporate credit limit"
  - "Housekeeping needs 20 departures by 11:00"

Group reservation page target design:

- Header: account/event, status, dates, expected guests, rooms contracted, picked up, balance, credit risk.
- Tabs: Overview, Blocks, Rooming List, Reservations, Billing, Event/BEO, Tasks, Documents, Audit.
- Block grid as the main operational screen.
- Pickup chart and release warnings.
- Action bar: confirm block, collect deposit, import rooming list, release unused, create attendee link, print BEO, final bill.

Group data model target:

- `group_profiles` or reuse corporate account with richer organizer fields.
- `group_events`.
- `group_allotment_blocks`.
- `group_allotment_block_days`.
- `group_rooming_list_rows`.
- `group_deposit_schedule`.
- `group_contract_documents`.
- `group_event_orders` / BEO.
- `group_tasks`.
- `group_pickup_snapshots`.

Group API target:

- `POST /groups/{id}/events`
- `POST /groups/{id}/allotment-blocks`
- `PATCH /groups/{id}/status`
- `POST /groups/{id}/confirm`
- `POST /groups/{id}/release-unused`
- `GET /groups/{id}/pickup`
- `POST /groups/{id}/rooming-list/import`
- `GET /groups/{id}/rooming-list/export`
- `POST /groups/{id}/booking-link`
- `POST /groups/{id}/deposit-request`
- `GET /groups/{id}/billing-instructions`
- `PATCH /groups/{id}/billing-instructions`
- `POST /groups/{id}/beo`

What would make HMS reservations something to be proud of:

- A front desk user can open one reservation and know exactly what to do next.
- A reservations manager can see the whole hotel on a tape chart and solve conflicts visually.
- A group sales manager can manage a wedding/conference without spreadsheets.
- Finance can trust every reservation amount, deposit, charge, payment, refund, and invoice.
- Housekeeping automatically knows what rooms are arriving, staying, moving, or departing.
- Guests receive timely, branded messages and payment links.
- Every change is audited and explainable.
- The system does not only store reservations; it actively runs the reservation operation.

### Invoices

Current:

- Invoices/proformas pages and backend services.
- PDF/tax invoice logic exists.

Gaps:

- No full AR lifecycle.
- No credit notes, debit notes, void/adjustment workflow.
- No e-invoicing/tax authority integration.
- No recurring billing for corporate/group contracts.
- No payment reconciliation.

1000% upgrades:

- Invoice lifecycle: draft, approved, sent, paid, void, credited.
- AR aging and customer statements.
- E-invoice integration adapter.
- Payment links and auto-reminders.

### Guests

Current:

- Guest list, profile/detail pages, CRM lookup, new guest profile.
- Full guest profile backend includes documents, communications, incidents, loyalty, merge.

Gaps:

- Guest UI does not yet expose all CRM power clearly.
- No deduplication queue UI.
- No consent center.
- No household/company relationship map.
- No guest value/risk score.

1000% upgrades:

- Guest 360: stays, spend, complaints, preferences, communications, documents, consent, loyalty.
- Deduplication assistant.
- VIP/blacklist workflows.
- Guest timeline and AI summary.

### Staff

Current:

- Staff page and staff user APIs.
- Roles/RBAC exist.

Gaps:

- No shift scheduling.
- No attendance/timeclock.
- No task workload balancing.
- No payroll/export integration.
- Role matrix is not easy to audit from UI.

1000% upgrades:

- Staff roster, shifts, attendance.
- Department workload dashboard.
- Permission matrix editor.
- Staff performance KPIs.

### Housekeeping

Current:

- Housekeeping board, assignment, start, complete, inspect, skip DND.
- My HK tasks page.

Gaps:

- No mobile-first task companion.
- No task schedule generated from reservation/stay rules.
- No linen/minibar/restock route optimization.
- No photo proof or checklist templates.
- No SLA analytics per housekeeper.

1000% upgrades:

- Mobile HK app layout.
- Reservation-linked HK schedule like OPERA.
- Checklist templates by task type.
- AI room turn sequencing by arrivals/departures.
- Time-to-clean and inspection quality scores.

### My HK Tasks

Current:

- Individual assigned task list.

Gaps:

- Could be stronger for mobile.
- Needs offline-ish behavior for weak connectivity.
- Needs route/order guidance.

1000% upgrades:

- "Next best room" queue.
- One-thumb complete/skip/escalate UI.
- Photo upload and voice note.

### Service Requests

Current:

- Pending service requests page and status updates.
- Backend has service request routing fields.

Gaps:

- No SLA timers.
- No routing queue by department.
- No escalation rules.
- No guest-facing request status timeline.
- No websocket notification by department.

1000% upgrades:

- Department queues: HK, maintenance, F&B, front desk.
- SLA countdowns and escalation.
- Guest message updates.
- Request templates and root-cause analytics.

### Facilities

Current:

- Facilities, booking, check-in, charge-to-room, maintenance, water quality, lifeguard, incident, revenue.

Gaps:

- UI is powerful but dense.
- No calendar/resource scheduler view.
- No safety compliance dashboard.
- No facility package/upsell links to reservations.

1000% upgrades:

- Facility calendar.
- Compliance center: water logs, incidents, lifeguard coverage.
- Facility revenue optimization.
- Guest upsell integration.

### Menu

Current:

- Menu page exists and links into inventory/self-order concepts.

Gaps:

- Menu engineering analysis limited.
- No recipe/BOM costing.
- No modifier groups, combos, timed menus.
- No allergen/nutrition controls.

1000% upgrades:

- Recipe costing and margin by item.
- Modifier groups and menu schedules.
- Allergen, dietary, and stock-aware menu availability.

### POS

Current:

- POS page sells from inventory/depot products.
- Creates inventory sales.

Gaps:

- Not yet a mature restaurant POS.
- No table map, split bills, tips, shift close, cash drawer, offline mode.
- No kitchen printer/KDS workflow.
- No payment terminal integration.

1000% upgrades:

- Table service POS.
- Cashier shift open/close.
- Split payment and tips.
- Kitchen display/printer integration.
- Offline-first mode.

### Self Orders

Current:

- Strong guest kiosk/self-order module.
- Health, QR, kitchen board secret, pickup board privacy, SMS/push toggles.

Gaps:

- Needs tighter integration with POS/KDS.
- Needs stronger kitchen SLA and prep-time analytics.
- Needs item availability from real stock in real time.

1000% upgrades:

- Prep SLA board and queue prioritization.
- Kitchen station routing.
- AI demand forecast for popular items.
- Guest reorder and upsell.

### Inventory

Current:

- Products, categories, suppliers, warehouses, sales invoices, stock transfers, movements, purchase orders, low stock, stock types.

Gaps:

- No full procurement approval workflow.
- No receiving/putaway/picking flow comparable to Odoo.
- No landed costs.
- No cycle count/stocktake workflow.
- No barcode scanner workflow.
- No inventory valuation posted to accounting.

1000% upgrades:

- Requisition -> approval -> PO -> receiving -> invoice -> payment.
- Cycle counts and variance approvals.
- Barcode scanning.
- Par levels by department/warehouse.
- Perpetual inventory valuation tied to GL.

### F&B

Current:

- Outlets, menu, F&B orders, room-charge flow.

Gaps:

- No full restaurant operations suite.
- No recipe costing.
- No table/floor plan.
- No F&B performance by outlet/server/item/shift.

1000% upgrades:

- Outlet dashboards with item margins.
- Recipe/BOM integration with inventory.
- Kitchen routing and table management.

### Pricing

Current:

- Dynamic pricing rules, calendar, promotions.

Gaps:

- No true RMS.
- No competitor rate ingestion.
- No forecast/demand curve.
- No channel restrictions matrix.
- No rate plan package builder.

1000% upgrades:

- Revenue intelligence: forecast demand, recommend rates, detect compression dates.
- Rate plans, restrictions, BAR ladder, LOS rules.
- Channel-specific rate and availability publishing.

### Channels

Current:

- Channel connections, rate plans, sync trigger/log concept.

Gaps:

- Not OTA production-grade yet.
- No real provider adapters for Booking.com/Expedia/Airbnb.
- No ARI retry queue.
- No mapping diagnostics.
- No conflict/reconciliation dashboard.

1000% upgrades:

- ARI engine: availability, rates, inventory, restrictions.
- OTA reservation import webhooks.
- Sync logs, retries, dead-letter queue.
- Mapping health dashboard.

### IoT & Smart Room

Current:

- IoT devices, energy summary, device state logs.

Gaps:

- No real hardware adapter abstraction.
- No device health monitoring.
- No guest/staff control policies.
- No automation rules: AC off when vacant, DND sync, energy alerts.

1000% upgrades:

- Device gateway abstraction.
- Rules engine.
- Energy optimization dashboard.
- Smart room alerts tied to rooms/reservations.

### Audit Logs

Current:

- Audit log page/controller exists; platform audit also exists.

Gaps:

- Audit coverage likely uneven across modules.
- No immutable append-only guarantees.
- No before/after diff viewer everywhere.
- No export/legal hold.

1000% upgrades:

- Domain-event audit across every write.
- Before/after diffs.
- Compliance export.
- Tamper-evident hash chain for critical events.

### Settings

Current:

- Hotel settings, branding, company profile, fee/overstay policy.

Gaps:

- Settings are scattered by feature.
- No permission-controlled configuration center.
- No setup checklist.
- No backup/export/import configuration.
- No environment/integration health checks.

1000% upgrades:

- Setup wizard and readiness score.
- Integration center.
- Policy center: finance, reservations, rooms, housekeeping, notifications.
- Configuration audit history.

## Cross-Cutting Gaps That Make the ERP Feel Less Powerful

### 1. Missing Design System

Problem:

Pages use different card styles, button styles, spacing, tables, headings, modals, and responsiveness patterns.

Upgrade:

- Build `ERPPageHeader`, `ERPStatCard`, `ERPTable`, `ERPCommandBar`, `ERPFilterPanel`, `ERPDrawer`, `ERPModal`.
- Use one spacing scale and one neutral color language.
- Ban one-off gradients except for high-value hero widgets.

### 2. Client-Side Notifications Instead of Real Notification Engine

Problem:

The bell is useful, but it is derived client-side and read state is localStorage only.

Upgrade:

- Use `notifications` table as source of truth.
- Add per-user read/dismiss/snooze.
- Add notification rules: reservation overdue, service SLA breached, channel sync failed, payment failed, low stock, DND stale, audit anomaly.
- Add websocket push.

### 3. No Workflow/Approval Engine

Problem:

Approvals are coded per module.

Upgrade:

- Generic workflow engine: request, approval, rejection, escalation, comments.
- Use for purchase orders, petty cash, discounts, refunds, long room blocks, invoice voids, rate overrides.

### 4. No Unified Search

Problem:

Users must know which module to open.

Upgrade:

- Global search: guest, reservation, room, invoice, folio, group, order, product, staff, complaint.
- Recent items and command palette.

### 5. No Event Bus / Domain Events

Problem:

Many modules are connected directly.

Upgrade:

- Domain events: ReservationCheckedIn, FolioPaymentPosted, RoomStatusChanged, ServiceRequestCreated, StockBelowPar.
- Use events for audit, notifications, reports, webhooks, and AI summaries.

### 6. Finance Is Not Yet the ERP Spine

Problem:

Operations exist, but finance is not the single source of truth.

Upgrade:

- Every monetary event posts to ledger.
- Reconcile payments to bank.
- Lock periods.
- Department P&L.
- Multi-property consolidation.

### 7. No AI Layer Yet

Problem:

The system collects useful data but does not advise.

Upgrade:

- Daily manager summary.
- Anomaly detection: unusual discounts, rate drops, stock variance, repeated complaints.
- Reservation assistant: room assignment, upsell, risk, payment reminder.
- Revenue assistant: rate recommendations.
- Support assistant: explain guest/stay/folio history.

## "1000% Power" Roadmap

### Phase 1: Make It Feel Like a Serious Product (2-4 weeks)

1. Create a shared design system and refactor top pages to use it.
2. Make every stat card clickable with filtered views.
3. Add global command/search palette.
4. Replace client-only notification read state with backend read/dismiss.
5. Add drill-through links to all dashboard/report KPIs.
6. Add consistent empty/loading/error states.
7. Improve mobile responsiveness for reservations, rooms, housekeeping, POS, inventory.

### Phase 2: Make Operations Intelligent (1-2 months)

1. Reservation tape chart / room rack.
2. Real notification rules and websocket updates.
3. Service request SLA routing and escalation.
4. Housekeeping schedule engine from reservation rules.
5. Room readiness AI queue.
6. Guest 360 timeline.
7. System-wide audit event stream.

### Phase 3: Make It a Real ERP (2-4 months)

1. Chart of accounts and GL.
2. Auto journal entries from invoices, folios, POS, inventory, expenses, payments.
3. Bank reconciliation.
4. Procurement workflow.
5. Inventory valuation and cycle counts.
6. AR/AP aging.
7. Period close and audit locks.

### Phase 4: Beat Normal PMS Systems (4-8 months)

1. Channel ARI engine with OTA adapters.
2. Revenue intelligence: forecast, rate recommendations, restrictions.
3. Booking engine optimization and guest journey automation.
4. Multi-property dashboards and consolidated finance.
5. Integration marketplace with webhooks/API keys.
6. AI manager copilot.
7. Mobile PWA for staff and guests.

## Priority Backlog

### P0 - Immediate Product Quality

- Normalize cards/buttons/tables/modals across all pages.
- Create backend notification read/dismiss API.
- Add overdue/arrival/departure filtered views to Reservations and Checkout Desk.
- Add "open exact records" lists inside every notification.
- Add role-based dashboard defaults.

### P1 - Operational Power

- Reservation tape chart.
- Housekeeping schedule engine.
- Service request SLA.
- Guest 360.
- Better group/event rooming list workflow.
- Channel sync health dashboard.

### P2 - ERP Power

- General ledger.
- Bank reconciliation.
- Procurement approvals.
- Vendor bills.
- Inventory valuation.
- Period close.

### P3 - AI and Market Advantage

- AI daily operations brief.
- AI anomaly detector.
- AI room assignment and upsell.
- AI revenue rate recommendations.
- AI guest preference summarizer.

## Good-To-Have Features Borrowed From Mature Systems

These are not all P0 requirements. They are high-leverage ideas that would make HMS feel more advanced than a normal hotel app.

### From Oracle OPERA Cloud

- Configurable home tiles by role, property, and chain.
- Reservation-linked housekeeping schedule that updates when a stay is extended.
- Guest profile note types that flow into housekeeping, front desk, and service instructions.
- Property and groupwide reporting modes.
- Rate plan schedule editor with daily rates, restrictions, and distribution visibility.
- Channel distribution view directly from rate plan/room type configuration.
- Report scheduler with email, print, and export destinations.
- Enterprise profile: communication preferences, membership, marketing data, spend, preferences, and stay history.

### From Mews

- Visual reservation timeline/tape chart.
- Drag-and-drop room/date changes.
- Contactless check-in/check-out.
- Automated guest communication flows.
- Embedded payments with tokenized cards and payment automation.
- Marketplace/integration center with clear connection health.
- Guest journey automation: pre-arrival, arrival, in-stay, departure, post-stay.
- Mobile-first staff operations for housekeeping and front desk.

### From Cloudbeds

- Unified command center with predictive actions and smart filters.
- Instant global search across reservations, guests, rooms, invoices, groups, and orders.
- Built-in channel manager health with OTA sync status.
- Commission-free/direct booking performance dashboard.
- Revenue intelligence: demand forecast, rate recommendation, and market signals.
- Booking engine conversion analytics.
- Cross-filtered revenue reports by stay date, booking date, source, rate code, channel, and room type.
- Mobile app experience for staff and managers.

### From Odoo

- Complete accounting app with chart of accounts, journals, taxes, bank accounts, and reconciliation.
- Bank feed import and automatic reconciliation rules.
- Vendor bills and purchase-to-pay workflow.
- Inventory routes, replenishment rules, putaway, picking, and scrap.
- Lot/serial/batch tracking and expiry management.
- Landed cost calculation.
- Approval workflows for expenses, POs, discounts, refunds, and cash movements.
- App-style modular configuration where each department can enable only what it needs.

### From SAP S/4HANA

- Procure-to-pay chain: requisition, approval, purchase order, goods receipt, vendor invoice, payment.
- Material ledger / inventory valuation in multiple currencies.
- Real-time analytics by role.
- Formal compliance/audit process tracking.
- Segregation of duties and approval governance.
- Embedded AI assistant for exceptions, forecasting, and process recommendations.
- Enterprise integration layer for external systems.

### From NetSuite Hospitality ERP

- Unified PMS/POS/back-office financial database.
- Automatic daily revenue posting from PMS and POS into GL.
- Multi-property P&L and consolidated dashboards.
- Department-level profitability: rooms, F&B, facilities, spa, retail, events.
- Rolling cashflow forecast.
- Automated bank reconciliation for PMS/POS deposits.
- Par-level purchasing triggers across housekeeping, kitchen, bar, retail, and spa.
- USALI-style hospitality reporting support.

### Good-To-Have HMS-Specific Differentiators

- AI "morning manager brief": arrivals, departures, dirty rooms, overdues, unpaid folios, low stock, open complaints, channel sync issues.
- AI "next best action" per reservation: collect deposit, assign room, upsell, extend stay, check out, request ID, waive fee.
- One global command palette: search or execute actions from anywhere.
- Real-time operations wallboard for reception, housekeeping, kitchen, and manager office.
- Guest 360 timeline with stay, spend, documents, preferences, complaints, communications, loyalty, and risk flags.
- Smart room readiness score before assigning a room.
- Finance close assistant that lists missing payments, unposted charges, open folios, unreconciled deposits, and suspicious adjustments.
- Channel parity monitor that detects rate/inventory mismatches across OTA connections.
- Procurement assistant that creates reorder suggestions from par levels, occupancy forecast, and event/group demand.
- Staff productivity dashboard by department with fair workload distribution.
- Configuration readiness score for each hotel: missing tax setup, invoice prefix, payment methods, channels, room photos, policies, notification templates.
- "Why did this happen?" drill-down on every KPI and report number.

## Final Assessment

This project is not weak. It is wide and ambitious. The danger is that it becomes a collection of pages instead of one system.

To make it 1000% stronger than a normal HMS:

1. Make every module connected by events, notifications, audit, and finance.
2. Make every dashboard number clickable and explainable.
3. Make every operation lead to the exact records needing action.
4. Make the UI calm, consistent, responsive, and role-based.
5. Make finance and audit the trusted backbone.
6. Add AI only after the data and workflows are clean.

If those are done, this can move from "hotel management app" to a real hospitality ERP.