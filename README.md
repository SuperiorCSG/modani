# Care Log Automation Admin Dashboard

Admin-only automation dashboard for reviewing ClearCare/WellSky Personal Care unsigned care logs.

The application prepares eligible care logs for review and only signs after an authenticated admin explicitly approves an item in the dashboard.

## Stack

- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma
- Redis + BullMQ
- Playwright
- bcrypt password hashing
- AES-256-GCM target-site password encryption

## Environment variables

Copy `.env.example` to `.env` for local development and fill in secrets:

```bash
TARGET_SITE_URL=https://caringcompanionsmacon.clearcareonline.com/
TARGET_SITE_USERNAME=<admin/automation username>
TARGET_SITE_PASSWORD=<admin/automation password>
ENCRYPTION_KEY=<32-byte encryption key>
DATABASE_URL=<postgres database url>
REDIS_URL=<redis url>
SESSION_SECRET=<secure random secret>
SIGNATURE_TEMPLATE="// {{careManagerName}} //"
AUTOMATION_CAPTURE_SNAPSHOTS=false
ENABLE_MOCK_PREVIEW=false
```

Do not commit `.env` files or real credentials.

`ENCRYPTION_KEY` must be exactly 32 bytes when interpreted as UTF-8 or base64-decoded. Example local generation:

```bash
openssl rand -base64 32
```

## Local setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run admin:create
npm run dev
```

Create the first admin by setting:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change-me' npm run admin:create
```

There is no public signup, client login, or caregiver login.

## Mock UI preview

If Postgres/Redis are not available yet, you can preview the dashboard UI with mock data:

```bash
ENABLE_MOCK_PREVIEW=true npm run dev
```

Then open:

```text
http://localhost:3000/preview
```

This page does not connect to the target site, does not use real credentials, and is disabled unless
`ENABLE_MOCK_PREVIEW=true`.

## Running PostgreSQL and Redis locally

Example Docker commands:

```bash
docker run --name clearcare-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=clearcare_admin -p 5432:5432 -d postgres:latest
docker run --name clearcare-redis -p 6379:6379 -d redis:latest
```

Then set:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clearcare_admin
REDIS_URL=redis://localhost:6379
```

## Database migrations

Generate the Prisma client:

```bash
npm run prisma:generate
```

Create/apply migrations during development:

```bash
npm run prisma:migrate
```

For production, run Prisma migrations in your deployment pipeline before starting the app/workers.

## Workers

Start the web app:

```bash
npm run dev
```

Start the automation worker:

```bash
npm run worker:automation
```

Start the scheduler worker:

```bash
npm run worker:scheduler
```

The scheduler worker polls enabled schedules and queues automation runs. Daily schedules use "yesterday" based on the configured timezone.

## Playwright

Install browsers locally if needed:

```bash
npx playwright install chromium
```

The automation worker launches Chromium in headless mode. It logs into the configured target site, opens the unsigned care logs report, applies filters, extracts rows, and visits eligible care logs for task validation.

## Testing the automation

1. Create an admin with `npm run admin:create`.
2. Log into `/login`.
3. Open `/settings` and save the target URL, username, password, signature template, and snapshot preference.
4. Start Redis and the automation worker.
5. Open `/runs` and queue a manual run for yesterday, a single date, or a date range.
6. Review queued results in `/runs/[id]` and eligible items in `/review`.
7. Click **Approve and sign** only after confirming the care log details.

## Compliance and security notes

- Target-site credentials are never hardcoded.
- Target-site passwords are encrypted with AES-256-GCM before database storage.
- Password fields are write-only in the settings UI and are never displayed back.
- Admin passwords are hashed with bcrypt.
- Session cookies are HTTP-only and signed with `SESSION_SECRET`.
- Logs and audit metadata redact secret-like fields.
- Care logs are not silently auto-signed. Signing only occurs after explicit admin approval from the review page.
- Screenshots and HTML snapshots can include PHI. Enable them only when necessary and store them in secured infrastructure.
- Use deployment secrets or an encrypted secret manager in production.
- Restrict production access to authorized administrators and protect the database, Redis, artifact storage, and logs as PHI-bearing systems.

## Production deployment notes

- Set all required environment variables with your platform's encrypted secret storage.
- Run database migrations before starting the app.
- Run web, automation worker, and scheduler worker as separate processes.
- Configure Redis with authentication/TLS where available.
- Store Playwright artifacts in secured private storage if snapshot capture is enabled.
- Rotate target-site credentials and encryption/session secrets according to your organization's policy.
