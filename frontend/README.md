# HMS Frontend (Next.js 14)

Staff UI for the Spring Boot API: **JWT login** (stores `role` + `permissions`), **hotel workspace** with a sidebar for every module aligned with `postman/HMS-Room-Module.postman_collection.json`, and **platform** pages for super admin. Locked sidebar entries stay visible but dimmed; tooltips describe who can call the APIs.

## Prerequisites

1. **Backend** running on `http://localhost:8080` (or your URL).
2. **CORS** — backend `SecurityConfig` allows `http://localhost:*` and `http://127.0.0.1:*`.
3. **Hotel** — run **Setup Initialize** (or use an existing hotel UUID). You need the same id for `X-Hotel-ID` as for the path.

## Setup

```bash
cd frontend
copy .env.local.example .env.local   # Windows; use cp on Unix
```

Edit `.env.local`:

- `NEXT_PUBLIC_API_URL` — API base (no trailing slash).
- `NEXT_PUBLIC_DEFAULT_HOTEL_ID` — hotel UUID from initialize / Postman `hotelId`.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Login** → use credentials from your backend seed (e.g. Initialize body: `hoteladmin` / `ChangeMe!Strong2` — not the placeholder `password` unless your DB still uses that).

Then open **Hotel workspace** from the home page (or go to `/hotels/{hotelId}/dashboard`). After **super admin** login, use **Platform (super admin)** for `/api/v1/platform/**`.

## OpenAPI / Swagger

The backend serves **Swagger UI** at `{NEXT_PUBLIC_API_URL}/swagger-ui/index.html` (for example `http://localhost:8080/swagger-ui/index.html`). Authorize with `Bearer <accessToken>` from `POST /api/v1/auth/login`. Hotel routes accept optional `X-Hotel-ID` (the UI sets it from the path / saved `hotelId`).

## What is out of scope here

This app is **not** the full v1.0 staff portal (see `docs/HMS_V1_SPEC_GAP_AND_ROADMAP.md`). Several pages are thin (JSON or one GET) while write flows remain in Swagger or Postman.

## API helper

`src/lib/api.ts` — `API_BASE`, `swaggerUiUrl()`, `Authorization: Bearer`, optional `X-Hotel-ID`. `clearToken()` clears token, stored user, and saved hotel id.
