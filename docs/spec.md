# Build: Guided-selling CRM

## Role & context
You are a senior CRM product engineer and an experienced B2B sales coach. Build a CRM for a solo B2B seller (multi-user ready later). This is not a database to fill in. It is a **sales coach**: it tells me what to do next, why, and how to do it well.

The CRM has three jobs:
1. **Guide me:** know the best next action for every account, deal and contact, and coach me through a proven sales process.
2. **Grow acquisition:** turn my targets into a daily activity plan and make sure I hit it.
3. **External brain:** every to-do, every communication and every detail about a client lives in the system, not in my head.

Dutch and English. Office and lease details are a core part of every account.

## Design principles (non-negotiable)
1. **I land on my to-dos.** The To-dos page is the start screen; everything else is one click away in the menu.
2. Every open deal and active account has exactly one **next step** with a due date. No next step = stalled = flagged on the To-dos page.
3. **Every communication is tracked.** Calls, emails, LinkedIn messages and meetings are logged against the account and contact, mostly as a by-product of completing a to-do.
4. Sales methodology is built in: stages have exit criteria, deals have a qualification scorecard, and the system flags what's missing.
5. Capture anything in under 5 seconds, from anywhere (Cmd/Ctrl+K).
6. Automation prepares; I approve what goes out.
7. Visually clean and calm: generous whitespace, neutral colours with one accent, thin dividers instead of boxes, no badges or clutter. Detail appears only when I open something.

## Stack
- Frontend: React + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase (Lovable Cloud): Postgres, Auth, Row Level Security on every table, Edge Functions, pg_cron for scheduled jobs, Storage (for documents)
- AI: LLM calls via edge functions only (never from the client)
- EU region. Timestamps stored UTC, displayed Europe/Amsterdam

---

## Layout & navigation

### Menu on the left
A fixed navigation menu on the **left side** of the screen (collapsible to icons). Top: "+ New" button (to-do, account, contact, deal, log communication). Then, in this order:
1. **To-dos** (start page)
2. **Accounts**
3. **Contacts**
4. **Deals**
5. **Communication** (log of all communication)
6. **Outreach** (sequences, email templates, talk-track library)
7. **Insights**
8. **Settings**

Global search and Cmd/Ctrl+K quick capture are available on every screen. On mobile the menu becomes a bottom bar.

### To-dos (start page)
This page must look **visually clean and calm**. It shows only what I need to follow up, nothing more.
- **Header:** today's date and a subtle "+ Add" (opens quick capture). No stats, counters or banners
- **List** under three quiet section labels: **Overdue, Today, Upcoming**. Each row shows only:
  - a circle checkbox
  - the **account name**
  - the **due date**, right-aligned (overdue dates in muted red; nothing else is coloured)
- To-dos without an account show their title instead of an account name
- Rows separated by thin 1px dividers, generous row height and whitespace. No cards, badges, icons, contact names or extra text in the rows
- At the bottom, small muted links: "Waiting for reply (n)" and "Suggestions (n)". They expand inline when clicked
- **Clicking a row** opens a calm detail panel from the right with: what to do (type + title), contact, last communication (channel, date, outcome), office summary (location, m², lease end), and actions: complete, snooze, open account, log communication, open email template
- **Completing a to-do** (via the checkbox or the panel) opens a "How did it go?" step in the panel: outcome buttons, a one-line note, and the next step. Then the panel closes and the row fades out
- Daily targets and stalled items live in Insights, not on this page

### Accounts (list)
All accounts I've added, as a sortable, filterable table with saved views (Leads / Prospects / Clients / All, plus custom views). Default columns: account, status, office location, size (m²), lease end, next step (red if overdue, amber if missing), last contact date, deal value. Columns configurable. Inline editing, bulk actions, CSV import and export.

### Account page
- **Header:** name, status, next step (prominent, editable), quick actions (log call, log email, log LinkedIn, log meeting, add note, add to-do, enroll in sequence)
- **Tabs:**
  1. **Overview:** key company info, primary office summary card, contacts, open deals, open to-dos
  2. **Office & lease:** full details per location (see below)
  3. **Communication:** full timeline of all communication and notes, newest first, filterable by channel and contact
  4. **Deals**
  5. **Documents:** lease agreement, floor plans, brochures, proposals (uploads)

---

## Office & lease details (per account)
Stored in `office_locations` (one or more per account, one marked primary, previous locations kept as history). All fields optional so I can save partial info fast and complete it over time. Fields grouped in sections:

**Location:** building name, address, postcode, city, area/submarket, floor(s)

**Space:** lettable floor area (m²), number of workstations, headcount, meeting rooms, parking spaces, occupancy/hybrid policy (e.g. 3 days in office), space quality / fit-out condition

**Lease:** tenure type (lease / flex / sublease / owned), landlord, landlord's agent, lease start date, lease end date, initial term, renewal options, notice period (months), break option date(s), sublet allowed (y/n)

