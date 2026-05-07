# Deploying HMS Hotel ERP (beginner guide)

This document explains how to put **this repository** on a server so guests and staff can use the app. You have **two parts**:

| Part | What it is | In this repo |
|------|----------------|---------------|
| **Backend** | Java (Spring Boot) API + database migrations | `backend/` |
| **Frontend** | Next.js website (pages, staff UI, guest self-order) | `frontend/` |
| **Database** | **PostgreSQL** — stores hotels, users, reservations, self-orders, etc. | Not in git; you install or rent it on a server |

The **browser** talks to the **backend** using normal web addresses (URLs). Your frontend is already wired for that in `frontend/src/lib/api.ts` via **`NEXT_PUBLIC_API_URL`**.  
The **backend** talks to **PostgreSQL** using a JDBC URL and credentials (see below). Guests **never** connect to the database directly.

---

## Words you will see

- **Build** — turn source code into something you can run (a `.jar` file or a `.next` folder).
- **JAR** — Java “archive”. Spring Boot’s usual output is one **fat JAR** that includes a web server. You run: `java -jar hms-backend-....jar`. **This is what this project uses today** (see `backend/pom.xml`).
- **WAR** — Java “web application archive”. You deploy it **into** an existing **Tomcat** (or similar) server instead of running `java -jar` yourself.
- **Reverse proxy** — a program (often **Nginx** or **Caddy**) that sits in front of your apps: visitors use `https://yourdomain.com`, and the proxy forwards `/api` to Java and `/` to Next.js. That is the **“everything on one domain”** approach.

---

## Hosting the database (PostgreSQL) on a live server

Your app expects **PostgreSQL** (see Flyway migrations under `backend/src/main/resources/db/migration/`). On production you normally run with **`spring.profiles.active=prod`**; then the backend reads **`application-prod.properties`**, which requires database settings via **environment variables** (no hard-coded passwords).

### Important idea

- **PostgreSQL runs as its own service** (a “database server” process).
- Only the **Spring Boot JAR** should connect to it (over the network **localhost** or a **private IP**).
- **Do not** open PostgreSQL port **5432** to the whole internet unless you use SSL + strong auth and know the risks. Easiest safe pattern: Postgres listens on **127.0.0.1** only on the same machine as the API.

### Three common ways to “host” the database

#### A) PostgreSQL on the **same VPS** as the API (good for many small deployments)

1. Install PostgreSQL on that Linux server (package name is often `postgresql` — exact commands depend on Ubuntu, Debian, etc.).
2. Create a database and a dedicated user for the app (never use the `postgres` superuser for the app in production).
3. Set the JDBC URL to use **localhost** so traffic never leaves the machine:

   `SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/hms`

4. Set username and password:

   `SPRING_DATASOURCE_USERNAME=hms_app`  
   `SPRING_DATASOURCE_PASSWORD=<a long random password>`

5. Configure PostgreSQL so it **accepts** connections from that user to database `hms` (often `pg_hba.conf` for local socket or `127.0.0.1`).

**Firewall:** only **443** (and maybe **80**) need to be public for your website. **5432** should **not** be exposed to the public if Postgres is only for the app on the same host.

#### B) PostgreSQL on a **second** server (DB only)

Useful when you want more RAM for the database or separation of roles.

- The DB server has a **private** IP (e.g. `10.0.0.5`) reachable from your app server.
- Example URL: `jdbc:postgresql://10.0.0.5:5432/hms`
- Cloud providers often call this a “private network” or “VPC”. Allow port **5432** only from the app server’s IP.

#### C) **Managed** PostgreSQL (cloud “database as a service”)

Examples: **AWS RDS**, **Google Cloud SQL**, **Azure Database for PostgreSQL**, **DigitalOcean Managed Databases**, **Supabase**, etc.

- The provider gives you a **host name**, **port**, **database name**, **user**, **password**, and often requires **SSL**.
- JDBC URL often looks like:

  `jdbc:postgresql://your-instance.abcdef.cloud.provider.com:5432/hms?sslmode=require`

Read your provider’s doc for the exact `sslmode` and hostname.

### Example: create database and user (SQL)

Run as a superuser in `psql` (adapt names/passwords):

```sql
CREATE USER hms_app WITH PASSWORD 'replace_with_a_strong_password';
CREATE DATABASE hms OWNER hms_app;
```

Your migrations will create tables on first backend startup. The `hms_app` user needs permission to run DDL (Flyway) — owning the database is usually enough.

### Backups (do not skip)

- Take regular **logical backups** (`pg_dump`) or use your cloud’s **automated backups**.
- Store backups **off** the same disk (another region or object storage).
- Test restoring a backup once so you know it works.

### Order of operations

1. PostgreSQL installed and running.  
2. Database + user created.  
3. Start the **backend** with `prod` profile and env vars — Flyway applies migrations.  
4. Then deploy **frontend** and Nginx as described later in this doc.

---

## Before you deploy (all options)

