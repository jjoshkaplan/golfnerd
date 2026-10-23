-- golfnerds: initial schema
-- Run in the Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  handedness text not null default 'right' check (handedness in ('right', 'left')),
  units text not null default 'yards' check (units in ('yards', 'meters')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Clubs: the user's bag. A session is hit with one club.
-- ---------------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('driver', 'wood', 'hybrid', 'iron', 'wedge', 'putter')),
  name text not null,                 -- "R9", "Qi4D Max 10.5", "7 iron"
  loft_deg numeric(4, 1),
  shaft text,                         -- "Fujikura Speeder NX Red 50"
  length_in numeric(4, 2),
  settings text,                      -- "FCT NU, 16g heel"
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
create index clubs_user_idx on public.clubs (user_id);

-- ---------------------------------------------------------------------------
-- Sessions: one upload, one club, one date
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete set null,
  played_at timestamptz not null,
  device text not null,               -- 'uneekor', 'trackman', 'gcquad', 'skytrak', 'rapsodo', 'garmin', 'bushnell', 'other'
  source text not null default 'csv' check (source in ('csv', 'screenshot', 'manual')),
  venue text,
  notes text,                         -- "after 9 sim holes", "messing with tee height early"
  shot_count int not null default 0,
  created_at timestamptz not null default now()
);
create index sessions_user_date_idx on public.sessions (user_id, played_at desc);

-- ---------------------------------------------------------------------------
-- Shots: the common 18-field schema plus the raw imported row
-- Units: yards, mph, degrees, rpm, mm, seconds. Sign conventions:
--   offline_yd  + right, - left (from the golfer's view)
--   side_rpm    + fade (slice) spin, - draw (hook) spin
--   path_deg    + in-to-out, - out-to-in
--   face_to_target_deg  + open (right of target), - closed
--   vert_strike_mm      + above center, - below
--   horiz_strike_mm     sign as reported by the device (toe/heel convention varies)
-- ---------------------------------------------------------------------------
create table public.shots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  shot_no int not null,
  -- ball
  ball_speed_mph numeric(5, 1),
  launch_deg numeric(4, 1),
  back_rpm int,
  side_rpm int,
  side_deg numeric(4, 1),
  -- flight
  carry_yd numeric(5, 1) not null,
  total_yd numeric(5, 1),
  offline_yd numeric(5, 1),
  apex_yd numeric(4, 1),
  flight_s numeric(4, 1),
  descent_deg numeric(4, 1),
  -- club
  club_speed_mph numeric(5, 1),
  smash numeric(4, 2),
  path_deg numeric(4, 1),
  face_to_target_deg numeric(4, 1),
  attack_deg numeric(4, 1),
  dyn_loft_deg numeric(4, 1),
  vert_strike_mm int,
  horiz_strike_mm int,
  -- bookkeeping
  excluded boolean not null default false,   -- user removed from averages (mishit, wrong club)
  raw jsonb,                                  -- the original row as imported
  created_at timestamptz not null default now(),
  unique (session_id, shot_no)
);
create index shots_session_idx on public.shots (session_id, shot_no);
create index shots_user_idx on public.shots (user_id);

-- Derived: face to path, in degrees (+ open to path)
create or replace function public.face_to_path(s public.shots)
returns numeric language sql immutable as $$
  select s.face_to_target_deg - s.path_deg
$$;

-- ---------------------------------------------------------------------------
-- Stretches: a tagged shot range inside a session, with the swing cue that
-- produced it. This is the unit of comparison ("14-21, higher tee, 85% swing").
-- ---------------------------------------------------------------------------
create table public.stretches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,                -- "Best stretch", "Before 7 iron break"
  cue text,                           -- "low takeaway", "trail shoulder drop", "tee higher, swing 85%"
  from_shot int not null,
  to_shot int not null,
  is_best boolean not null default false,
  created_at timestamptz not null default now(),
  check (to_shot >= from_shot)
);
create index stretches_session_idx on public.stretches (session_id);

-- ---------------------------------------------------------------------------
-- Imports: the uploaded file or screenshot behind a session, for re-parsing
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,         -- path in the 'imports' storage bucket
  kind text not null check (kind in ('csv', 'image')),
  device text,
  status text not null default 'pending' check (status in ('pending', 'parsed', 'reviewed', 'failed')),
  parse_log jsonb,
  created_at timestamptz not null default now()
);
create index imports_user_idx on public.imports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Session summary view: the numbers the app shows on cards and in trends
-- ---------------------------------------------------------------------------
create or replace view public.session_summary as
select
  s.id as session_id,
  s.user_id,
  s.played_at,
  s.device,
  s.club_id,
  c.name as club_name,
  count(*) filter (where not sh.excluded) as shots,
  round(avg(sh.carry_yd) filter (where not sh.excluded), 1) as carry_yd,
  round(avg(sh.total_yd) filter (where not sh.excluded), 1) as total_yd,
  round(avg(abs(sh.offline_yd)) filter (where not sh.excluded), 1) as miss_yd,
  round(avg(sh.offline_yd) filter (where not sh.excluded), 1) as offline_yd,
  round(avg(sh.ball_speed_mph) filter (where not sh.excluded), 1) as ball_speed_mph,
  round(avg(sh.club_speed_mph) filter (where not sh.excluded), 1) as club_speed_mph,
  round(avg(sh.smash) filter (where not sh.excluded), 3) as smash,
  round(avg(sh.back_rpm) filter (where not sh.excluded)) as back_rpm,
  round(avg(sh.launch_deg) filter (where not sh.excluded), 1) as launch_deg,
  round(avg(sh.path_deg) filter (where not sh.excluded), 1) as path_deg,
  round(avg(sh.face_to_target_deg - sh.path_deg) filter (where not sh.excluded), 1) as face_to_path_deg,
  round(avg(sh.attack_deg) filter (where not sh.excluded), 1) as attack_deg,
  round(avg(sh.vert_strike_mm) filter (where not sh.excluded), 1) as vert_strike_mm
from public.sessions s
join public.shots sh on sh.session_id = s.id
left join public.clubs c on c.id = s.club_id
group by s.id, s.user_id, s.played_at, s.device, s.club_id, c.name;

-- ---------------------------------------------------------------------------
-- Row level security: every user sees only their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.sessions enable row level security;
alter table public.shots enable row level security;
alter table public.stretches enable row level security;
alter table public.imports enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own clubs" on public.clubs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own shots" on public.shots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own stretches" on public.stretches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own imports" on public.imports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for uploads (private; access via signed URLs)
insert into storage.buckets (id, name, public) values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "own import files" on storage.objects
  for all using (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);
