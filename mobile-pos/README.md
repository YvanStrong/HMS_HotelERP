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

After the first full login, staff can set a 4-digit PIN for faster sign-in on shared tablets.

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

## Push Notifications Setup

1. Run: `npx eas build` (creates project on expo.dev)
2. Copy projectId from expo.dev dashboard
3. Add to `app.json` → `extra.eas.projectId`
4. Rebuild for push to work

## Bluetooth Printing

Requires custom dev build:

```bash
npx expo install react-native-thermal-receipt-printer-image-qr
npx eas build --profile development --platform android
```

## HMS integration


| Mobile action                   | API                                         | HMS web                   |
| ------------------------------- | ------------------------------------------- | ------------------------- |
| Cash / Card / Room / Bill later | `POST …/inventory/deliveries`               | Invoices → **Deliveries** |
| Convert to invoice (cashier)    | `POST …/deliveries/{id}/convert-to-invoice` | Deliveries → invoice      |


