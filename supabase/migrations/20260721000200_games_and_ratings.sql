-- Busted Minds Chess: authoritative online game state, matchmaking, and ratings.

create table if not exists public.games (
  id uuid primary key default extensions.gen_random_uuid(),
  share_id uuid not null default extensions.gen_random_uuid() unique,
  variant text not null default 'standard'
    check (variant in ('standard', 'chess960', 'from_position')),
  rules_version varchar(32) not null default 'chess.js-1.4',
  visibility text not null default 'unlisted'
    check (visibility in ('public', 'unlisted', 'private')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'aborted')),
  rated boolean not null default false,
  rating_pool text check (rating_pool in ('bullet', 'blitz', 'rapid', 'classical')),
  matchmaking_source text not null default 'invite'
    check (matchmaking_source in ('invite', 'public', 'tournament', 'rematch', 'admin', 'saved_local')),
  bot_move_policy text not null default 'none'
    check (bot_move_policy in ('none', 'browser_legal', 'deterministic_server')),
  initial_fen text not null default 'start',
  current_fen text not null default 'start',
  pgn text not null default '',
  result text not null default '*' check (result in ('*', '1-0', '0-1', '1/2-1/2')),
  termination text check (termination in (
    'checkmate', 'resignation', 'timeout', 'stalemate', 'repetition',
    'insufficient_material', 'fifty_move', 'agreement', 'abandonment', 'abort', 'admin'
  )),
  active_color text not null default 'white' check (active_color in ('white', 'black')),
  base_time_ms bigint not null default 300000 check (base_time_ms between 0 and 86400000),
  white_time_ms bigint not null default 300000 check (white_time_ms >= 0),
  black_time_ms bigint not null default 300000 check (black_time_ms >= 0),
  increment_ms integer not null default 0 check (increment_ms between 0 and 600000),
  turn_started_at timestamptz,
  first_move_at timestamptz,
  ended_at timestamptz,
  version integer not null default 0 check (version >= 0),
  move_count integer not null default 0 check (move_count >= 0),
  rating_applied_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  rematch_of uuid references public.games(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint games_fen_sizes check (length(initial_fen) between 1 and 256 and length(current_fen) between 1 and 256),
  constraint games_pgn_size check (octet_length(pgn) <= 262144),
  constraint games_metadata_size check (octet_length(metadata::text) <= 16384),
  constraint games_rating_pool check ((rated and rating_pool is not null) or (not rated)),
  constraint games_rated_bot_integrity check (not rated or bot_move_policy <> 'browser_legal'),
  constraint games_result_state check (
    (status in ('pending', 'active') and result = '*' and termination is null and ended_at is null)
    or (status = 'completed' and result <> '*' and termination is not null and ended_at is not null)
    or (status = 'aborted' and result = '*' and termination in ('abort', 'admin') and ended_at is not null)
  ),
  constraint games_turn_clock_state check (
    (status = 'active' and turn_started_at is not null)
    or (status <> 'active')
  )
);

create table if not exists public.challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  share_id uuid not null default extensions.gen_random_uuid() unique,
  challenger_id uuid references auth.users(id) on delete set null,
  challenged_user_id uuid references auth.users(id) on delete set null,
  challenged_house_player_id uuid references public.house_players(id) on delete set null,
  preferred_color text not null default 'random' check (preferred_color in ('white', 'black', 'random')),
  variant text not null default 'standard' check (variant in ('standard', 'chess960', 'from_position')),
  initial_fen text,
  base_time_ms bigint not null check (base_time_ms between 0 and 86400000),
  increment_ms integer not null default 0 check (increment_ms between 0 and 600000),
  rated boolean not null default false,
  visibility text not null default 'private' check (visibility in ('unlisted', 'private')),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled', 'expired')),
  game_id uuid references public.games(id) on delete set null,
  message varchar(180),
  expires_at timestamptz not null default (statement_timestamp() + interval '24 hours'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint challenges_target check (num_nonnulls(challenged_user_id, challenged_house_player_id) <= 1),
  constraint challenges_fen_size check (initial_fen is null or length(initial_fen) between 1 and 256),
  constraint challenges_expiry check (expires_at > created_at),
  constraint challenges_acceptance check ((status = 'accepted' and game_id is not null) or status <> 'accepted')
);

create table if not exists private.game_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid references auth.users(id) on delete set null,
  max_uses smallint not null default 1 check (max_uses between 1 and 100),
  use_count smallint not null default 0 check (use_count between 0 and 100),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint game_invites_target check (num_nonnulls(game_id, challenge_id) = 1),
  constraint game_invites_usage check (use_count <= max_uses),
  constraint game_invites_expiry check (expires_at > created_at)
);

