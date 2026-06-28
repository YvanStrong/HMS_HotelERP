# HMS Waiter (mobile POS)

Expo React Native app for hotel restaurant/bar staff. Connects to the existing HMS Spring Boot API.

## Getting Started

```bash
npm install
npx expo start              # development with Expo Go
```

## Setup

```bash
cd mobile-pos
npm install
cp .env .env.local   # optional
```

Edit `.env`:

```
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8080
EXPO_PUBLIC_TAX_RATE=0.18
```

- **Android emulator:** use `http://10.0.2.2:8080`
- **Physical device:** use your PC LAN IP (not `localhost`)

## Run

This project targets **Expo SDK 54** so it works with the **Expo Go** app from the App Store / Play Store.

```bash
npm install
npx expo start
# Scan QR with Expo Go (iOS Camera or Android Expo Go app)
# Android emulator: press a — use http://10.0.2.2:8080 as Server URL
```

Staff login requires `FNB_STAFF`, `WAITER`, `CASHIER`, `RECEPTIONIST`, `HOTEL_ADMIN`, or `MANAGER`.

After the first full login, staff can set a 4–6 digit PIN for faster sign-in on shared tablets.

## Build (EAS)

Store and internal builds use **EAS Build** only (not local APK/IPA for distribution):

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile staging
eas build --platform ios --profile staging
eas build --platform android --profile production
```

Submit to stores:

```bash
eas submit --platform android
eas submit --platform ios
```

Profiles are defined in `eas.json` (`development`, `staging`, `production`).

## Building

```bash
npx eas build --platform android --profile staging
npx eas build --platform ios --profile staging
```

## Production Build

```bash
npx eas build --platform all --profile production
```

`app.config.js` sets `usesCleartextTraffic` per EAS profile: **false** for production (HTTPS only), **true** for development/staging LAN HTTP. Override locally with `EXPO_PUBLIC_ALLOW_CLEARTEXT` in `.env`.


| Profile     | Env source         | Cleartext | API URL            |
| ----------- | ------------------ | --------- | ------------------ |
| development | `eas.json` → `env` | yes       | localhost          |
| staging     | `eas.json` → `env` | yes       | LAN HTTP (edit IP) |
| production  | `eas.json` → `env` | no        | HTTPS required     |


Local `expo start` still reads `.env`. `.env.staging` / `.env.production` are optional mirrors for local dev — EAS Build does **not** support `envFile` in `eas.json`; use `env` or [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## Push Notifications Setup

Project is linked to Expo (`eas init` complete). Configure **FCM** (Android) and **APNs** (iOS) before expecting delivery on device.

| Setting | Value |
| ------- | ----- |
| Expo project | https://expo.dev/accounts/gboy21/projects/hms-waiter |
| Android package | `com.hms.waiter` |
| iOS bundle ID | `com.hms.waiter` |
| EAS project ID | `66ffb059-4df9-4086-a14f-f2a765cc9289` |

On login, the app registers via `POST /api/v1/hotels/{id}/staff/push-token`; the backend sends via Expo Push API.

### Before you start

- **Android first** — can be done entirely on Windows.
- **iOS** — requires an [Apple Developer Program](https://developer.apple.com/programs/) account ($99/year).
- After credentials are set, **rebuild with EAS**. Expo Go will not receive push.

---

### Part A — Android: FCM (Firebase)

#### Step 1 — Create Firebase project

1. Open https://console.firebase.google.com/
2. **Add project** (e.g. `HMS Waiter`) and finish setup.

#### Step 2 — Register the Android app

1. In Firebase → **Add app** → **Android**.
2. **Android package name:** `com.hms.waiter` (must match `app.json` exactly).
3. Skip debug signing SHA for now (optional for push).
4. **Download `google-services.json`**.
5. Save it to `mobile-pos/google-services.json` (project root, next to `app.json`).

#### Step 3 — Get FCM V1 service account key

1. Firebase → **Project settings** (gear) → **Service accounts**.
2. Click **Generate new private key** → **Generate key**.
3. You get a JSON file like `hms-waiter-firebase-adminsdk-xxxxx.json`.
4. Store it outside git (e.g. `mobile-pos/secrets/`) — **do not commit**.

#### Step 4 — Upload key to Expo

**Option A — Web (easiest)**

1. Open https://expo.dev/accounts/gboy21/projects/hms-waiter/credentials
2. **Android** → select or add application id `com.hms.waiter`
3. Under **Service credentials** → **FCM V1 service account key**
4. **Add a service account key** → upload the JSON → **Save**

**Option B — CLI**

```cmd
cd /d D:\PERSONNEL\HMS\mobile-pos
eas credentials
```

Then: **Android** → **production** (or the profile you build with) → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **Upload a new service account key** → point to your JSON file.

#### Step 5 — Wire `google-services.json` in the app

`app.json` already references the file:

```json
"android": {
  "googleServicesFile": "./google-services.json"
}
```

Add the downloaded `google-services.json` from Step 2. Firebase admin JSON files are gitignored via `secrets/` and `*-firebase-adminsdk-*.json`.

#### Step 6 — Rebuild Android

```cmd
cd /d D:\PERSONNEL\HMS\mobile-pos
eas build --profile staging --platform android
```

Install the APK on a **physical device** (not an emulator for the first test).

---

### Part B — iOS: APNs key (.p8)

Requires Apple Developer login.

#### Step 1 — Create APNs key in Apple Developer

1. https://developer.apple.com/account/resources/authkeys/list
2. **+** (Create a key)
3. Name: `HMS Waiter Push`
4. Enable **Apple Push Notifications service (APNs)**
5. **Continue** → **Register** → **Download** `.p8` file (download once — Apple will not show it again)
6. Note the **Key ID** (10 chars) and **Team ID** (top-right of developer portal)

#### Step 2 — Upload to Expo

**Option A — Web**

1. https://expo.dev/accounts/gboy21/projects/hms-waiter/credentials
2. **iOS** → `com.hms.waiter`
3. **Push Notifications** → **Add** / **Upload**
4. Upload `.p8`, enter **Key ID** and **Team ID**

**Option B — CLI (often easier)**

```cmd
cd /d D:\PERSONNEL\HMS\mobile-pos
eas credentials
```

Then: **iOS** → **production** → **Push Notifications: Manage your Apple Push Notifications Key** → **Set up a new key** (EAS can create it for you), or **Upload existing** → path to your `.p8`.

#### Step 3 — Rebuild iOS

```cmd
eas build --profile staging --platform ios
```

Install via TestFlight or internal distribution.

---

### Part C — Verify push end-to-end

#### 1. Register token (app)

1. Install an **EAS build** (not Expo Go).
2. Log in as staff on a physical device.
3. Allow notifications when prompted.
4. Check backend DB — table `staff_push_tokens` should have a row with an `ExponentPushToken[...]` value.

#### 2. Send test (Expo tool)

1. https://expo.dev/notifications
2. Paste the token from the DB or Metro logs.
3. Title/body → **Send**.

If this works, Expo credentials are correct.

#### 3. Test real HMS flow

Mark a kitchen line **ready** (`LINE_READY`) — backend `PushNotificationService` → Expo → device.

---

### Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Token registers, nothing arrives (Android) | FCM key not uploaded or no `google-services.json` | Part A steps 3–5 + rebuild |
| `InvalidCredentials` (iOS) | No APNs key for `com.hms.waiter` | Part B + rebuild |
| No token at all | Expo Go / simulator | Use EAS build on real device |
| `[push] EAS projectId missing` | Old build | Rebuild after `eas init` |

### Suggested order

1. **Android FCM** (Part A) — matches staging APK workflow.
2. **iOS APNs** (Part B) — when Apple Developer account is ready.
3. **Verify** — `eas build` → install → test at https://expo.dev/notifications

## Bluetooth Printing

Requires custom dev build. On Android 12+, the app requests `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` at runtime before scan/connect/print.

```bash
npx expo install react-native-thermal-receipt-printer-image-qr
npx eas build --profile development --platform android
```

## HMS integration


| Mobile action                   | API                                         | HMS web                   |
| ------------------------------- | ------------------------------------------- | ------------------------- |
| Cash / Card / Room / Bill later | `POST …/inventory/deliveries`               | Invoices → **Deliveries** |
| Convert to invoice (cashier)    | `POST …/deliveries/{id}/convert-to-invoice` | Deliveries → invoice      |