1. **PostgreSQL** — Follow the section **Hosting the database** above. Point the backend at it using **`SPRING_DATASOURCE_*`** when using the **`prod`** profile.
2. **Secrets** — Never commit real passwords. Set DB URL, JWT secret, Twilio keys, etc. on the **server** only (env vars or a secrets file **outside** git).
3. **Flyway** — When the backend starts, it runs migrations in `backend/src/main/resources/db/migration/`. The DB user must be allowed to create/alter tables.

---

## Option 1 — “Everything on one server / one website” (recommended for beginners)

**Idea:** One public URL (e.g. `https://hotel.example.com`).  
- Browser loads the **Next.js** site from that URL.  
- Browser calls **API** as `https://hotel.example.com/api/v1/...` (same site).  
- **Nginx** (or Caddy) forwards `/api/` to Spring Boot on `http://127.0.0.1:8080` and everything else to Next.js.

**Why it is nice:** Same “origin” for browser security (simpler than cross-domain cookies/CORS for many setups).

### Step 1 — Build the backend (JAR)

On your PC or on the server (with Java 17 + Maven):

```bash
cd backend
mvn -DskipTests package
```

Result is usually:

`backend/target/hms-backend-0.1.0-SNAPSHOT.jar`

Copy that file to the server.

### Step 2 — Run the backend on the server

Example (adjust path and profile):

```bash
export SPRING_PROFILES_ACTIVE=prod
java -jar /opt/hms/hms-backend-0.1.0-SNAPSHOT.jar
```

In production you normally run this under **systemd** or **Docker** so it restarts if the machine reboots.

Confirm from the server:

```bash
curl -s http://127.0.0.1:8080/actuator/health
```

