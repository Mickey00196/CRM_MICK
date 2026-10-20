// Append-only. Never edit a migration that has shipped; add a new one.

const updatedAtTrigger = (table: string) => `
  create trigger ${table}_updated_at before update on ${table}
  for each row execute function set_updated_at();`;

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_phase1_schema",
    sql: `
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table meta (
  key text primary key,
  value text not null
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_uniq on users (lower(email));

create table accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  domain text,
  website text not null default '',
  industry text not null default '',
  size_band text,
  status text not null default 'lead'
    check (status in ('lead', 'prospect', 'client', 'former_client', 'not_a_fit')),
  icp_fit text check (icp_fit in ('high', 'medium', 'low')),
  lead_source text not null default '',
  language text not null default 'nl' check (language in ('nl', 'en')),
  tags text[] not null default '{}',
  notes text not null default '',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index accounts_domain_uniq on accounts (owner_id, lower(domain))
  where domain is not null and archived_at is null;
create index accounts_owner_idx on accounts (owner_id) where archived_at is null;

create table office_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  is_primary boolean not null default false,
  is_current boolean not null default true,
  -- location
  building_name text not null default '',
  address text not null default '',
  postcode text not null default '',
  city text not null default '',
  submarket text not null default '',
  floors text not null default '',
  -- space
  area_m2 integer,
  workstations integer,
  headcount integer,
  meeting_rooms integer,
  parking_spaces integer,
  hybrid_policy text not null default '',
  fit_out_condition text not null default '',
  -- lease
  tenure text check (tenure in ('lease', 'flex', 'sublease', 'owned')),
  landlord text not null default '',
  landlord_agent text not null default '',
  lease_start date,
  lease_end date,
  initial_term_months integer,
  renewal_options text not null default '',
  notice_months integer,
  break_dates date[] not null default '{}',
  sublet_allowed boolean,
  -- financials
  rent_per_m2 numeric(10, 2),
  annual_rent numeric(14, 2),
  service_charges numeric(14, 2),
  parking_rent numeric(14, 2),
  indexation text not null default '',
  rent_free_months numeric(5, 1),
  fitout_contribution numeric(14, 2),
  guarantee text not null default '',
  -- situation
  satisfaction smallint check (satisfaction between 1 and 5),
  pain_points text not null default '',
  growth_outlook text check (growth_outlook in ('grow', 'stable', 'shrink', 'unknown')),
  re_decision_maker text not null default '',
  notes text not null default '',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index office_one_primary on office_locations (account_id)
  where is_primary and archived_at is null;
create index office_account_idx on office_locations (account_id);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  name text not null,
  role text not null default '',
  buying_role text check (buying_role in ('decision_maker', 'champion', 'influencer', 'user', 'gatekeeper')),
  email text not null default '',
  phone text not null default '',
  linkedin_url text not null default '',
  language text check (language in ('nl', 'en')),
  do_not_contact boolean not null default false,
  opt_out_at timestamptz,
  lawful_basis text check (lawful_basis in ('legitimate_interest', 'consent', 'contract')),
  notes text not null default '',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index contacts_account_idx on contacts (account_id);
create index contacts_owner_idx on contacts (owner_id) where archived_at is null;

create table deals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  pipeline text not null default 'default',
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost', 'nurture')),
  value_eur numeric(14, 2),
  probability smallint check (probability between 0 and 100),
  expected_close_date date,
  close_date_slip_count integer not null default 0,
  lost_reason text not null default '',
  won_at timestamptz,
  primary_contact_id uuid references contacts(id) on delete set null,
  req_m2_min integer,
  req_m2_max integer,
  req_workstations integer,
  preferred_locations text not null default '',
  target_move_in date,
  budget text not null default '',
  must_haves text not null default '',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index deals_account_idx on deals (account_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  title text not null,
  type text not null default 'todo'
    check (type in ('call', 'email', 'linkedin', 'meeting', 'viewing', 'todo')),
  due_date date,
  due_time time,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  status text not null default 'open' check (status in ('open', 'done', 'snoozed')),
  snoozed_until date,
  recurrence_rule text,
  account_id uuid references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete cascade,
  created_by text not null default 'me'
    check (created_by in ('me', 'automation', 'sequence', 'playbook', 'recommendation')),
  completed_at timestamptz,
  completion_activity_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index tasks_open_idx on tasks (owner_id, due_date) where status = 'open' and archived_at is null;
create index tasks_account_idx on tasks (account_id) where status = 'open' and archived_at is null;

create table activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  channel text not null
    check (channel in ('call', 'email', 'linkedin', 'meeting', 'viewing', 'whatsapp', 'note', 'other')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  outcome text,
  summary text not null default '',
  occurred_at timestamptz not null default now(),
  expect_reply boolean not null default false,
  reply_due_at timestamptz,
  replied_at timestamptz,
  source text not null default 'manual'
    check (source in ('manual', 'todo', 'quick_capture', 'logging_address', 'mailbox_sync', 'sequence', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index activities_account_idx on activities (account_id, occurred_at desc) where archived_at is null;
create index activities_owner_idx on activities (owner_id, occurred_at desc) where archived_at is null;
create index activities_contact_idx on activities (contact_id) where archived_at is null;

alter table tasks add constraint tasks_completion_activity_fk
  foreign key (completion_activity_id) references activities(id) on delete set null;

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  office_location_id uuid references office_locations(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  type text not null default 'other'
    check (type in ('lease', 'floor_plan', 'brochure', 'proposal', 'other')),
  file_name text not null,
  storage_key text not null,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  entity text not null check (entity in ('account', 'contact', 'deal', 'office_location')),
  key text not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'choice')),
  options jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (owner_id, entity, key)
);

${["users", "accounts", "office_locations", "contacts", "deals", "tasks", "activities", "documents", "custom_field_definitions"]
  .map(updatedAtTrigger)
  .join("\n")}
`,
  },
];
