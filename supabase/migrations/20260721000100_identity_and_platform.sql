-- Busted Minds Chess: identity, protected roles, house players, and platform controls.
-- This migration is additive and safe to rerun against a partially initialized project.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- New functions must never become implicitly callable through PostgREST.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext not null unique,
  display_name varchar(48) not null,
  avatar_url text,
  country_code varchar(2),
  bio varchar(280),
  account_kind text not null default 'guest'
    check (account_kind in ('guest', 'permanent')),
  status text not null default 'active'
    check (status in ('active', 'deactivated')),
  is_public boolean not null default true,
  locale varchar(12) not null default 'en',
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  current_win_streak integer not null default 0 check (current_win_streak >= 0),
  best_win_streak integer not null default 0 check (best_win_streak >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz,
  constraint profiles_username_format check (username::text ~ '^[a-zA-Z0-9_]{3,24}$'),
  constraint profiles_display_name_nonempty check (length(btrim(display_name)) between 1 and 48),
  constraint profiles_country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint profiles_avatar_url_length check (avatar_url is null or length(avatar_url) <= 2048)
);

create table if not exists public.profile_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  board_theme varchar(32) not null default 'midnight',
  piece_set varchar(32) not null default 'staunty',
  sound_enabled boolean not null default true,
  coordinates_enabled boolean not null default true,
  move_confirmation boolean not null default false,
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  color_blind_mode text not null default 'none'
    check (color_blind_mode in ('none', 'deuteranopia', 'protanopia', 'tritanopia')),
  low_bandwidth boolean not null default false,
  zen_mode boolean not null default false,
  default_time_control varchar(32) not null default '5+0',
  notification_settings jsonb not null default '{"challenges":true,"messages":true,"tournaments":true}'::jsonb,
  accessibility_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default statement_timestamp(),
  constraint profile_preferences_json_sizes check (
    octet_length(notification_settings::text) <= 4096
    and octet_length(accessibility_settings::text) <= 4096
  )
);

create table if not exists public.house_players (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  display_name varchar(48) not null,
  avatar_path text not null,
  country_code varchar(2),
  bio varchar(280) not null,
  public_label varchar(32) not null default 'House Player',
  estimated_rating integer not null check (estimated_rating between 400 and 3000),
  preferred_openings jsonb not null default '[]'::jsonb,
  playing_style jsonb not null default '{}'::jsonb,
  safe_messages text[] not null default array['Good game', 'Well played', 'Thanks for the game'],
  is_enabled boolean not null default true,
  is_listed boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint house_players_slug_format check (slug::text ~ '^[a-z0-9-]{3,32}$'),
  constraint house_players_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint house_players_public_label check (public_label in ('House Player', 'Computer')),
  constraint house_players_json_sizes check (
    octet_length(preferred_openings::text) <= 8192
    and octet_length(playing_style::text) <= 8192
  ),
  constraint house_players_message_count check (cardinality(safe_messages) between 1 and 12)
);

create table if not exists private.house_player_configs (
  house_player_id uuid primary key references public.house_players(id) on delete cascade,
  engine_profile varchar(64) not null,
  engine_version varchar(64) not null,
  difficulty smallint not null check (difficulty between 1 and 20),
  min_think_ms integer not null default 250 check (min_think_ms between 0 and 60000),
  max_think_ms integer not null default 2500 check (max_think_ms between 50 and 120000),
  mistake_frequency numeric(5,4) not null default 0.05 check (mistake_frequency between 0 and 1),
  risk_level numeric(5,4) not null default 0.5 check (risk_level between 0 and 1),
  tactical_tendency numeric(5,4) not null default 0.5 check (tactical_tendency between 0 and 1),
  positional_tendency numeric(5,4) not null default 0.5 check (positional_tendency between 0 and 1),
  time_management text not null default 'balanced'
    check (time_management in ('fast', 'balanced', 'deliberate', 'time-pressure')),
  availability jsonb not null default '{"timezone":"UTC","windows":[{"days":[0,1,2,3,4,5,6],"start":"00:00","end":"23:59"}]}'::jsonb,
  opening_weights jsonb not null default '{}'::jsonb,
  allow_matchmaking boolean not null default true,
  allow_tournaments boolean not null default true,
  allow_rated boolean not null default false,
  rating_mode text not null default 'fixed' check (rating_mode in ('fixed', 'dynamic')),
  deterministic_seed bigint not null,
  paused_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint house_player_config_think_range check (max_think_ms >= min_think_ms),
  constraint house_player_config_json_sizes check (
    octet_length(availability::text) <= 8192
    and octet_length(opening_weights::text) <= 8192
  )
);

create table if not exists private.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator', 'support')),
  granted_at timestamptz not null default statement_timestamp(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

create table if not exists private.user_sanctions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sanction_type text not null check (sanction_type in ('warning', 'chat_mute', 'matchmaking_ban', 'account_ban')),
  reason varchar(500) not null,
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  constraint user_sanctions_time_range check (ends_at is null or ends_at > starts_at)
);

create table if not exists private.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'system' check (actor_kind in ('user', 'moderator', 'admin', 'service', 'system')),
  action varchar(96) not null,
  target_type varchar(64),
  target_id text,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint audit_log_metadata_size check (octet_length(metadata::text) <= 32768)
);

create table if not exists private.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint rate_limit_bucket_key_size check (length(bucket_key) between 8 and 256)
);

