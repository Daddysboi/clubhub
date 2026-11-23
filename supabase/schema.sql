-- ============================================================
-- CupShub schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- This file is the migration authority for database-level guarantees:
-- constraints, indexes, RLS policies and Storage policies. Keep the matching
-- Drizzle definitions in lib/db/schema.ts in sync for fresh databases.
-- ============================================================

-- ---------- helper: case-insensitive unique name checks ----------
create extension if not exists "pgcrypto";

-- ---------- tournaments ----------
create table if not exists public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  venue        text,
  start_date   date,
  format       text not null default 'league'
                 check (format in ('league','tri_series','knockout')),
  status       text not null default 'draft'
                 check (status in ('draft','live','done')),
  banner_url   text,
  winner_team_id uuid,
  created_at   timestamptz not null default now()
);

-- ---------- teams ----------
create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  -- Squad identity: distinct colour + crest so one club's teams are tellable apart.
  short_name        text,
  captain_player_id uuid,
  seed          integer,
  color         text not null default '#16a34a',
  primary_color   text not null default '#16a34a',
  secondary_color text not null default '#0f172a',
  logo_url      text,
  created_at    timestamptz not null default now()
);
create index if not exists teams_tournament_idx on public.teams(tournament_id);
create index if not exists teams_captain_idx on public.teams(captain_player_id);

-- Parent club when one club fields several teams in the same competition.
alter table public.tournaments add column if not exists club_name text;

-- Idempotent additions for databases created before captains/identity existed.
alter table public.teams add column if not exists short_name text;
alter table public.teams add column if not exists captain_player_id uuid;
alter table public.teams add column if not exists primary_color text not null default '#16a34a';
alter table public.teams add column if not exists secondary_color text not null default '#0f172a';

-- The captain FK is added at the end of this file, once `players` exists.

-- ---------- players ----------
-- tournament_id NULL = standalone player (no tournament)
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  full_name     text not null,
  nickname      text,
  phone         text,
  position      text not null default 'Midfielder'
                  check (position in ('Goalkeeper','Defender','Midfielder','Forward')),
  photo_url     text,
  created_at    timestamptz not null default now()
);
create index if not exists players_tournament_idx on public.players(tournament_id);

-- duplicate check support: normalised (lower/trim) names
create index if not exists players_full_name_lower_idx
  on public.players (lower(btrim(full_name)));
create index if not exists players_nickname_lower_idx
  on public.players (lower(btrim(nickname)));

-- ---------- matches ----------
create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  round          integer not null default 1,
  stage          text not null default 'group'
                   check (stage in ('group','quarter','semi','final')),
  home_team_id   uuid not null references public.teams(id) on delete cascade,
  away_team_id   uuid not null references public.teams(id) on delete cascade,
  scheduled_at   timestamptz,
  venue          text,
  home_score     integer,
  away_score     integer,
  status         text not null default 'scheduled'
                   check (status in ('scheduled','live','finished')),
  photo_url      text,
  notes          text,
  created_at     timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index if not exists matches_tournament_idx on public.matches(tournament_id);

-- Existing databases predate these columns. Safe to re-run.
do $$
begin
  alter table public.tournaments
    add column format text not null default 'league'
      check (format in ('league','tri_series','knockout'));
exception
  when duplicate_column then null;
end $$;

do $$
begin
  alter table public.matches
    add column stage text not null default 'group'
      check (stage in ('group','quarter','semi','final'));
exception
  when duplicate_column then null;
end $$;

