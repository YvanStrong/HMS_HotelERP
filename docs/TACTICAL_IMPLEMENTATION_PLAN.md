# HMS Tactical Implementation Plan — Road to 100%

> **Created:** 2026-05-08 | **Target:** Complete all spec'd features + close every gap

---

## Phase 1: Technical Debt & Hardening (Week 1)

### 1.1 Redis Rate Limiting
**Replace:** `LoginAttemptService` (in-memory) → Redis-backed
**Files:**
- Add `spring-boot-starter-data-redis` to `pom.xml`
- New: `RedisLoginAttemptService.java` using `StringRedisTemplate`
- Update `SecurityConfig.java` to wire new service
- Add `spring.data.redis.*` to `application.properties`

### 1.2 Database Audit Log
**New migration:** `V22__hotel_audit_logs.sql`
```sql
CREATE TABLE hotel_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels(id),
  actor_user_id UUID,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_hotel_created ON hotel_audit_logs(hotel_id, created_at DESC);
```
**Files:**
- New: `HotelAuditLog.java` entity
- New: `HotelAuditLogRepository.java`
- Update: `SecurityAuditService.java` → write to DB + SLF4J
- New endpoint: `GET /api/v1/hotels/{id}/audit-logs`

### 1.3 Currency NOT NULL Fix
**New migration:** `V23__hotel_currency_not_null.sql`
```sql
UPDATE hotels SET currency = 'USD' WHERE currency IS NULL;
ALTER TABLE hotels ALTER COLUMN currency SET NOT NULL;
ALTER TABLE hotels ALTER COLUMN currency SET DEFAULT 'USD';
```

### 1.4 Split ReservationService (90KB → 4 services)
- Extract `CheckInService.java` (~200 lines)
- Extract `CheckOutService.java` (~200 lines)
- Extract `FolioService.java` (~150 lines)
- Extract `AvailabilityService.java` (~150 lines)
- Keep `ReservationService.java` as orchestrator calling sub-services

### 1.5 MFA for Admin Accounts
**Dependency:** `com.warrenstrange:googleauth:1.5.0`
**Migration:** `V24__app_users_mfa.sql`
```sql
ALTER TABLE app_users ADD COLUMN mfa_secret VARCHAR(64);
ALTER TABLE app_users ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
```
**Files:**
- New: `MfaService.java` (TOTP generate/verify)
- Update: `AuthController.java` → add `/auth/mfa/setup` and `/auth/mfa/verify`
- Frontend: MFA setup page in settings, login flow 2nd step

### 1.6 API Key Authentication
**Migration:** `V25__api_keys.sql`
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  key_hash VARCHAR(128) NOT NULL,
  name VARCHAR(100),
  scopes TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
