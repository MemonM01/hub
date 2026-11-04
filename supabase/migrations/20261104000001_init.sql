-- hub: initial schema
-- Every table has user_id. RLS: the authenticated user reads and writes only their own rows.
-- anon gets nothing. The service role bypasses RLS and is used only on the server.

create extension if not exists pgcrypto;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Modules ---------------------------------------------------------------
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,                 -- e.g. COMP2860, as Minerva and Panopto use it
  name text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

-- Panopto folders (matched to a module once, then auto-filed) -----------
create table public.panopto_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  panopto_id text not null,
  name text not null,
  module_id uuid references public.modules (id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, panopto_id)
);

-- Assignments -----------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  sheet text not null,                -- '1.2'
  title text,
  is_quiz boolean not null default false,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted', 'graded', 'cancelled')),
  due_at timestamptz,
  external_id text not null,          -- 'task:{moduleId}:sheet 1.2'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  unique (user_id, module_id, sheet)
);

-- Files (bytes live in R2; size is null until bytes exist) --------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  assignment_id uuid references public.assignments (id) on delete set null,
  filename text not null,
  title text,
  mime_type text,
  size_bytes bigint,                  -- null = name only, bytes never arrived
  r2_key text,
  thumbnail_key text,
  source text not null default 'upload' check (source in ('upload', 'minerva')),
  external_id text,                   -- Minerva id so a later run skips it
  kind text check (kind in (
    'lecture_slides', 'lecture_notes', 'coursework', 'worksheet', 'submission_template',
    'lab_sheet', 'solution', 'quiz', 'reading', 'other')),
  week int,
  summary text,
  extracted_text text,
  sort_confidence real,
  sort_status text not null default 'pending'
    check (sort_status in ('pending', 'sorted', 'needs_look', 'failed')),
  pinned boolean not null default false,  -- attached by hand: auto sort never moves it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || filename), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(left(extracted_text, 500000), '')), 'C')
  ) stored,
  unique (user_id, external_id)
);

-- Lectures (Panopto sessions) -------------------------------------------
create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  folder_id uuid references public.panopto_folders (id) on delete set null,
  panopto_session_id text not null,
  title text not null,
  duration_seconds int,
  delivered_at timestamptz,
  viewer_url text,
  thumbnail_url text,
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, title), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(left(transcript, 500000), '')), 'C')
  ) stored,
  unique (user_id, panopto_session_id)
);

-- Watch progress kept apart so a refresh cannot overwrite the lecture ---
create table public.lecture_progress (
  lecture_id uuid primary key references public.lectures (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  percent real not null default 0 check (percent >= 0 and percent <= 100),
  watched boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Timetable (from my own MyTimetable .ics export) -----------------------
create table public.timetable_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  uid text not null,                  -- VEVENT UID
  module_id uuid references public.modules (id) on delete set null,
  module_code text,
  module_name text,
  activity_type text,
  staff text,
  recording_status text,
  location text,
  summary text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, uid)
);

-- Learning profile (one per user) ---------------------------------------
create table public.learning_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

-- Activity log with before/after so one change can be undone ------------
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor text not null,                -- 'me', 'mcp:{client}', 'sync', 'sorter'
  entity text not null,               -- 'learning_profile', ...
  entity_id text,
  action text not null,
  before jsonb,
  after jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bookmarklet sync tokens (hash only) -----------------------------------
create table public.sync_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  prefix text not null,               -- shown in Settings
  token_hash text not null unique,    -- sha256 hex
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- OAuth 2.1 for the MCP connector (hashes only) -------------------------
create table public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- set on first approval
  client_id text not null unique,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table public.oauth_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text,
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  prefix text not null,
  access_hash text not null unique,
  refresh_hash text unique,
  scope text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------
create index on public.modules (user_id);
create index on public.panopto_folders (user_id);
create index on public.panopto_folders (module_id);
create index on public.assignments (user_id);
create index on public.assignments (module_id);
create index on public.files (user_id);
create index on public.files (module_id);
create index on public.files (assignment_id);
create index on public.files using gin (search);
create index on public.lectures (user_id);
create index on public.lectures (module_id);
create index on public.lectures (folder_id);
create index on public.lectures using gin (search);
create index on public.lecture_progress (user_id);
create index on public.timetable_sessions (user_id, starts_at);
create index on public.timetable_sessions (module_id);
create index on public.activity (user_id, created_at desc);
create index on public.sync_tokens (user_id);
create index on public.oauth_clients (user_id);
create index on public.oauth_codes (user_id);
create index on public.oauth_codes (client_id);
create index on public.oauth_tokens (user_id);
create index on public.oauth_tokens (client_id);

-- updated_at triggers ---------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['modules','panopto_folders','assignments','files','lectures',
                           'lecture_progress','timetable_sessions','learning_profiles']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- RLS -------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['modules','panopto_folders','assignments','files','lectures',
                           'lecture_progress','timetable_sessions','learning_profiles',
                           'activity','sync_tokens','oauth_clients','oauth_codes','oauth_tokens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Own rows, full access, for the data tables
do $$
declare t text;
begin
  foreach t in array array['modules','panopto_folders','assignments','files','lectures',
                           'lecture_progress','timetable_sessions','learning_profiles','activity']
  loop
    execute format($p$
      create policy "own rows" on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $p$, t);
  end loop;
end $$;

-- Tokens: I can see and revoke my own; creation and checks happen on the server.
create policy "own tokens read" on public.sync_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own tokens insert" on public.sync_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own tokens revoke" on public.sync_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own clients read" on public.oauth_clients
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own oauth tokens read" on public.oauth_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own oauth tokens revoke" on public.oauth_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- oauth_codes: no authenticated policy; server only.