**Financials:** rent (€/m²/year), total annual rent, service charges, parking rent, indexation (e.g. CPI), incentives (rent-free months, fit-out contribution), bank guarantee / deposit

**Situation:** satisfaction, pain points, growth or shrink expectations, who decides on real estate, notes

**Custom fields:** I can add my own fields (text, number, date, choice) to this section from Settings without code changes.

Computed and shown on the card:
- Remaining term ("lease ends in 14 months")
- Next key date: whichever comes first of break option, notice deadline or lease end
- Decision window: opens 24 months before lease end (configurable)
- A timeline bar from lease start to end, with today, break and notice dates marked

Lease dates drive to-dos: at 24 / 18 / 12 months before lease end or break, and with no active deal, a to-do "Start conversation" is created. An approaching notice deadline creates a high-priority to-do.

---

## Communication tracking
Every communication is an `activity` linked to an account, and to a contact and deal where relevant.

**Fields:** channel (call / email / LinkedIn / meeting / WhatsApp / other), direction (outbound / inbound), contact, date and time, outcome, summary/notes, linked to-do, linked deal, "expect reply" flag.

**Outcomes by channel:**
- Call: reached / no answer / voicemail / wrong number / meeting booked / not interested / call back later
- Email and LinkedIn: sent / replied / no reply / meeting booked / not interested
- Meeting: held / no-show / rescheduled

**Ways to log, all fast:**
1. **Completing a to-do:** the "How did it go?" panel shows outcome buttons, a one-line note and a next-step picker. The next step is pre-filled from the outcome (no answer → retry in 2 days; meeting booked → prep to-do on the meeting date; not interested → nurture in 6 months)
2. **"Log communication" button** on the account, contact and to-do, and in the "+ New" menu, for anything that happened without a to-do
3. **Email logging address:** BCC or forward any email to a unique inbound address and it's matched to the contact and account automatically. Unmatched emails go to an inbox for me to assign
4. **Connected mailbox (later phase):** Microsoft 365 / Gmail sync logs emails automatically and detects replies

**Waiting for reply:** when I log an outbound message with "expect reply" on, it appears under "Waiting for reply" on the To-dos page. If no reply is logged within X business days (default 5), a follow-up to-do is created automatically. Logging a reply clears it.

**Visibility:**
- The last communication shows in the to-do detail panel and on every account row
- The account Communication tab shows the full history
- The **Communication** page in the menu lists everything across all accounts, filterable by channel, outcome, account and date, with counts per week (these feed the activity targets)

---

## The guidance layer

### 1. Pipeline with exit criteria
Default pipeline (configurable; multiple pipelines supported):
**New → Contacted → Qualified → Discovery → Proposal → Negotiation → Won | Lost**, plus **Nurture**.

Each stage has a goal, an exit-criteria checklist, typical duration, default probability, and a playbook (auto-created to-dos, guidance text, suggested templates). Advancing with unmet criteria is allowed only with a logged reason, and it lowers deal health.

### 2. Qualification scorecard
On every deal: **Need, Impact/value, Decision maker, Decision process & timeline, Budget, Champion, Competition**. Each is unknown / partial / confirmed, with a note. Gaps generate suggested questions for the next conversation.

### 3. Deal health score (0–100)
Calculated from: scorecard completeness, an agreed next step, days since last two-way communication vs stage norm, number of engaged stakeholders, close-date slips, and time in stage. Shown as green/amber/red with the top 3 reasons.

### 4. Next best action engine
One recommended action per open deal and active account, with a one-line "why". Rules first, AI later. Examples:
- Lease ends within 18 months, no deal → "Start the conversation; the decision window is open"
- 3 calls with no answer → "Switch channel: try email or LinkedIn"
- Proposal sent 5 business days ago, no reply → call to-do + follow-up template
- Only one stakeholder engaged → "Add a second contact"
- Inbound reply → respond within 1 hour

Accept with one click (creates the to-do), dismiss with a reason, or snooze.

### 5. Goals → daily plan
I set a target (revenue or deals won per quarter) and average deal size. Using conversion rates (defaults first, then my own), the system calculates the weekly calls, emails, LinkedIn touches and meetings needed, shown as daily targets in Insights. Logged communication counts towards them automatically.

---

## Data model
All tables: UUID primary key, `owner_id`, `created_at`, `updated_at`, soft delete via `archived_at`. Accounts, contacts, deals and office_locations support `custom_fields` (jsonb) driven by `custom_field_definitions`.