create table if not exists public.game_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  color text not null check (color in ('white', 'black')),
  participant_kind text not null check (participant_kind in ('user', 'house')),
  user_id uuid references auth.users(id) on delete set null,
  house_player_id uuid references public.house_players(id) on delete set null,
  display_name_snapshot varchar(48) not null,
  avatar_url_snapshot text,
  rating_snapshot integer check (rating_snapshot between 0 and 4000),
  joined_at timestamptz not null default statement_timestamp(),
  last_connected_at timestamptz,
  disconnected_at timestamptz,
  is_ready boolean not null default false,
  constraint game_participants_identity_shape check (
    (participant_kind = 'user' and house_player_id is null)
    or (participant_kind = 'house' and user_id is null)
  ),
  constraint game_participants_snapshot_nonempty check (length(btrim(display_name_snapshot)) between 1 and 48),
  constraint game_participants_avatar_size check (avatar_url_snapshot is null or length(avatar_url_snapshot) <= 2048),
  unique (game_id, color)
);

create unique index if not exists game_participants_user_once_idx
  on public.game_participants (game_id, user_id) where user_id is not null;
create unique index if not exists game_participants_house_once_idx
  on public.game_participants (game_id, house_player_id) where house_player_id is not null;
create index if not exists game_participants_user_history_idx
  on public.game_participants (user_id, joined_at desc) where user_id is not null;
create index if not exists game_participants_house_history_idx
  on public.game_participants (house_player_id, joined_at desc) where house_player_id is not null;

create table if not exists public.game_spectator_access (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'allowed' check (permission in ('allowed', 'blocked')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (game_id, user_id)
);

create table if not exists private.game_mutation_requests (
  game_id uuid not null references public.games(id) on delete cascade,
  request_id uuid not null,
  actor_kind text not null check (actor_kind in ('user', 'house', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_house_player_id uuid references public.house_players(id) on delete set null,
  mutation_type text not null check (mutation_type in ('move', 'timeout', 'resign', 'draw', 'abort', 'takeback', 'finalize')),
  expected_version integer not null check (expected_version >= 0),
  request_hash varchar(128) not null,
  response jsonb,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  primary key (game_id, request_id),
  constraint game_mutation_actor_shape check (
    (actor_kind = 'user' and actor_house_player_id is null)
    or (actor_kind = 'house' and actor_user_id is null)
    or (actor_kind = 'system' and actor_user_id is null and actor_house_player_id is null)
  ),
  constraint game_mutation_response_size check (response is null or octet_length(response::text) <= 32768)
);

create table if not exists public.game_moves (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  ply integer not null check (ply >= 1),
  resulting_version integer not null check (resulting_version >= 1),
  request_id uuid not null,
  actor_kind text not null check (actor_kind in ('user', 'house')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_house_player_id uuid references public.house_players(id) on delete set null,
  color text not null check (color in ('white', 'black')),
  uci varchar(5) not null,
  san varchar(32) not null,
  position_key varchar(32),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  clock_after_ms bigint not null check (clock_after_ms >= 0),
  engine_profile varchar(64),
  engine_version varchar(64),
  engine_level smallint check (engine_level is null or engine_level between 1 and 20),
  engine_seed bigint,
  computed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  constraint game_moves_uci_format check (uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  constraint game_moves_actor_shape check (
    (actor_kind = 'user' and actor_house_player_id is null)
    or (actor_kind = 'house' and actor_user_id is null)
  ),
  constraint game_moves_engine_audit check (
    actor_kind = 'user'
    or (engine_profile is not null and engine_version is not null and engine_level is not null and engine_seed is not null)
  ),
  unique (game_id, ply),
  unique (game_id, resulting_version),
  unique (game_id, request_id)
);

create index if not exists game_moves_game_created_idx on public.game_moves (game_id, created_at);
create index if not exists game_moves_actor_user_idx on public.game_moves (actor_user_id, created_at desc)
  where actor_user_id is not null;

create table if not exists public.game_offers (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  offer_type text not null check (offer_type in ('draw', 'takeback', 'rematch', 'abort')),
  offered_by_color text not null check (offered_by_color in ('white', 'black')),
  offered_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  payload jsonb not null default '{}'::jsonb,
  request_id uuid not null,
  expires_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint game_offers_payload_size check (octet_length(payload::text) <= 4096),
  constraint game_offers_resolution check ((status = 'pending' and resolved_at is null) or status <> 'pending'),
  unique (game_id, request_id)
);

create unique index if not exists game_offers_one_pending_idx
  on public.game_offers (game_id, offer_type, offered_by_color) where status = 'pending';
create index if not exists game_offers_game_status_idx on public.game_offers (game_id, status, created_at desc);

create table if not exists public.game_chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  author_kind text not null check (author_kind in ('user', 'house', 'system')),
  author_user_id uuid references auth.users(id) on delete set null,
  author_house_player_id uuid references public.house_players(id) on delete set null,
  author_name_snapshot varchar(48) not null,
  request_id uuid not null,
  body varchar(500) not null,
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default statement_timestamp(),
  edited_at timestamptz,
  constraint game_chat_author_shape check (
    (author_kind = 'user' and author_house_player_id is null)
    or (author_kind = 'house' and author_user_id is null)
    or (author_kind = 'system' and author_user_id is null and author_house_player_id is null)
  ),
  constraint game_chat_body_nonempty check (length(btrim(body)) between 1 and 500),
  unique (game_id, request_id)
);

create index if not exists game_chat_messages_game_idx
  on public.game_chat_messages (game_id, created_at desc) where moderation_state = 'visible';

create table if not exists public.matchmaking_tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'offered', 'matched', 'cancelled', 'expired')),
  variant text not null default 'standard' check (variant in ('standard', 'chess960')),
  rating_pool text not null check (rating_pool in ('bullet', 'blitz', 'rapid', 'classical', 'custom')),
  rated boolean not null default false,
  base_time_ms bigint not null check (base_time_ms between 0 and 86400000),
  increment_ms integer not null default 0 check (increment_ms between 0 and 600000),
  color_preference text not null default 'random' check (color_preference in ('white', 'black', 'random')),
  rating_at_queue integer not null check (rating_at_queue between 0 and 4000),
  rating_range integer not null default 150 check (rating_range between 25 and 2000),
  allow_house_players boolean not null default true,
  matched_game_id uuid references public.games(id) on delete set null,
  matched_house_player_id uuid references public.house_players(id) on delete set null,
  queued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '10 minutes'),
  updated_at timestamptz not null default statement_timestamp(),
  constraint matchmaking_ticket_request_unique unique (user_id, request_id),
  constraint matchmaking_ticket_expiry check (expires_at > queued_at),
  constraint matchmaking_ticket_match_state check (
    (status = 'matched' and matched_game_id is not null) or status <> 'matched'
  )
);

