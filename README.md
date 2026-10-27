# Mick CRM

A guided-selling CRM for office tenant rep. You land on your to-dos; every account has one next step; every call, email, LinkedIn message, meeting and viewing is logged against the account, mostly as a by-product of completing a to-do.

The full product spec is in [`docs/spec.md`](docs/spec.md). This repo is **Phase 1a**.

## What's in Phase 1a

- **To-dos (start page):** Overdue / Today / Upcoming. Each row shows only the account and the due date. Clicking a row opens a detail panel with the contact, last communication and office summary.
- **"How did it go?":** completing a to-do asks for the outcome and a one-line note, then suggests the next step based on the outcome (no answer → call again in 2 days, meeting booked → prep the meeting, not interested → check in after 6 months). The communication is logged on the account automatically.
- **Accounts:** table with Leads / Prospects / Clients / All views, sort, filter, column picker, saved views, bulk status/archive, CSV export (semicolon-separated for Dutch Excel).
- **Account page:** status, a prominent next step, quick-log buttons, and three tabs:
  - Overview
  - Office & lease: every field from the spec, multiple locations, previous locations kept
  - Communication: the timeline, filterable by channel and contact
- **Lease intelligence:** remaining term, next key date (break, notice deadline or lease end), the 24-month decision window, and a lease timeline bar.
- **Contacts:** a table plus a contact page with its own timeline, buying role, do-not-contact and lawful basis.
- **Communication:** everything logged, filterable by account, channel, outcome and date, with weekly counts per channel.
- **Quick capture:** `⌘K` / `Ctrl K` from anywhere adds a to-do, communication, account or contact. `L` logs communication (for the current account when you're on one), `N` adds a to-do, `/` searches.
- **Flags:** active accounts (prospects and clients) without a next step show under "No next step" on To-dos and in amber in the accounts table.
- **Reminder email:** weekdays at 07:30, listing overdue items, today's items and accounts without a next step (needs Resend).
- **Your data:** export everything as JSON from Settings.
- **Appearance:** light and dark mode, dates as dd-mm-yyyy, 24h time, EUR, m².

### Coming next: Phase 1b

Deals board, documents upload, custom fields, CSV import. The tables for deals, documents and custom fields already exist.

## Stack

React, TypeScript, Tailwind and Radix (shadcn-style) on Vite. An Express API on Postgres. One service serves both the API and the app.

## Architecture

See [`docs/architecture.md`](docs/architecture.md): structure, security model, operations, the latest review and what's deliberately deferred.

## Run locally

```bash
npm install
cp .env.example .env          # set DATABASE_URL, APP_EMAIL, APP_PASSWORD
export $(cat .env | xargs)
npm run dev                   # API on :3000, app on :5173
npm run seed:dev              # optional: 6 demo accounts tagged "demo"
```

## Test

```bash
createdb crm_test                                   # once
TEST_DATABASE_URL=postgres://localhost/crm_test npm test
npm run typecheck
```

The tests wipe and rebuild the schema in the test database, so never point `TEST_DATABASE_URL` at real data. CI runs all of this on every push.

## Deploy on Railway

1. Create a project. When asked for a region, pick **EU West (Amsterdam)**.
2. Add a **PostgreSQL** database, and turn on **Backups** in its settings.
3. Add a service from this GitHub repo.
4. On the service, set these variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `APP_EMAIL` and `APP_PASSWORD` (at least 16 characters)
   - `TIMEZONE` = `Europe/Amsterdam`
   - optionally the reminder-email variables from `.env.example`
5. Generate a domain and set `APP_URL` to it.

`railway.json` sets the build and start commands and the health check (`/healthz`).