create table if not exists private.idempotency_keys (
  scope varchar(64) not null,
  actor_key varchar(96) not null,
  request_id uuid not null,
  request_hash varchar(128) not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  response_code integer,
  response_body jsonb,
  resource_type varchar(64),
  resource_id text,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '24 hours'),
  primary key (scope, actor_key, request_id),
  constraint idempotency_response_size check (response_body is null or octet_length(response_body::text) <= 65536),
  constraint idempotency_expiry check (expires_at > created_at)
);

create table if not exists public.feature_flags (
  key extensions.citext primary key,
  description varchar(280) not null,
  enabled boolean not null default false,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  minimum_population integer not null default 0 check (minimum_population >= 0),
  public_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default statement_timestamp(),
  constraint feature_flags_key_format check (key::text ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  constraint feature_flags_config_size check (octet_length(public_config::text) <= 8192)
);

create table if not exists public.announcements (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  title varchar(120) not null,
  body varchar(1000) not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'maintenance')),
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint announcements_time_range check (ends_at is null or ends_at > starts_at)
);

create table if not exists private.matchmaking_rules (
  pool text primary key check (pool in ('bullet', 'blitz', 'rapid', 'classical', 'custom')),
  bot_fallback_enabled boolean not null default true,
  fallback_wait_seconds smallint not null default 8 check (fallback_wait_seconds between 0 and 300),
  initial_rating_range integer not null default 150 check (initial_rating_range between 25 and 1000),
  rating_range_growth_per_second numeric(8,2) not null default 20 check (rating_range_growth_per_second >= 0),
  max_rating_range integer not null default 600 check (max_rating_range between 50 and 2000),
  casual_bots_enabled boolean not null default true,
  rated_bots_enabled boolean not null default false,
  tournament_bots_enabled boolean not null default true,
  max_bot_game_ratio numeric(5,4) not null default 0.8 check (max_bot_game_ratio between 0 and 1),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc) where status = 'active';
create index if not exists house_players_matchmaking_idx on public.house_players (estimated_rating, id) where is_enabled;
create index if not exists user_sanctions_active_idx on private.user_sanctions (user_id, sanction_type, ends_at)
  where revoked_at is null;
create index if not exists audit_log_target_idx on private.audit_log (target_type, target_id, created_at desc);
create index if not exists audit_log_actor_idx on private.audit_log (actor_user_id, created_at desc);
create index if not exists idempotency_expiry_idx on private.idempotency_keys (expires_at);
create index if not exists announcements_active_idx on public.announcements (starts_at, ends_at) where is_published;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists profile_preferences_set_updated_at on public.profile_preferences;
create trigger profile_preferences_set_updated_at before update on public.profile_preferences
for each row execute function private.set_updated_at();

drop trigger if exists house_players_set_updated_at on public.house_players;
create trigger house_players_set_updated_at before update on public.house_players
for each row execute function private.set_updated_at();

drop trigger if exists house_player_configs_set_updated_at on private.house_player_configs;
create trigger house_player_configs_set_updated_at before update on private.house_player_configs
for each row execute function private.set_updated_at();

drop trigger if exists rate_limit_buckets_set_updated_at on private.rate_limit_buckets;
create trigger rate_limit_buckets_set_updated_at before update on private.rate_limit_buckets
for each row execute function private.set_updated_at();

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at before update on public.feature_flags
for each row execute function private.set_updated_at();

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at before update on public.announcements
for each row execute function private.set_updated_at();

drop trigger if exists matchmaking_rules_set_updated_at on private.matchmaking_rules;
create trigger matchmaking_rules_set_updated_at before update on private.matchmaking_rules
for each row execute function private.set_updated_at();

create or replace function private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_anonymous boolean := coalesce(new.is_anonymous, false);
  v_name text;
begin
  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'user_name',
    ''
  )), '');

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    account_kind,
    last_seen_at
  ) values (
    new.id,
    ('player_' || left(pg_catalog.md5(new.id::text), 17))::extensions.citext,
    left(coalesce(v_name, case when v_is_anonymous then 'Guest Player' else 'New Player' end), 48),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), 2048), ''),
    case when v_is_anonymous then 'guest' else 'permanent' end,
    statement_timestamp()
  )
  on conflict (id) do update
    set display_name = case
          when public.profiles.display_name in ('Guest Player', 'New Player') and v_name is not null
            then left(v_name, 48)
          else public.profiles.display_name
        end,
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        account_kind = excluded.account_kind,
        updated_at = statement_timestamp();

  insert into public.profile_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
revoke all on function private.sync_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile
after insert or update of is_anonymous, raw_user_meta_data on auth.users
for each row execute function private.sync_auth_user_profile();

-- Backfill profiles without changing any existing profile-owned fields.
insert into public.profiles (id, username, display_name, avatar_url, account_kind)
select
  u.id,
  ('player_' || left(pg_catalog.md5(u.id::text), 17))::extensions.citext,
  left(coalesce(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
    case when coalesce(u.is_anonymous, false) then 'Guest Player' else 'New Player' end), 48),
  nullif(left(coalesce(u.raw_user_meta_data ->> 'avatar_url', ''), 2048), ''),
  case when coalesce(u.is_anonymous, false) then 'guest' else 'permanent' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.profile_preferences (user_id)
select p.id from public.profiles p
where not exists (select 1 from public.profile_preferences pp where pp.user_id = p.id);

alter table public.profiles enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.house_players enable row level security;
alter table public.feature_flags enable row level security;
alter table public.announcements enable row level security;
alter table private.house_player_configs enable row level security;
alter table private.user_roles enable row level security;
alter table private.user_sanctions enable row level security;
alter table private.audit_log enable row level security;
alter table private.rate_limit_buckets enable row level security;
alter table private.idempotency_keys enable row level security;
alter table private.matchmaking_rules enable row level security;