-- Re-assert enum-like constraints on databases created before these values
-- existed. Dropping by name first keeps this script idempotent.
do $$
begin
  alter table public.tournaments drop constraint if exists tournaments_format_check;
  alter table public.tournaments add constraint tournaments_format_check
    check (format in ('league','tri_series','knockout'));

  alter table public.tournaments drop constraint if exists tournaments_status_check;
  alter table public.tournaments add constraint tournaments_status_check
    check (status in ('draft','live','done'));

  alter table public.players drop constraint if exists players_position_check;
  alter table public.players add constraint players_position_check
    check (position in ('Goalkeeper','Defender','Midfielder','Forward'));

  alter table public.matches drop constraint if exists matches_stage_check;
  alter table public.matches add constraint matches_stage_check
    check (stage in ('group','quarter','semi','final'));

  alter table public.matches drop constraint if exists matches_status_check;
  alter table public.matches add constraint matches_status_check
    check (status in ('scheduled','live','finished'));

  alter table public.matches drop constraint if exists matches_round_positive_check;
  alter table public.matches add constraint matches_round_positive_check
    check (round >= 1);

  alter table public.matches drop constraint if exists matches_score_nonnegative_check;
  alter table public.matches add constraint matches_score_nonnegative_check
    check ((home_score is null or home_score >= 0) and (away_score is null or away_score >= 0));

  alter table public.matches drop constraint if exists matches_finished_score_check;
  alter table public.matches add constraint matches_finished_score_check
    check (status <> 'finished' or (home_score is not null and away_score is not null));

  alter table public.match_events drop constraint if exists match_events_type_check;
  alter table public.match_events add constraint match_events_type_check
    check (type in (
      'goal','own_goal','penalty_goal','penalty_miss','yellow_card',
      'second_yellow','red_card','assist','sub_on','sub_off'
    ));

  alter table public.match_events drop constraint if exists match_events_minute_check;
  alter table public.match_events add constraint match_events_minute_check
    check (minute is null or (minute >= 0 and minute <= 130));
exception
  when duplicate_object then null;
end $$;

-- A cup has at most one decider. The application also checks this, but the
-- partial unique index closes simultaneous admin clicks.
create unique index if not exists matches_one_final_per_tournament_idx
  on public.matches (tournament_id)
  where stage = 'final';

