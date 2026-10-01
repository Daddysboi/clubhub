-- ============================================================
-- CupShub schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
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
-- one player cannot record the same event type twice in one match (multi-goals allowed)
create unique index if not exists match_events_dedupe_idx
  on public.match_events (match_id, player_id, type, minute)
  where player_id is not null;

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
alter table public.admins       enable row level security;

-- Public reads. The app itself reads through a server-side Postgres
-- connection, so nothing needs to be exposed via the Supabase Data API.
-- Phone numbers make `players` unsafe to expose, so it is deliberately NOT
-- granted a public read policy: the UI gets names through the server only.
do $$
declare t text;
begin
  foreach t in array array['tournaments','teams','matches','team_players','match_events'] loop
    execute format('drop policy if exists "public read %1$s" on public.%1$I;', t);
    execute format(
      'create policy "public read %1$s" on public.%1$I for select using (true);', t);
  end loop;
end $$;

drop policy if exists "public read players" on public.players;
-- Phone-safe view for anyone who genuinely needs Data API access.
drop view if exists public.public_players;
create view public.public_players with (security_invoker = on) as
  select id, tournament_id, full_name, nickname, position, photo_url, created_at
  from public.players;

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