- **accounts:** name, domain (unique, dedupe), industry, website, size band, status (lead / prospect / client / former client / not a fit), icp_fit, lead_source, language (NL/EN), tags
- **office_locations:** account_id, is_primary, is_current, plus all Office & lease fields above
- **contacts:** account_id, name, role, buying_role, email, phone, linkedin_url, language, last_contacted_at (computed), do_not_contact, opt_out_at, lawful_basis
- **deals:** account_id, pipeline, stage, value (EUR), probability, expected_close_date, close_date_slip_count, health_score, lost_reason, won_at, primary_contact_id, plus requirement fields (desired m² min/max, workstations, preferred locations, target move-in date, budget, must-haves)
- **activities (communication log):** account_id, contact_id, deal_id, task_id, channel, direction, outcome, summary, occurred_at, expect_reply, reply_due_at, replied_at, source (manual / to-do / logging address / mailbox sync / sequence)
- **tasks (to-dos):** title, type, due_at, priority, status (open / done / snoozed), snoozed_until, recurrence_rule, account_id, contact_id, deal_id, created_by (me / automation / sequence / playbook / recommendation), completed_at, completion_activity_id. A record's *next step* = its earliest open to-do
- **documents:** account_id, office_location_id, file, type
- **deal_qualification, deal_stakeholders, close_plan_steps, recommendations, meeting_briefs, meeting_debriefs, goals, lessons, talk_tracks**
- **email_templates, emails, sequences, sequence_steps, sequence_enrollments, playbooks, stage_exit_criteria, automations, automation_runs, inbox_items**

## Other features

### Quick capture / brain dump
Cmd/Ctrl+K from anywhere. Free text is parsed by AI. For example, *"Sanne van Northwind gebeld, zitten op 850 m² in Zuidas, huur loopt af maart 2028, volgende week mailen"* becomes a logged call (reached), office updates (850 m², Zuidas, lease end 03-2028) and an email to-do for next week. Always show a confirmation card before saving.

### Deals
Kanban and table views. A stage change checks exit criteria, runs the playbook and requires a next step. The deal page shows health, next best action, scorecard, stakeholders, requirement, close plan and communication timeline.

### Meeting prep & debrief (AI)
- **Prep brief** before every meeting: communication history, office and lease situation, scorecard gaps, agenda, tailored questions, likely objections
- **Debrief** after the meeting: dictated or typed notes. AI extracts the communication log entry, office/lease updates, scorecard updates, the next step and a follow-up email draft. I confirm before saving

### Reminders & notifications
In-app notifications; daily digest email on weekdays at 07:30 (overdue, today, waiting for reply, leases entering the decision window); optional browser push at due time; weekly review on Friday 16:00 (deals at risk, communication vs targets, stalled accounts).

### Email engine
- **Mode A: Draft & approve (default, no IT approval needed).** Emails from templates or sequences go to an approval queue. "Open in Outlook" opens a pre-filled draft; one click marks it sent and logs it as communication
- **Mode B: Connected send.** Microsoft 365 / Gmail, with automatic logging and reply detection
- **Rules:** send window weekdays 08:00–17:30; NL/EN template by contact language; opt-out handling; do_not_contact is a hard block; block sending if a merge field is empty

### Sequences & automations
- **Sequences:** multi-channel cadences (email, LinkedIn to-do, call to-do). Each step appears as a to-do and is logged as communication when done. Exit on reply or meeting booked
- **Automations:** When / if / then rules with sensible defaults (lease-date to-dos, no-reply follow-up, stalled account, post-meeting follow-up, nurture every 90 days), with a run log

### Insights
Communication volume vs targets by channel, funnel conversion, response rates by channel and template, deal velocity, weighted forecast, and lease ends per year across all accounts.

## UX
Professional, calm and minimal: lots of whitespace, a neutral palette with one accent colour, subtle typography hierarchy, and no visual noise. Keyboard shortcuts (N new, L log communication, / search, J/K navigate, E complete). To-dos, account page, logging and quick capture must work well on mobile. Light/dark mode; dd-mm-yyyy, EUR, m², 24h time.

## Security, privacy & reliability
RLS on all tables; OAuth tokens encrypted server-side; GDPR (lawful basis, opt-out, "forget contact", export); audit log for automations, AI actions and sends; idempotent scheduled jobs with retries; seeded demo data; test mode never sends real email.

## Build plan: phases, confirm with me after each
1. **Foundation:** auth, schema + RLS, left-side menu, **To-dos start page**, accounts list, account page with Office & lease tab and custom fields, contacts, **communication logging** (to-do completion flow, log button, Communication page), next-step enforcement, quick capture (manual), documents upload, CSV import
2. **Follow-up discipline:** waiting-for-reply, lease-date to-dos, email logging address, daily digest, stalled detection, deals with exit criteria
3. **Guidance:** deal health, next best actions, goals → daily targets, weekly review
4. **Email & AI:** templates (NL/EN), Mode A approval queue, sequences, brain-dump parser, meeting prep and debrief
5. **Scale:** automations builder, insights, connected mailbox (Mode B)

**Phase 1 acceptance criteria**
- The app opens on the To-dos page; the menu is on the left
- I can add an account with office location, size and lease end in under 30 seconds, and complete all other office/lease fields later
- Completing a call to-do logs the outcome and note on the account timeline and asks for the next step in one flow
- To-do rows show only the account name and due date; clicking one opens the details and last communication
- The Communication page lists all logged communication across accounts

Start with Phase 1. Before writing code, show me the database schema and the list of screens for confirmation.