create unique index if not exists matchmaking_one_active_ticket_idx
  on public.matchmaking_tickets (user_id, rating_pool)
  where status in ('queued', 'offered');
create index if not exists matchmaking_queue_search_idx
  on public.matchmaking_tickets (rating_pool, variant, rated, queued_at)
  where status = 'queued';
create index if not exists matchmaking_expiry_idx
  on public.matchmaking_tickets (expires_at) where status in ('queued', 'offered');

create table if not exists public.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('user', 'house')),
  user_id uuid references auth.users(id) on delete cascade,
  house_player_id uuid references public.house_players(id) on delete cascade,
  pool text not null check (pool in ('bullet', 'blitz', 'rapid', 'classical')),
  rating integer not null default 1200 check (rating between 0 and 4000),
  rating_deviation numeric(8,3) not null default 350 check (rating_deviation between 30 and 500),
  volatility numeric(8,6) not null default 0.06 check (volatility between 0.001 and 1),
  provisional boolean not null default true,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  current_streak integer not null default 0,
  peak_rating integer not null default 1200 check (peak_rating between 0 and 4000),
  last_played_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint ratings_owner_shape check (
    (owner_kind = 'user' and user_id is not null and house_player_id is null)
    or (owner_kind = 'house' and house_player_id is not null and user_id is null)
  ),
  constraint ratings_game_totals check (wins + draws + losses = games_played)
);

create unique index if not exists ratings_user_pool_unique_idx
  on public.ratings (user_id, pool) where user_id is not null;
create unique index if not exists ratings_house_pool_unique_idx
  on public.ratings (house_player_id, pool) where house_player_id is not null;
create index if not exists ratings_leaderboard_idx
  on public.ratings (pool, rating desc, games_played desc) where not provisional;

