# Architecture

How the CRM is put together, why, and what to change when. It is a personal project and to-do tracker for one user (see README). The original broader spec is in [spec.md](spec.md).

## Shape

One Node service and one Postgres database. Express serves the API and the built React app from the same origin, which keeps auth simple (one cookie, no CORS) and deploys as one unit.

```
web/        React app (Vite, Tailwind, Radix). Talks only to /api.
server/
  routes/   HTTP: parse input, check auth, call domain or query, respond.
  domain/   Workflows shared by routes, jobs and (later) automations:
            createTask, completeTask, logActivity, resolveLinks.
  routes/projects.ts  The board and project pages.
  digest.ts Weekday reminder email (in-process schedule).
  app.ts    Middleware, security headers, routing. No side effects, so tests boot it.
  index.ts  Migrate, create login, listen, schedule, shut down cleanly.
shared/     Vocabulary and pure rules used on both sides: statuses, channels,
            outcomes, next-step suggestions, lease maths.
test/       Unit tests and API tests against a real Postgres.
```

**Rule:** anything a scheduled job or automation will also do lives in `domain/`, never in a route. Plain CRUD (accounts, contacts, offices) can query directly from the route.

## Data

- **Core objects.** Projects have four stages: `todo`, `active`, `waiting`, `done`. To-dos and log entries hang off a project, a company, or both.
  - A project's company is optional. When it has one, that company wins: to-dos and log entries on the project get it too.
  - A project's next step is its earliest open to-do.
  - An open project with no open to-do is flagged.
- **Companies.** Each has contacts and office locations (all the lease fields). They are the address book behind projects.
- Every row has `owner_id`, and every query filters on it. `domain/links.ts` is the single gate for links between records. A linked company, contact or project must have the same owner and must not be archived. A contact must work at the same company, and a project can't point at a different company from the record.
- Deletes are soft (`archived_at`), except future GDPR "forget contact", which must be a real delete.
- Migrations are append-only in `server/migrations.ts`. They run on boot, one transaction each, under an advisory lock so two instances can't migrate at once.
- `DATE` columns hold calendar things (due dates, lease dates). `TIMESTAMPTZ` columns hold events (when a call happened). The server's `TIMEZONE` decides what "today" is, and the browser takes it from `/api/me`.

## Security

- **Login.** Email and password come from env and are hashed with scrypt. The session is a signed cookie: HttpOnly, SameSite=Lax, Secure over HTTPS, valid for 60 days.
- **Revocation.** Changing `APP_PASSWORD`, or "Log out on all devices", bumps `users.session_version`, which signs out every existing session.
- **CSRF.** Two layers: SameSite cookies, and an `X-CRM-Request` header that every write must carry. Browsers can't add that header from another site.
- **Headers.** A strict CSP (no inline scripts, no third-party origins), `frame-ancestors 'none'`, `nosniff`, and HSTS.
- **No third parties in the browser.** The font is self-hosted, so the app makes no requests to Google or anyone else, which also avoids the GDPR issue with Google Fonts.
- **Throttling and exports.** Logins are throttled per IP. CSV exports neutralise formulas, so a cell can't run in Excel.

## Operations

- `/healthz` checks the database, and Railway uses it for deploys.
- On SIGTERM the server finishes in-flight requests, then closes the database pool.
- The log has one line per API request (request id, method, path, status, duration). Request bodies and query strings are never logged, so no client data ends up in the logs.
- **Reminder email.**
  - A one-minute in-process tick claims the day atomically in `meta`, so there's at most one send per day even with several instances.
  - A failed send retries, up to 3 attempts.
  - A crash mid-send isn't retried. One missed reminder is better than a duplicate.

## Testing

`npm test` runs the unit tests plus API tests against a fresh Postgres schema. CI runs typecheck, tests and the build on every push.

The tests cover:
- tenant isolation between two users
- link integrity
- projects: board, stages, flagging, logging without a company
- the completion flow, including rollback on failure
- CSRF
- session revocation
- CSV escaping
- Dutch number parsing
- lease maths
- next-step rules
- the reminder email's daily claim

Before shipping a change, add a test that would have caught the bug it fixes.

## Review, 27 October 2026

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Client data in a personally hosted app: C&W policy unchecked | High | **Open (Mick)** |
| 2 | A to-do could be linked to another user's deal (deals since replaced by projects) | High | Fixed (`resolveLinks`) |
| 3 | A contact from one account could be logged on another | Medium | Fixed (`resolveLinks`) |
| 4 | Sessions survived a password change; no "log out everywhere" | Medium | Fixed (`session_version`) |
| 5 | CSRF relied only on SameSite cookies | Medium | Fixed (app header) |
| 6 | No security headers; inline script; fonts from Google (GDPR) | Medium | Fixed (CSP, self-hosted font) |
| 7 | CSV export open to formula injection | Medium | Fixed |
| 8 | No automated tests or CI | High | Fixed (29 tests, GitHub Actions) |
| 9 | Business workflows inside route handlers; Phase 2 jobs would duplicate them | Medium | Fixed (`server/domain`) |
| 10 | Reminder email marked "sent" before sending; not safe with two instances | Medium | Fixed (atomic claim, retries) |
| 11 | Concurrent boots could race on migrations and the session secret | Low | Fixed (advisory lock, insert-if-missing) |
| 12 | Slow responses could overwrite newer ones in the UI | Low | Fixed (request sequencing) |
| 13 | Current account found by reading the DOM | Low | Fixed (context) |
| 14 | One render error blanked the whole app | Low | Fixed (error boundary per page) |
| 15 | Time zone hard-coded in the browser | Low | Fixed (from `/api/me`) |
| 16 | Time zone interpolated into SQL | Low | Fixed (parameter) |
| 17 | No graceful shutdown; request logs missing | Low | Fixed |
| 18 | `body-parser` advisory (DoS) | Medium | Fixed (`npm audit fix`) |
| 19 | Not deployed; region and backups not set | High | **Open**: see README |

## Deliberately not done yet

Each of these is the right move at some point. Doing it now would add weight without reducing real risk.

| Change | Do it when |
|---|---|
| Postgres row-level security or composite `(owner_id, id)` foreign keys | Before a second user gets a login. Until then app-level scoping plus the isolation tests cover it. |
| Shared schema validation (e.g. zod) instead of hand-written parsers | Phase 4, when AI-parsed input and email templates widen the input surface. |
| TanStack Query instead of `useLoad` plus a change event | When you need optimistic updates, offline use or heavy caching. |
| Job queue (pg-boss, or a jobs table with `SKIP LOCKED`) | Phase 2: waiting-for-reply follow-ups and lease-date to-dos need retries and a run log. The in-process tick only suits the single daily email. |
| Trigram index for search | Past roughly 10,000 log entries. `ILIKE` is fine below that. |
| Saved views in the database | When you use the accounts views on more than one device. |
| Document storage | When you want files on a project: an S3-compatible bucket (Railway buckets), never in Postgres. |

## Before real client data goes in

1. **Check C&W policy.** Most firms require client and prospect data (names, contacts, lease terms) to live in approved systems. Ask compliance or IT. If the answer is no, use it only for your own prospecting pipeline, or for the side business.
2. **Host in the EU.** Put the service and the database in Railway's EU West (Amsterdam) region.
3. **Back up.** Turn on Railway Postgres backups and test one restore. **Settings → Export everything** is a second copy.
4. **Use a strong password.** At least 16 characters for `APP_PASSWORD`, from a password manager.