-- tournament winner (set after FK exists)
do $$
begin
  alter table public.tournaments
    add constraint tournaments_winner_fk
    foreign key (winner_team_id) references public.teams(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

-- ---------- team membership (player -> team) ----------
create table if not exists public.team_players (
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (team_id, player_id)
);
create index if not exists team_players_player_idx on public.team_players(player_id);

-- ---------- match events: goals, cards, other on-field actions ----------
-- team_id is denormalised on purpose: a player can change teams between
-- matches, but a goal belongs to whichever team he scored for that day.
create table if not exists public.match_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id  uuid references public.players(id) on delete set null,
  team_id    uuid references public.teams(id) on delete set null,
  type       text not null check (type in (
               'goal',
               'own_goal',
               'penalty_goal',
               'penalty_miss',
               'yellow_card',
               'second_yellow',
               'red_card',
               'assist',
               'sub_on',
               'sub_off'
             )),
  minute     integer check (minute is null or (minute >= 0 and minute <= 130)),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists match_events_match_idx on public.match_events(match_id);
create index if not exists match_events_tournament_idx on public.match_events(tournament_id);
create index if not exists match_events_player_idx on public.match_events(player_id);
-- Same minute + same event would otherwise double-count a goal. Multi-goals
-- are allowed when the minutes differ.
create unique index if not exists match_events_dedupe_idx
  on public.match_events (match_id, player_id, type, minute)
  where player_id is not null;

-- A card is binary: one yellow, one second yellow and one red per player per
-- match. The type list keeps multi-goal and substitution events unaffected.
create unique index if not exists match_events_card_dedupe_idx
  on public.match_events (match_id, player_id, type)
  where player_id is not null
    and type in ('yellow_card', 'second_yellow', 'red_card');

-- ---------- tournament memories (documentary photo album) ----------
create table if not exists public.tournament_memories (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id      uuid references public.matches(id) on delete set null,
  url           text not null,
  caption       text,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);
create index if not exists tournament_memories_tournament_idx
  on public.tournament_memories(tournament_id);

-- Anonymous likes. One per photo per browser visitor; clicking again removes it.
create table if not exists public.memory_likes (
  memory_id   uuid not null references public.tournament_memories(id) on delete cascade,
  visitor_id  uuid not null,
  created_at  timestamptz not null default now(),
  primary key (memory_id, visitor_id)
);
create index if not exists memory_likes_memory_idx on public.memory_likes(memory_id);

-- Comments are public, so names and bodies are length-limited in the app.
create table if not exists public.memory_comments (
  id          uuid primary key default gen_random_uuid(),
  memory_id   uuid not null references public.tournament_memories(id) on delete cascade,
  visitor_id  uuid not null,
  author_name text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists memory_comments_memory_idx on public.memory_comments(memory_id);
create index if not exists memory_comments_visitor_idx on public.memory_comments(visitor_id);

-- Public bucket for the album. Uploads go through the server (service role);
-- the bucket only needs to be public so the images can be rendered.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'tournament-memories',
    'tournament-memories',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  -- Do not force the bucket public on every re-run: an operator may have
  -- deliberately tightened it. New installs still need public read so the
  -- gallery can render images directly.
  on conflict (id) do update
    set file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when insufficient_privilege then null;
end $$;

-- ---------- admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public can READ everything.
-- Writes only through server (service key), which bypasses RLS.
-- ============================================================

alter table public.tournaments  enable row level security;
alter table public.teams        enable row level security;
alter table public.players      enable row level security;
alter table public.matches      enable row level security;
alter table public.team_players enable row level security;
alter table public.match_events enable row level security;
alter table public.tournament_memories enable row level security;
alter table public.memory_likes enable row level security;
alter table public.memory_comments enable row level security;
alter table public.admins       enable row level security;

-- Public reads. The app itself reads through a server-side Postgres
-- connection, so nothing needs to be exposed via the Supabase Data API.
-- Phone numbers make `players` unsafe to expose, so it is deliberately NOT
-- granted a public read policy. Engagement rows are write-only from the
-- browser too: public counts/comments are assembled by the server, so there is
-- no reason to let someone enumerate visitor UUIDs through the Data API.
do $$
declare t text;
begin
  foreach t in array array['tournaments','teams','matches','team_players','match_events','tournament_memories'] loop
    execute format('drop policy if exists "public read %1$s" on public.%1$I;', t);
    execute format(
      'create policy "public read %1$s" on public.%1$I for select using (true);', t);
  end loop;
end $$;

drop policy if exists "public read players" on public.players;
drop policy if exists "public read memory_likes" on public.memory_likes;
drop policy if exists "public read memory_comments" on public.memory_comments;

-- The old phone-safe view used security_invoker=on, so it inherited the
-- (correctly absent) players SELECT policy and granted no real access. Drop it
-- rather than leave a misleading object in the schema.
drop view if exists public.public_players;

-- Storage: the album bucket is public for reads, but browser roles must never
-- be able to write into it. Uploads go through a Server Action using the
-- service role, which bypasses these restrictive policies. Restrictive (not
-- permissive) policies are required so another broad INSERT policy cannot
-- accidentally re-open writes.
do $$
begin
  drop policy if exists "block public memory object insert" on storage.objects;
  create policy "block public memory object insert"
    on storage.objects as restrictive for insert to anon, authenticated
    with check (bucket_id <> 'tournament-memories');

  drop policy if exists "block public memory object update" on storage.objects;
  create policy "block public memory object update"
    on storage.objects as restrictive for update to anon, authenticated
    using (bucket_id <> 'tournament-memories')
    with check (bucket_id <> 'tournament-memories');

  drop policy if exists "block public memory object delete" on storage.objects;
  create policy "block public memory object delete"
    on storage.objects as restrictive for delete to anon, authenticated
    using (bucket_id <> 'tournament-memories');
exception
  when undefined_table or insufficient_privilege then null;
end $$;

-- admins table: readable only by signed-in admins
drop policy if exists "admins self read" on public.admins;
create policy "admins self read" on public.admins
  for select using (auth.uid() = user_id);

-- ============================================================
-- Deferred constraints: teams -> players (captain, manager)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teams_captain_player_id_fkey'
  ) then
    alter table public.teams
      add constraint teams_captain_player_id_fkey
      foreign key (captain_player_id) references public.players(id) on delete set null;
  end if;
end $$;

-- Team manager, a role separate from the captain.
alter table public.teams add column if not exists manager_player_id uuid;
create index if not exists teams_manager_idx on public.teams(manager_player_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teams_manager_player_id_fkey'
  ) then
    alter table public.teams
      add constraint teams_manager_player_id_fkey
      foreign key (manager_player_id) references public.players(id) on delete set null;
  end if;
end $$;