create table if not exists public.rating_events (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  owner_kind text not null check (owner_kind in ('user', 'house')),
  user_id uuid references auth.users(id) on delete set null,
  house_player_id uuid references public.house_players(id) on delete set null,
  owner_name_snapshot varchar(48) not null,
  pool text not null check (pool in ('bullet', 'blitz', 'rapid', 'classical')),
  rating_before integer not null check (rating_before between 0 and 4000),
  rating_after integer not null check (rating_after between 0 and 4000),
  rating_change integer not null,
  opponent_rating integer not null check (opponent_rating between 0 and 4000),
  score numeric(2,1) not null check (score in (0, 0.5, 1)),
  algorithm varchar(32) not null,
  provisional_before boolean not null,
  provisional_after boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint rating_events_change check (rating_after - rating_before = rating_change),
  constraint rating_events_owner_shape check (
    (owner_kind = 'user' and house_player_id is null)
    or (owner_kind = 'house' and user_id is null)
  )
);

create unique index if not exists rating_events_game_user_unique_idx
  on public.rating_events (game_id, user_id, pool) where user_id is not null;
create unique index if not exists rating_events_game_house_unique_idx
  on public.rating_events (game_id, house_player_id, pool) where house_player_id is not null;
create index if not exists rating_events_user_history_idx
  on public.rating_events (user_id, created_at desc) where user_id is not null;

create table if not exists public.seasons (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name varchar(80) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint seasons_time_range check (ends_at > starts_at),
  constraint seasons_rules_size check (octet_length(rules::text) <= 8192)
);

create table if not exists public.season_standings (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  pool text not null check (pool in ('bullet', 'blitz', 'rapid', 'classical', 'overall')),
  owner_kind text not null check (owner_kind in ('user', 'house')),
  user_id uuid references auth.users(id) on delete set null,
  house_player_id uuid references public.house_players(id) on delete set null,
  owner_name_snapshot varchar(48) not null,
  points integer not null default 0,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  rank integer check (rank is null or rank > 0),
  updated_at timestamptz not null default statement_timestamp(),
  constraint season_standings_owner_shape check (
    (owner_kind = 'user' and house_player_id is null)
    or (owner_kind = 'house' and user_id is null)
  )
);

create unique index if not exists season_standings_user_unique_idx
  on public.season_standings (season_id, pool, user_id) where user_id is not null;
create unique index if not exists season_standings_house_unique_idx
  on public.season_standings (season_id, pool, house_player_id) where house_player_id is not null;

create index if not exists games_status_created_idx on public.games (status, created_at desc);
create index if not exists games_public_archive_idx on public.games (ended_at desc)
  where visibility = 'public' and status = 'completed';
create index if not exists games_created_by_idx on public.games (created_by, created_at desc)
  where created_by is not null;
create index if not exists games_rematch_idx on public.games (rematch_of) where rematch_of is not null;
create index if not exists challenges_challenger_idx on public.challenges (challenger_id, created_at desc);
create index if not exists challenges_target_idx on public.challenges (challenged_user_id, status, created_at desc)
  where challenged_user_id is not null;
create index if not exists challenges_expiry_idx on public.challenges (expires_at) where status = 'open';
create index if not exists game_invites_expiry_idx on private.game_invites (expires_at)
  where revoked_at is null;
create index if not exists game_mutation_requests_created_idx
  on private.game_mutation_requests (created_at);
create index if not exists season_standings_rank_idx
  on public.season_standings (season_id, pool, rank, points desc);

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at before update on public.games
for each row execute function private.set_updated_at();

drop trigger if exists challenges_set_updated_at on public.challenges;
create trigger challenges_set_updated_at before update on public.challenges
for each row execute function private.set_updated_at();

drop trigger if exists matchmaking_tickets_set_updated_at on public.matchmaking_tickets;
create trigger matchmaking_tickets_set_updated_at before update on public.matchmaking_tickets
for each row execute function private.set_updated_at();

drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at before update on public.ratings
for each row execute function private.set_updated_at();

drop trigger if exists season_standings_set_updated_at on public.season_standings;
create trigger season_standings_set_updated_at before update on public.season_standings
for each row execute function private.set_updated_at();

alter table public.games enable row level security;
alter table public.challenges enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_spectator_access enable row level security;
alter table public.game_moves enable row level security;
alter table public.game_offers enable row level security;
alter table public.game_chat_messages enable row level security;
alter table public.matchmaking_tickets enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_events enable row level security;
alter table public.seasons enable row level security;
alter table public.season_standings enable row level security;
alter table private.game_invites enable row level security;
alter table private.game_mutation_requests enable row level security;