If actuator is disabled, try:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/swagger-ui/index.html
```

You want Spring listening on **8080** (or another port you will proxy to).

### Step 3 — Build the frontend with the **public** API URL

On a machine with Node.js, **before** `next build`, set the API base to **your final public site** (no trailing slash):

**Linux / macOS:**

```bash
cd frontend
export NEXT_PUBLIC_API_URL=https://hotel.example.com
npm ci
npm run build
```

**Windows (PowerShell):**

```powershell
cd frontend
$env:NEXT_PUBLIC_API_URL="https://hotel.example.com"
npm ci
npm run build
```

This bakes the URL into the client bundle. Then:

```bash
npm run start
```

By default Next listens on port **3000**. Nginx will proxy traffic to it.

### Step 4 — Nginx sketch (one host)

This is **illustrative** — replace domain, paths, and SSL certificate paths.

```nginx
server {
    listen 443 ssl http2;
    server_name hotel.example.com;

    # ssl_certificate ...;
    # ssl_certificate_key ...;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # If you use Spring WebSocket on the same server, add a location for it (path from your app).

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Beginner checklist**

- [ ] **PostgreSQL** installed, database + app user created, backend env vars set (`SPRING_DATASOURCE_*`)  
- [ ] DNS A/AAAA record points `hotel.example.com` to your server’s IP  
- [ ] Firewall allows **443** (and **80** → redirect to HTTPS); **not** exposing **5432** publicly unless you use a managed DB with SSL by design  
- [ ] Backend reachable on localhost **8080**  
- [ ] Frontend `npm run start` on **3000** (or change `proxy_pass`)  
- [ ] `NEXT_PUBLIC_API_URL` was **`https://hotel.example.com`** at **build** time (or see **API under a path** below)

---

## API under a path (example: `https://hotelerp.rw/Hotel`)

Renaming the JAR to **`Hotel.jar`** only changes the **file** on disk. The browser URL **`/Hotel`** comes from configuration, not from the JAR name.

**1. Spring Boot — context path**

In production config (or `application.properties`), set:

```properties
server.servlet.context-path=/Hotel
```

Then the API lives at `http://localhost:8080/Hotel/api/v1/...` on the machine, and Swagger at `http://localhost:8080/Hotel/swagger-ui/index.html`.

**2. Frontend — tell Next.js the public base**

At **build** time, set the full public URL (no trailing slash):

```bash
export NEXT_PUBLIC_API_URL=https://hotelerp.rw/Hotel
npm run build
```

Alternatively, if the site and API share the same origin and you only want to configure the path: set **`NEXT_PUBLIC_API_BASE_PATH=/Hotel`** and leave `NEXT_PUBLIC_API_URL` empty (browser uses `https://hotelerp.rw` + `/Hotel`). For server-side rendering edge cases, prefer the full **`NEXT_PUBLIC_API_URL`**.

**3. Production env — public API URL must include the path**

Set **`HMS_PUBLIC_BASE_URL`** (see `application-prod.properties`) to the same base the world uses, e.g. **`https://hotelerp.rw/Hotel`**, so links and callbacks stay correct.

**4. Nginx — proxy the prefix to Java**

If Tomcat/Spring listens on `127.0.0.1:8080` with context path `/Hotel`:

```nginx
location /Hotel/ {
    proxy_pass http://127.0.0.1:8080/Hotel/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Keep your **`location /`** block for Next.js on paths that are **not** under `/Hotel/` (or order `location` blocks so the more specific `/Hotel/` wins).

**CORS:** allow origin **`https://hotelerp.rw`** in `HMS_CORS_ALLOWED_ORIGINS` if the browser loads pages from that host.

---

## Option 2 — Two separate addresses (no reverse proxy to Java)

**Idea:**  
- Frontend: `https://app.hotel.example.com` (Next.js)  
- Backend: `https://api.hotel.example.com` (Spring Boot)

Build frontend with:

```bash
export NEXT_PUBLIC_API_URL=https://api.hotel.example.com
npm run build
```

You must configure **CORS** on the Spring Boot app so it allows the browser origin `https://app.hotel.example.com`. (Your project’s `SecurityConfig` may already have patterns for localhost; production needs your real domain.)

---

## Option 3 — Deploy backend as a **WAR** file (Tomcat)

**When this makes sense:** You already run **Apache Tomcat** (or similar) and your IT policy says “only WAR deployments.”

**Important:** This repo’s `pom.xml` is set up for a **JAR**, not a WAR. Turning it into a WAR is a **separate change** (packaging `war`, `provided` scope for embedded Tomcat, and a `SpringBootServletInitializer` class). If you need that, treat it as a small project with your Java developer or follow Spring’s official “convert JAR to WAR” guide.

**High-level steps (after the project is converted to WAR):**

1. Build: `mvn package` → get `hms-backend-....war`.
2. Copy the WAR into Tomcat’s `webapps/` (sometimes renamed to `ROOT.war` if you want it at `/`).
3. Configure Tomcat with env vars / JNDI for datasource and secrets.
4. Start Tomcat.
5. Build the frontend with `NEXT_PUBLIC_API_URL` pointing to wherever Tomcat serves the API (e.g. `https://api.hotel.example.com/hms-backend` if the WAR name creates a context path).

Most beginners find **Option 1 (JAR + Nginx)** simpler than maintaining Tomcat + WAR.

---

## After deployment

- Open your site in a browser, log in as staff, smoke-test one hotel.  
- Guest self-order and public URLs must use **HTTPS** if you use camera, geolocation, or push notifications in strict browser modes.  
- Keep **database backups** and a way to roll back Flyway migrations if something goes wrong.

---

## Quick reference — env vars (frontend)

| Variable | Meaning |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Full base URL of the API, **no** trailing slash (e.g. `https://hotelerp.rw/Hotel` or `https://api.hotel.example.com`). Set **before** `npm run build`. Overrides `NEXT_PUBLIC_API_BASE_PATH` when set. |
| `NEXT_PUBLIC_API_BASE_PATH` | Optional same-origin path only, e.g. `/Hotel`. Used when `NEXT_PUBLIC_API_URL` is empty: browser uses `origin + path`. Prefer full `NEXT_PUBLIC_API_URL` for production builds if you use SSR. |
| `NEXT_PUBLIC_DEFAULT_HOTEL_ID` | Optional UUID for shortcuts on the home page (see `frontend/.env.local.example`). |

---

## Quick reference — backend environment (`prod` profile)

Set these on the **server** (systemd `Environment=`, Docker `environment`, hosting panel “env vars”, etc.). See `backend/src/main/resources/application-prod.properties`.

| Variable | Meaning |
|----------|---------|
| `SPRING_PROFILES_ACTIVE` | Set to `prod` for production. |
| `SPRING_DATASOURCE_URL` | JDBC URL, e.g. `jdbc:postgresql://127.0.0.1:5432/hms` or managed URL with `?sslmode=require` if required. |
| `SPRING_DATASOURCE_USERNAME` | Database user (not the `postgres` superuser in production). |
| `SPRING_DATASOURCE_PASSWORD` | That user’s password. |
| `HMS_SETUP_TOKEN` | Required in prod (see app startup validation). |
| `HMS_JWT_SECRET` | Strong secret for signing JWTs. |
| `HMS_PUBLIC_BASE_URL` | Public URL of the **API** as the world sees it (include a path prefix if you use one, e.g. `https://hotelerp.rw/Hotel`). Used in links, emails, webhooks — align with Nginx and `server.servlet.context-path`. |
| `HMS_FRONTEND_BASE_URL` | Public URL of the **Next.js** site (password reset links, etc.). |
| `HMS_CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API, e.g. `https://hotel.example.com`. |

---

## Where to look in the code

- `frontend/src/lib/api.ts` — `API_BASE`, staff `fetch` wrapper.  
- `frontend/src/lib/publicApi.ts` — public (unauthenticated) kiosk/catalog calls; also uses `API_BASE`.  
- `backend/src/main/resources/application.properties` — defaults; use profile-specific files or env for production.

If you tell your host “**JAR + Nginx single domain**” or “**WAR on Tomcat**”, they can use this doc as the checklist.
