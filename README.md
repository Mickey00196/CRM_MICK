# Mick CRM

A fast, personal place to see where every project stands and what you need to do next. It replaces a slow general-purpose CRM.

You land on your to-dos. Every project sits in one of four stages (**To do → Active → Waiting on others → Done**). A project with nothing lined up is flagged, so nothing stalls quietly.

The original, broader "guided selling" spec is in [`docs/spec.md`](docs/spec.md). As of 27 October 2026 the scope is a personal tool, so the sales-coach parts of that spec (scorecards, sequences, targets) are out unless they prove useful later.

## What it does

- **To-dos (start page).** Overdue, Today and Upcoming. Each row shows the to-do, what it's for, and when it's due.
  - Plain to-dos complete in one click, with Undo.
  - Calls, emails, meetings and viewings ask "How did it go?" instead. That logs the outcome and suggests the next step.
- **Projects.** A board with four columns: drag a card to change its stage. Each card shows its company, what you're waiting on, and the next to-do with its date.
  - Projects with no next step show in amber, both on the board and at the bottom of To-dos.
- **Project page.**
  - Rename by clicking the title. Switch the stage, and say what you're waiting on.
  - Add to-dos inline, keep notes, and log calls, emails and meetings.
  - Link a company (optional) and see its people.
- **Companies and contacts.** The address book behind your projects, with full office and lease details for tenant rep work: lease timeline, notice deadlines, decision window.
- **Log.** Everything you've logged, across all projects, with weekly counts.
- **Speed.**
  - Pages open instantly from cache and refresh in the background.
  - Keyboard shortcuts: `N` new to-do, `P` new project, `L` log something for the project or company you're on, `/` search, `⌘K` quick capture from anywhere.
- **Reminder email (optional).** On weekdays at 07:30: overdue items, today's items, and projects without a next step.

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