```
**Files:**
- New: `ApiKey.java` entity + repository
- New: `ApiKeyAuthenticationFilter.java`
- Endpoint: `POST /api/v1/hotels/{id}/settings/api-keys`

---

## Phase 2: Guest CRM Completion (Week 2)

### 2.1 Loyalty Tier Auto-Calculation
**New:** `LoyaltyTierJob.java` (`@Scheduled` nightly)
- Query all guests with point changes since last run
- Calculate tier: BRONZE (<1000), SILVER (<3000), GOLD (<5000), PLATINUM (5000+)
- Create tier-change event, trigger notification
- Update `Guest.loyaltyTier` field

### 2.2 Points Expiry Engine
**New:** `LoyaltyExpiryJob.java` (`@Scheduled` nightly)
- Scan `loyalty_transactions` where `expiry_date <= today` and `status = POSTED`
- Set status to `EXPIRED`, deduct from guest balance
- Create EXPIRED transaction record

### 2.3 Guest Merge/Dedup
**New endpoint:** `POST /api/v1/hotels/{id}/guests/{primaryId}/merge`
```json
{ "duplicateGuestId": "uuid-to-merge" }
```
- Merge reservations, charges, loyalty, feedback to primary
- Soft-delete duplicate guest record
- Audit log the merge action

### 2.4 VIP & Blacklist
**Migration:** `V26__guest_vip_blacklist.sql`
```sql
ALTER TABLE guests ADD COLUMN vip_level VARCHAR(20);
ALTER TABLE guests ADD COLUMN blacklist_reason TEXT;
ALTER TABLE guests ADD COLUMN blacklisted BOOLEAN DEFAULT false;
```
- Show VIP badge on guest list + check-in alert
- Block booking for blacklisted guests

### 2.5 Pre-Arrival & Post-Stay Emails
**New:** `GuestEngagementJob.java` (`@Scheduled` hourly)
- Pre-arrival (48h before check-in): preferences confirmation + upsell
- Post-stay (24h after check-out): thank-you + feedback survey link
**New:** `EmailTemplateService.java` — HTML templates with hotel branding
**Dependency:** `spring-boot-starter-mail`

### 2.6 GDPR Compliance
**New endpoints:**
- `GET /api/v1/hotels/{id}/guests/{guestId}/data-export` → JSON/ZIP of all PII
- `DELETE /api/v1/hotels/{id}/guests/{guestId}/gdpr-erasure` → anonymize PII, keep aggregated stats
- Add consent tracking columns to guests table

---

## Phase 3: Dynamic Pricing Engine (Week 3)

### 3.1 Pricing Rules
**Migration:** `V27__dynamic_pricing.sql`
```sql
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  name VARCHAR(100),
  rule_type VARCHAR(30), -- OCCUPANCY_BRACKET, DAY_OF_WEEK, SEASON, EVENT
  conditions JSONB,      -- {"min_occupancy": 80, "max_occupancy": 95}
  multiplier DECIMAL(5,3), -- 1.200 = 20% markup
  priority INT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  code VARCHAR(30) UNIQUE,
  name VARCHAR(100),
  discount_type VARCHAR(20), -- PERCENTAGE, FIXED_AMOUNT
  discount_value DECIMAL(10,2),
  valid_from DATE,
  valid_until DATE,
  usage_limit INT,
  usage_count INT DEFAULT 0,
  applicable_room_types UUID[],
  min_nights INT DEFAULT 1,
  active BOOLEAN DEFAULT true
);
```

### 3.2 Backend Services
**New:** `DynamicPricingService.java`
- `calculateRate(hotelId, roomTypeId, date)` → applies all active rules in priority order
- Called by `ReservationService` during availability check and booking
- Stacks multiplicatively: base_rate × occupancy_mult × day_mult × season_mult

**New:** `PromotionService.java`
- `validatePromoCode(hotelId, code, roomTypeId, dates)` → returns discount
- `applyPromotion(reservationId, promoCode)` → creates discount line on folio
- `incrementUsage(promoId)` → track redemptions

**New:** `RateRecommendationJob.java` (`@Scheduled` nightly)
- Analyze booking pace vs 30-day trailing average
- Compare occupancy forecast to prior periods
- Generate recommended rate adjustments
- Store in `rate_recommendations` table for dashboard display

### 3.3 Frontend
- New tab in Reports: "Revenue Management"
- Rate calendar showing base + dynamic rates per room type per day
- Promotion management CRUD in Hotel Settings
- Promo code field on public booking widget

### 3.4 API Endpoints
```
GET  /api/v1/hotels/{id}/pricing/rules
POST /api/v1/hotels/{id}/pricing/rules
GET  /api/v1/hotels/{id}/pricing/calendar?from=&to=&roomTypeId=
GET  /api/v1/hotels/{id}/promotions
POST /api/v1/hotels/{id}/promotions
POST /api/v1/hotels/{id}/promotions/{id}/validate
GET  /api/v1/hotels/{id}/pricing/recommendations
```

---

## Phase 4: Guest Mobile PWA (Week 4)

### 4.1 PWA Infrastructure
- Add `public/manifest.json` with HMS branding
- Add service worker for offline caching of static assets
- Add `<meta>` tags for iOS/Android home screen
- Scope: `/book/*` route group becomes the "app"

### 4.2 Mobile Check-In
**New endpoint:** `POST /api/v1/public/hotels/{id}/mobile-check-in`
```json
{
  "confirmationCode": "HMS-2026-7X9K2",
  "lastName": "Doe",
  "idPhotoBase64": "...",
  "acceptTerms": true
}
```
Response includes: room number, digital key QR, WiFi credentials, hotel info

**Frontend:** `/book/check-in/[code]/page.tsx` — 3-step flow:
1. Enter confirmation code + last name
2. Upload ID photo
3. Receive room assignment + digital key

### 4.3 Digital Room Key
- Generate HMAC-signed QR: `hotel_id|room_id|guest_id|expiry|signature`
- Staff scanning endpoint: `POST /api/v1/hotels/{id}/rooms/{roomId}/verify-key`
- Keys auto-expire at checkout time
- Frontend: full-screen QR display at `/book/me/key`

### 4.4 Service Requests
**Migration:** `V28__service_requests.sql`
```sql
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  reservation_id UUID REFERENCES reservations(id),
  guest_id UUID REFERENCES guests(id),
  room_id UUID REFERENCES rooms(id),
  request_type VARCHAR(30), -- EXTRA_TOWELS, ROOM_SERVICE, MAINTENANCE, WAKE_UP, OTHER
  description TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ASSIGNED, IN_PROGRESS, COMPLETED
  assigned_to UUID REFERENCES app_users(id),
  priority VARCHAR(10) DEFAULT 'NORMAL',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```
- Guest submits via `/book/me/requests`
- WebSocket notification to relevant department
- Staff manages in housekeeping/dashboard
- Guest sees real-time status updates

### 4.5 Guest Dashboard
**Page:** `/book/me/page.tsx`
- Active reservation summary (room, dates, folio balance)
- Digital key access button
- Service request list + new request form
- Loyalty points & tier
- Self-order history
- Check-out countdown

---

## Phase 5: Channel Manager (Weeks 5-6)

### 5.1 Core Sync Infrastructure
**Migration:** `V29__channel_manager.sql`
```sql
CREATE TABLE channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  channel_code VARCHAR(30), -- BOOKING_COM, EXPEDIA, AIRBNB, ICAL
  status VARCHAR(20) DEFAULT 'DISCONNECTED',
  credentials JSONB,        -- encrypted API keys per channel
  last_sync_at TIMESTAMPTZ,
  sync_errors INT DEFAULT 0,
  config JSONB               -- mapping: room_type_id → channel_room_id
);

CREATE TABLE channel_rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES channel_connections(id),
  room_type_id UUID REFERENCES room_types(id),
  channel_room_code VARCHAR(50),
  rate_markup_pct DECIMAL(5,2) DEFAULT 0,
  min_stay INT DEFAULT 1,
  restrictions JSONB
);

CREATE TABLE channel_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES channel_connections(id),
  direction VARCHAR(10), -- PUSH, PULL
  payload_type VARCHAR(30), -- AVAILABILITY, RATE, RESERVATION
  status VARCHAR(20),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Backend Services
**New:** `ChannelManagerService.java`
- `syncAvailability(hotelId)` → push inventory to all connected channels
- `syncRates(hotelId, roomTypeId)` → push rate changes
- `processInboundReservation(channel, payload)` → create reservation from OTA

**New:** `BookingComAdapter.java` / `ExpediaAdapter.java` / `ICalAdapter.java`
- Each implements `ChannelAdapter` interface
- Handles channel-specific XML/JSON formats
- Maps room types to channel product IDs

**New:** `ChannelSyncJob.java` (`@Scheduled` every 5 min)
- Pull new reservations from connected channels
- Push availability updates for any changes since last sync
- Log all sync activity for troubleshooting

### 5.3 Webhook Receivers
```
POST /api/v1/webhooks/ota/booking-com   → parse Booking.com reservation XML
POST /api/v1/webhooks/ota/expedia       → parse Expedia RAPID JSON
```
- Validate webhook signatures
- Create reservation with `source = channel_code`
- Auto-respond with confirmation

### 5.4 iCal Feed (Simple Integration)
```
GET /api/v1/public/hotels/{id}/ical/{roomTypeId}.ics
```
- Returns iCalendar format with blocked dates
- Works with Airbnb, VRBO, Google Calendar
- Auto-updates on reservation changes

### 5.5 Frontend
- New page: `/hotels/[hotelId]/settings/channels/page.tsx`
- Channel connection wizard (enter API credentials, map room types)
- Sync status dashboard with last sync time + error count
- Manual sync trigger button

### 5.6 API Endpoints
```
GET    /api/v1/hotels/{id}/channels
POST   /api/v1/hotels/{id}/channels                    -- connect new channel
PATCH  /api/v1/hotels/{id}/channels/{channelId}         -- update config
DELETE /api/v1/hotels/{id}/channels/{channelId}         -- disconnect
POST   /api/v1/hotels/{id}/channels/{channelId}/sync    -- force sync
GET    /api/v1/hotels/{id}/channels/{channelId}/logs    -- sync history
GET    /api/v1/hotels/{id}/channels/rate-plans
PUT    /api/v1/hotels/{id}/channels/rate-plans/{id}
```

---

## Phase 6: IoT & Smart Room (Weeks 7-8)

### 6.1 Device Registry
**Migration:** `V30__iot_devices.sql`
```sql
CREATE TABLE room_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  device_type VARCHAR(30),    -- THERMOSTAT, LOCK, LIGHT, CURTAIN, TV, MINIBAR_SENSOR
  device_name VARCHAR(100),
  protocol VARCHAR(20),       -- MQTT, REST, ZIGBEE, ZWAVE, MODBUS
  endpoint VARCHAR(255),      -- mqtt://broker/topic or https://device-ip/api
  auth_config JSONB,
  status VARCHAR(20) DEFAULT 'ONLINE',
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB
);

CREATE TABLE device_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES room_devices(id),
  state JSONB,               -- {"temperature": 22, "mode": "cool"}
  source VARCHAR(20),        -- GUEST, STAFF, AUTOMATION, SENSOR
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  room_id UUID REFERENCES rooms(id),
  reading_type VARCHAR(20),  -- ELECTRICITY, WATER, GAS
  value DECIMAL(12,3),
  unit VARCHAR(10),          -- kWh, liters, m3
  recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_energy_hotel_date ON energy_readings(hotel_id, recorded_at DESC);
```

### 6.2 Backend Services
**New:** `IoTDeviceService.java`
- `getDeviceState(deviceId)` → query device via protocol adapter
- `setDeviceState(deviceId, state)` → send command to device
- `registerDevice(hotelId, roomId, config)` → add device to registry

**New:** `IoTProtocolAdapter.java` (interface)
- `MqttAdapter.java` — for MQTT-based devices
- `RestApiAdapter.java` — for HTTP-based devices (Philips Hue, Nest, etc.)
- `MockAdapter.java` — for development/demo without hardware

**New:** `DeviceHealthMonitor.java` (`@Scheduled` every minute)
- Check heartbeat timestamps
- Mark devices OFFLINE if no heartbeat in 5 min
- Alert maintenance staff for critical devices (locks)

**New:** `EnergyDashboardService.java`
- Aggregate readings by room/floor/building
- Calculate cost estimates
- Compare occupancy vs energy consumption
- Sustainability scoring

### 6.3 Automation Rules
**New:** `RoomAutomationService.java`
- On check-in: set temperature to guest preference, turn on lights
- On check-out: reset thermostat to eco mode, turn off all
- On DND: dim hallway indicator light
- Guest away (no motion 30 min): reduce HVAC, turn off lights

### 6.4 Frontend
- New tab in Room Detail: "Smart Controls"
- Device list with current state + toggle controls
- Energy dashboard in Reports section
- IoT device management in Hotel Settings

### 6.5 API Endpoints
```
GET    /api/v1/hotels/{id}/iot/devices
POST   /api/v1/hotels/{id}/iot/devices
GET    /api/v1/hotels/{id}/rooms/{roomId}/devices
GET    /api/v1/hotels/{id}/rooms/{roomId}/devices/{deviceId}/state
POST   /api/v1/hotels/{id}/rooms/{roomId}/devices/{deviceId}/state
GET    /api/v1/hotels/{id}/iot/energy?from=&to=&groupBy=room|floor
GET    /api/v1/hotels/{id}/iot/energy/summary
```

---

## Phase 7: Reporting Completion & Accounting (Week 9)

### 7.1 Scheduled Report Delivery
**Migration:** `V31__report_schedules.sql`
```sql
CREATE TABLE report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  report_type VARCHAR(30),
  frequency VARCHAR(20),   -- DAILY, WEEKLY, MONTHLY
  recipients TEXT[],
  format VARCHAR(10) DEFAULT 'PDF',
  last_sent_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);
```
**New:** `ScheduledReportJob.java` — generates and emails reports on schedule

### 7.2 Additional Reports
- **F&B Revenue:** outlet-level breakdown, order type split, average ticket
- **Inventory Consumption:** top items, waste %, department breakdown
- **Housekeeping Performance:** turnaround time per housekeeper, quality scores
- **Forecast vs Budget:** add `budget_entries` table, variance calculations

### 7.3 Accounting Integration
**New:** `AccountingExportService.java`
- Journal entry export: map charges/payments to debit/credit
- `GET /api/v1/hotels/{id}/finance/journal-entries?from=&to=&format=csv`
- QuickBooks Online: OAuth2 flow + invoice/payment push
- Generic CSV with configurable column mapping

### 7.4 PCI-DSS Card Tokenization
- Integrate Stripe Elements on frontend (card never touches our server)
- Add `stripe_customer_id` to `guests` table
- Store only last4 + brand for display
- Use Stripe PaymentIntents for all transactions

---

## Phase 8: Automated Testing (Week 10)

### 8.1 Backend Tests (JUnit 5 + MockMvc)
**Priority test classes:**
```
test/java/com/hms/
├── api/
│   ├── AuthControllerTest.java          -- login, refresh, lockout
│   ├── RoomControllerTest.java          -- CRUD, status transitions
│   ├── ReservationControllerTest.java   -- book, check-in/out, folio
│   └── PlatformAdminControllerTest.java -- tenant isolation
├── service/
│   ├── RoomStatusTransitionsTest.java   -- state machine rules
│   ├── DynamicPricingServiceTest.java   -- rate calculations
│   ├── ChannelManagerServiceTest.java   -- sync logic
│   └── LoyaltyTierJobTest.java         -- tier calculation
└── security/
    ├── TenantIsolationTest.java         -- cross-hotel access blocked
    └── RbacTest.java                    -- role-based endpoint access
```

### 8.2 Frontend Tests (Jest + React Testing Library)
- Component tests for critical flows (booking wizard, check-in)
- API mock tests for error handling
- Accessibility tests for WCAG compliance

---

## Summary: Effort & Timeline

| Phase | Scope | Duration | Key Deliverables |
|-------|-------|----------|-----------------|
| **1** | Tech Debt & Hardening | 1 week | Redis rate limit, DB audit, MFA, API keys, service split |
| **2** | Guest CRM Completion | 1 week | Loyalty auto-tier, points expiry, merge, VIP, emails, GDPR |
| **3** | Dynamic Pricing | 1 week | Pricing rules, promotions, rate recommendations |
| **4** | Guest Mobile PWA | 1 week | PWA, mobile check-in, digital key, service requests |
| **5** | Channel Manager | 2 weeks | OTA sync, Booking.com/Expedia adapters, iCal, webhooks |
| **6** | IoT & Smart Room | 2 weeks | Device registry, protocol adapters, automation, energy |
| **7** | Reporting & Accounting | 1 week | Scheduled reports, F&B/inventory reports, QuickBooks |
| **8** | Automated Testing | 1 week | JUnit backend tests, frontend component tests |

**Total: ~10 weeks to 100% spec coverage**

---

## New Flyway Migrations Summary

| Version | Description |
|---------|-------------|
| V22 | `hotel_audit_logs` table |
| V23 | `hotels.currency` NOT NULL + default |
| V24 | `app_users` MFA columns |
| V25 | `api_keys` table |
| V26 | `guests` VIP/blacklist columns |
| V27 | `pricing_rules` + `promotions` tables |
| V28 | `service_requests` table |
| V29 | `channel_connections` + `channel_rate_plans` + `channel_sync_log` |
| V30 | `room_devices` + `device_state_log` + `energy_readings` |
| V31 | `report_schedules` table |

---

## New Dependencies (pom.xml)

```xml
<!-- Redis for rate limiting & caching -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<!-- MFA / TOTP -->
<dependency>
    <groupId>com.warrenstrange</groupId>
    <artifactId>googleauth</artifactId>
    <version>1.5.0</version>
</dependency>
<!-- Email -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
<!-- MQTT for IoT -->
<dependency>
    <groupId>org.springframework.integration</groupId>
    <artifactId>spring-integration-mqtt</artifactId>
</dependency>
<!-- iCal generation -->
<dependency>
    <groupId>org.mnode.ical4j</groupId>
    <artifactId>ical4j</artifactId>
    <version>4.0.0</version>
</dependency>
```

---

## Execution Order (Recommended)

```
Week 1:  Phase 1 (Tech Debt) ──── Foundation for everything else
Week 2:  Phase 2 (Guest CRM) ──── Quick wins, completes existing module  
Week 3:  Phase 3 (Pricing) ────── Revenue impact, competitive gap closer
Week 4:  Phase 4 (Mobile PWA) ─── Guest experience differentiator
Week 5-6: Phase 5 (Channels) ──── Distribution, biggest market gap
Week 7-8: Phase 6 (IoT) ───────── Premium feature, enterprise clients
Week 9:  Phase 7 (Reports) ────── Operational polish
Week 10: Phase 8 (Testing) ────── Production confidence
```

> After Phase 8, all 16 modules reach 100% and every gap in the competitive matrix is closed.
