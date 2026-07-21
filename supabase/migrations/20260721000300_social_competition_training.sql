-- Busted Minds Chess: social graph, clubs, tournaments, training, progression, and moderation.

create table if not exists public.friendships (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default statement_timestamp(),
  responded_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_unique_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id, status, updated_at desc);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status, updated_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  reason varchar(160),
  created_at timestamptz not null default statement_timestamp(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);

create table if not exists public.user_mutes (
  muter_id uuid not null references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  primary key (muter_id, muted_id),
  constraint user_mutes_not_self check (muter_id <> muted_id),
  constraint user_mutes_expiry check (expires_at is null or expires_at > created_at)
);

create table if not exists public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_type text not null default 'direct' check (conversation_type in ('direct', 'group')),
  direct_key varchar(73) unique,
  title varchar(80),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  last_message_at timestamptz,
  constraint conversations_direct_shape check (
    (conversation_type = 'direct' and direct_key is not null and title is null)
    or (conversation_type = 'group' and direct_key is null and title is not null)
  )
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'member')),
  joined_at timestamptz not null default statement_timestamp(),
  last_read_at timestamptz,
  muted_until timestamptz,
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id, joined_at desc) where left_at is null;

create table if not exists public.direct_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name_snapshot varchar(48) not null,
  body varchar(2000) not null,
  reply_to_id uuid references public.direct_messages(id) on delete set null,
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default statement_timestamp(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint direct_messages_body_nonempty check (length(btrim(body)) between 1 and 2000)
);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at desc);
create index if not exists direct_messages_author_idx
  on public.direct_messages (author_id, created_at desc) where author_id is not null;

create table if not exists public.clubs (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name varchar(80) not null,
  description varchar(1000) not null default '',
  avatar_url text,
  owner_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  join_policy text not null default 'open' check (join_policy in ('open', 'approval', 'invite')),
  member_count integer not null default 0 check (member_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint clubs_slug_format check (slug::text ~ '^[a-z0-9-]{3,48}$'),
  constraint clubs_avatar_size check (avatar_url is null or length(avatar_url) <= 2048)
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('invited', 'requested', 'active', 'left', 'removed')),
  joined_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id, status, updated_at desc);
create index if not exists club_members_active_idx on public.club_members (club_id, joined_at) where status = 'active';

create table if not exists public.club_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name_snapshot varchar(48) not null,
  body varchar(1000) not null,
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default statement_timestamp(),
  constraint club_messages_body_nonempty check (length(btrim(body)) between 1 and 1000)
);

create index if not exists club_messages_club_idx
  on public.club_messages (club_id, created_at desc) where moderation_state = 'visible';

create table if not exists public.activity_feed_items (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_kind text not null check (actor_kind in ('user', 'house', 'system', 'club')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_house_player_id uuid references public.house_players(id) on delete set null,
  actor_club_id uuid references public.clubs(id) on delete set null,
  actor_name_snapshot varchar(80) not null,
  activity_type varchar(64) not null,
  entity_type varchar(48),
  entity_id text,
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'club', 'private')),
  club_id uuid references public.clubs(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  curated boolean not null default false,
  published_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz,
  constraint activity_feed_actor_shape check (
    (actor_kind = 'user' and actor_house_player_id is null and actor_club_id is null)
    or (actor_kind = 'house' and actor_user_id is null and actor_club_id is null)
    or (actor_kind = 'club' and actor_user_id is null and actor_house_player_id is null)
    or (actor_kind = 'system' and actor_user_id is null and actor_house_player_id is null and actor_club_id is null)
  ),
  constraint activity_feed_payload_size check (octet_length(payload::text) <= 16384)
);

create index if not exists activity_feed_public_idx
  on public.activity_feed_items (published_at desc) where visibility = 'public';
create index if not exists activity_feed_user_idx
  on public.activity_feed_items (actor_user_id, published_at desc) where actor_user_id is not null;
create index if not exists activity_feed_club_idx
  on public.activity_feed_items (club_id, published_at desc) where club_id is not null;

create table if not exists public.game_reactions (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('brilliant', 'wow', 'gg', 'heart', 'fire')),
  created_at timestamptz not null default statement_timestamp(),
  primary key (game_id, user_id, reaction)
);

create table if not exists public.game_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, game_id)
);

create index if not exists game_favorites_user_idx on public.game_favorites (user_id, created_at desc);

create table if not exists public.game_collections (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name varchar(80) not null,
  description varchar(500) not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists game_collections_owner_idx on public.game_collections (owner_id, updated_at desc);

create table if not exists public.game_collection_items (
  collection_id uuid not null references public.game_collections(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  note varchar(500),
  position integer not null default 0 check (position >= 0),
  added_at timestamptz not null default statement_timestamp(),
  primary key (collection_id, game_id)
);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type varchar(64) not null,
  title varchar(120) not null,
  body varchar(500) not null,
  entity_type varchar(48),
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz,
  constraint notifications_payload_size check (octet_length(payload::text) <= 8192)
);

create index if not exists notifications_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

create table if not exists public.user_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('user', 'game', 'game_message', 'direct_message', 'club_message')),
  target_id text not null,
  category text not null check (category in ('harassment', 'spam', 'cheating', 'inappropriate_content', 'impersonation', 'other')),
  description varchar(2000) not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  priority smallint not null default 0 check (priority between 0 and 3),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution varchar(1000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz
);

create index if not exists user_reports_queue_idx on public.user_reports (status, priority desc, created_at);
create index if not exists user_reports_reporter_idx on public.user_reports (reporter_id, created_at desc)
  where reporter_id is not null;
create unique index if not exists user_reports_duplicate_open_idx
  on public.user_reports (reporter_id, target_type, target_id, category)
  where reporter_id is not null and status in ('open', 'reviewing');

create table if not exists public.feedback_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null unique,
  email_hash varchar(128),
  ip_hash varchar(128),
  page varchar(500),
  category text not null check (category in ('feedback', 'bug', 'feature', 'contact')),
  subject varchar(160) not null,
  body varchar(4000) not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'closed')),
  created_at timestamptz not null default statement_timestamp(),
  constraint feedback_page_size check (page is null or length(page) <= 500)
);

create table if not exists public.scheduled_events (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  title varchar(120) not null,
  description varchar(1200) not null,
  event_type text not null check (event_type in ('tournament', 'exhibition', 'lesson', 'challenge', 'community')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  cover_asset text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint scheduled_events_time_range check (ends_at is null or ends_at > starts_at),
  constraint scheduled_events_metadata_size check (octet_length(metadata::text) <= 8192)
);

create index if not exists scheduled_events_upcoming_idx
  on public.scheduled_events (starts_at) where status in ('scheduled', 'live') and visibility = 'public';

create table if not exists public.tournaments (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name varchar(120) not null,
  description varchar(1200) not null default '',
  tournament_type text not null check (tournament_type in ('arena', 'swiss', 'private', 'exhibition')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private', 'club')),
  status text not null default 'draft' check (status in ('draft', 'registration', 'active', 'completed', 'cancelled')),
  organizer_id uuid references auth.users(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  event_id uuid references public.scheduled_events(id) on delete set null,
  variant text not null default 'standard' check (variant in ('standard', 'chess960')),
  rating_pool text not null check (rating_pool in ('bullet', 'blitz', 'rapid', 'classical')),
  rated boolean not null default false,
  base_time_ms bigint not null check (base_time_ms between 0 and 86400000),
  increment_ms integer not null default 0 check (increment_ms between 0 and 600000),
  starts_at timestamptz not null,
  registration_closes_at timestamptz,
  ends_at timestamptz,
  min_players smallint not null default 2 check (min_players between 2 and 512),
  max_players smallint not null default 32 check (max_players between 2 and 512),
  allow_late_join boolean not null default false,
  allow_house_players boolean not null default true,
  current_round smallint not null default 0 check (current_round >= 0),
  total_rounds smallint check (total_rounds is null or total_rounds > 0),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint tournaments_player_range check (max_players >= min_players),
  constraint tournaments_time_range check (ends_at is null or ends_at > starts_at),
  constraint tournaments_registration_time check (registration_closes_at is null or registration_closes_at <= starts_at),
  constraint tournaments_club_visibility check (visibility <> 'club' or club_id is not null),
  constraint tournaments_rules_size check (octet_length(rules::text) <= 16384)
);

create index if not exists tournaments_upcoming_idx
  on public.tournaments (starts_at) where status in ('registration', 'active');
create index if not exists tournaments_club_idx
  on public.tournaments (club_id, starts_at desc) where club_id is not null;

create table if not exists public.tournament_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  owner_kind text not null check (owner_kind in ('user', 'house')),
  user_id uuid references auth.users(id) on delete set null,
  house_player_id uuid references public.house_players(id) on delete set null,
  display_name_snapshot varchar(48) not null,
  rating_snapshot integer not null check (rating_snapshot between 0 and 4000),
  status text not null default 'registered' check (status in ('registered', 'active', 'withdrawn', 'disqualified', 'completed')),
  seed integer check (seed is null or seed > 0),
  score numeric(8,2) not null default 0,
  tie_breaks jsonb not null default '{}'::jsonb,
  final_rank integer check (final_rank is null or final_rank > 0),
  joined_at timestamptz not null default statement_timestamp(),
  withdrawn_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint tournament_entries_owner_shape check (
    (owner_kind = 'user' and house_player_id is null)
    or (owner_kind = 'house' and user_id is null)
  ),
  constraint tournament_entries_tiebreak_size check (octet_length(tie_breaks::text) <= 8192)
);

create unique index if not exists tournament_entries_user_unique_idx
  on public.tournament_entries (tournament_id, user_id) where user_id is not null;
create unique index if not exists tournament_entries_house_unique_idx
  on public.tournament_entries (tournament_id, house_player_id) where house_player_id is not null;
create index if not exists tournament_entries_standings_idx
  on public.tournament_entries (tournament_id, score desc, final_rank nulls last);

create table if not exists public.tournament_rounds (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number smallint not null check (round_number > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tournament_id, round_number),
  constraint tournament_rounds_time_range check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.tournament_pairings (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.tournament_rounds(id) on delete cascade,
  board_number smallint not null check (board_number > 0),
  white_entry_id uuid not null references public.tournament_entries(id) on delete restrict,
  black_entry_id uuid references public.tournament_entries(id) on delete restrict,
  game_id uuid references public.games(id) on delete set null,
  result text not null default '*' check (result in ('*', '1-0', '0-1', '1/2-1/2', 'bye')),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint tournament_pairings_distinct_players check (black_entry_id is null or white_entry_id <> black_entry_id),
  constraint tournament_pairings_bye check ((black_entry_id is null and result = 'bye') or black_entry_id is not null),
  unique (round_id, board_number),
  unique (game_id)
);

create index if not exists tournament_pairings_tournament_idx
  on public.tournament_pairings (tournament_id, round_id, board_number);

create table if not exists public.tournament_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  author_kind text not null check (author_kind in ('user', 'house', 'system')),
  author_user_id uuid references auth.users(id) on delete set null,
  author_house_player_id uuid references public.house_players(id) on delete set null,
  author_name_snapshot varchar(48) not null,
  body varchar(500) not null,
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default statement_timestamp(),
  constraint tournament_messages_author_shape check (
    (author_kind = 'user' and author_house_player_id is null)
    or (author_kind = 'house' and author_user_id is null)
    or (author_kind = 'system' and author_user_id is null and author_house_player_id is null)
  ),
  constraint tournament_messages_body_nonempty check (length(btrim(body)) between 1 and 500)
);

create index if not exists tournament_messages_tournament_idx
  on public.tournament_messages (tournament_id, created_at desc) where moderation_state = 'visible';

create table if not exists public.puzzles (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  fen text not null,
  side_to_move text not null check (side_to_move in ('white', 'black')),
  solution_uci text[] not null,
  rating integer not null default 1200 check (rating between 400 and 3200),
  themes text[] not null default '{}',
  source_game_id uuid references public.games(id) on delete set null,
  source_ply integer check (source_ply is null or source_ply >= 0),
  explanation varchar(1000),
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  featured_on date,
  created_at timestamptz not null default statement_timestamp(),
  constraint puzzles_fen_size check (length(fen) between 1 and 256),
  constraint puzzles_solution_size check (cardinality(solution_uci) between 1 and 32),
  constraint puzzles_themes_size check (cardinality(themes) <= 16)
);

create unique index if not exists puzzles_featured_on_unique_idx
  on public.puzzles (featured_on) where featured_on is not null and status = 'published';
create index if not exists puzzles_rating_idx on public.puzzles (rating, id) where status = 'published';

create table if not exists public.puzzle_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  outcome text not null check (outcome in ('solved', 'failed', 'abandoned')),
  moves_uci text[] not null default '{}',
  hints_used smallint not null default 0 check (hints_used between 0 and 20),
  duration_ms integer not null check (duration_ms between 0 and 86400000),
  rating_before integer check (rating_before between 0 and 4000),
  rating_after integer check (rating_after between 0 and 4000),
  attempted_at timestamptz not null default statement_timestamp(),
  constraint puzzle_attempts_moves_size check (cardinality(moves_uci) <= 64),
  unique (user_id, request_id)
);

create index if not exists puzzle_attempts_user_idx on public.puzzle_attempts (user_id, attempted_at desc);
create index if not exists puzzle_attempts_puzzle_idx on public.puzzle_attempts (puzzle_id, attempted_at desc);

create table if not exists public.opening_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  eco varchar(3) not null,
  name varchar(120) not null,
  variation varchar(160),
  moves_uci text[] not null,
  starting_fen text not null default 'start',
  side text not null default 'both' check (side in ('white', 'black', 'both')),
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  tags text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  constraint opening_lines_eco_format check (eco ~ '^[A-E][0-9]{2}$'),
  constraint opening_lines_moves_size check (cardinality(moves_uci) between 1 and 80),
  constraint opening_lines_fen_size check (length(starting_fen) between 1 and 256)
);

create index if not exists opening_lines_eco_idx on public.opening_lines (eco, name) where is_published;

create table if not exists public.lessons (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  title varchar(120) not null,
  summary varchar(500) not null,
  lesson_type text not null check (lesson_type in ('rules', 'opening', 'tactics', 'endgame', 'strategy')),
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  estimated_minutes smallint not null default 5 check (estimated_minutes between 1 and 120),
  content jsonb not null,
  position integer not null default 0 check (position >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint lessons_content_size check (octet_length(content::text) <= 131072)
);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  score smallint check (score is null or score between 0 and 100),
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, lesson_id),
  constraint lesson_progress_completion check (
    (status = 'completed' and progress_percent = 100 and completed_at is not null)
    or status = 'started'
  )
);

create index if not exists lesson_progress_user_idx on public.lesson_progress (user_id, updated_at desc);

create table if not exists public.studies (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title varchar(120) not null,
  description varchar(1000) not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'unlisted', 'private')),
  source_game_id uuid references public.games(id) on delete set null,
  root_fen text not null default 'start',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint studies_root_fen_size check (length(root_fen) between 1 and 256)
);

create index if not exists studies_owner_idx on public.studies (owner_id, updated_at desc)
  where owner_id is not null;

create table if not exists public.study_nodes (
  id uuid primary key default extensions.gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  parent_id uuid references public.study_nodes(id) on delete cascade,
  ply integer not null default 0 check (ply >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  uci varchar(5),
  san varchar(32),
  fen text not null,
  annotation varchar(4000),
  nags smallint[] not null default '{}',
  created_at timestamptz not null default statement_timestamp(),
  constraint study_nodes_move_shape check ((parent_id is null and uci is null and san is null) or parent_id is not null),
  constraint study_nodes_fen_size check (length(fen) between 1 and 256),
  unique (study_id, parent_id, sort_order)
);

create index if not exists study_nodes_study_idx on public.study_nodes (study_id, ply, sort_order);

create table if not exists public.saved_analyses (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  fen text,
  engine_name varchar(64) not null default 'Stockfish',
  engine_version varchar(64) not null,
  depth smallint not null check (depth between 1 and 99),
  summary jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint saved_analyses_target check (num_nonnulls(game_id, fen) = 1),
  constraint saved_analyses_fen_size check (fen is null or length(fen) between 1 and 256),
  constraint saved_analyses_compact check (octet_length(summary::text) <= 65536)
);

create index if not exists saved_analyses_owner_idx on public.saved_analyses (owner_id, updated_at desc);
create index if not exists saved_analyses_game_idx on public.saved_analyses (game_id) where game_id is not null;

create table if not exists public.achievements (
  id uuid primary key default extensions.gen_random_uuid(),
  key extensions.citext not null unique,
  name varchar(80) not null,
  description varchar(280) not null,
  category text not null check (category in ('game', 'rating', 'streak', 'puzzle', 'training', 'tournament', 'ai', 'social')),
  icon_key varchar(64) not null,
  xp_reward integer not null default 0 check (xp_reward between 0 and 100000),
  criteria jsonb not null,
  is_hidden boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  constraint achievements_key_format check (key::text ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  constraint achievements_criteria_size check (octet_length(criteria::text) <= 8192)
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  earned_at timestamptz,
  awarded_by_event_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, achievement_id),
  constraint user_achievements_metadata_size check (octet_length(metadata::text) <= 4096)
);

create index if not exists user_achievements_earned_idx
  on public.user_achievements (user_id, earned_at desc) where earned_at is not null;

create table if not exists public.missions (
  id uuid primary key default extensions.gen_random_uuid(),
  key extensions.citext not null unique,
  name varchar(100) not null,
  description varchar(300) not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'one_time')),
  mission_type text not null check (mission_type in ('play', 'win', 'puzzle', 'opening', 'ai', 'tournament', 'training')),
  target integer not null check (target > 0),
  xp_reward integer not null default 0 check (xp_reward between 0 and 100000),
  config jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  constraint missions_time_range check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint missions_config_size check (octet_length(config::text) <= 8192)
);

create table if not exists public.user_missions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  period_start date not null,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  unique (user_id, mission_id, period_start)
);

create index if not exists user_missions_active_idx on public.user_missions (user_id, period_start desc, completed_at);

create table if not exists public.user_progress_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type varchar(64) not null,
  source_type varchar(48),
  source_id text,
  xp_change integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint user_progress_events_payload_size check (octet_length(payload::text) <= 8192)
);

create index if not exists user_progress_events_user_idx
  on public.user_progress_events (user_id, created_at desc);

create table if not exists private.moderation_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid references public.user_reports(id) on delete set null,
  moderator_id uuid references auth.users(id) on delete set null,
  action_type text not null check (action_type in ('note', 'dismiss', 'hide_content', 'warn', 'mute', 'ban', 'unban')),
  target_type varchar(48) not null,
  target_id text not null,
  reason varchar(1000) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint moderation_actions_metadata_size check (octet_length(metadata::text) <= 8192)
);

create index if not exists moderation_actions_target_idx
  on private.moderation_actions (target_type, target_id, created_at desc);

create table if not exists private.platform_metrics_daily (
  metric_date date not null,
  metric_key varchar(64) not null,
  metric_value numeric not null,
  dimensions jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default statement_timestamp(),
  primary key (metric_date, metric_key, dimensions),
  constraint platform_metrics_dimensions_size check (octet_length(dimensions::text) <= 4096)
);

create table if not exists private.cleanup_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  deleted_counts jsonb not null default '{}'::jsonb,
  error_message varchar(2000),
  constraint cleanup_runs_counts_size check (octet_length(deleted_counts::text) <= 8192)
);

-- Timestamp maintenance for mutable, non-authoritative content.
drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at before update on public.friendships
for each row execute function private.set_updated_at();
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function private.set_updated_at();
drop trigger if exists clubs_set_updated_at on public.clubs;
create trigger clubs_set_updated_at before update on public.clubs
for each row execute function private.set_updated_at();
drop trigger if exists club_members_set_updated_at on public.club_members;
create trigger club_members_set_updated_at before update on public.club_members
for each row execute function private.set_updated_at();
drop trigger if exists game_collections_set_updated_at on public.game_collections;
create trigger game_collections_set_updated_at before update on public.game_collections
for each row execute function private.set_updated_at();
drop trigger if exists user_reports_set_updated_at on public.user_reports;
create trigger user_reports_set_updated_at before update on public.user_reports
for each row execute function private.set_updated_at();
drop trigger if exists scheduled_events_set_updated_at on public.scheduled_events;
create trigger scheduled_events_set_updated_at before update on public.scheduled_events
for each row execute function private.set_updated_at();
drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at before update on public.tournaments
for each row execute function private.set_updated_at();
drop trigger if exists tournament_entries_set_updated_at on public.tournament_entries;
create trigger tournament_entries_set_updated_at before update on public.tournament_entries
for each row execute function private.set_updated_at();
drop trigger if exists tournament_pairings_set_updated_at on public.tournament_pairings;
create trigger tournament_pairings_set_updated_at before update on public.tournament_pairings
for each row execute function private.set_updated_at();
drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at before update on public.lessons
for each row execute function private.set_updated_at();
drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at before update on public.lesson_progress
for each row execute function private.set_updated_at();
drop trigger if exists studies_set_updated_at on public.studies;
create trigger studies_set_updated_at before update on public.studies
for each row execute function private.set_updated_at();
drop trigger if exists saved_analyses_set_updated_at on public.saved_analyses;
create trigger saved_analyses_set_updated_at before update on public.saved_analyses
for each row execute function private.set_updated_at();
drop trigger if exists user_achievements_set_updated_at on public.user_achievements;
create trigger user_achievements_set_updated_at before update on public.user_achievements
for each row execute function private.set_updated_at();
drop trigger if exists user_missions_set_updated_at on public.user_missions;
create trigger user_missions_set_updated_at before update on public.user_missions
for each row execute function private.set_updated_at();

-- RLS is enabled immediately. Policies and column grants arrive in the next migration.
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_mutes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_messages enable row level security;
alter table public.activity_feed_items enable row level security;
alter table public.game_reactions enable row level security;
alter table public.game_favorites enable row level security;
alter table public.game_collections enable row level security;
alter table public.game_collection_items enable row level security;
alter table public.notifications enable row level security;
alter table public.user_reports enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.scheduled_events enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_pairings enable row level security;
alter table public.tournament_messages enable row level security;
alter table public.puzzles enable row level security;
alter table public.puzzle_attempts enable row level security;
alter table public.opening_lines enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.studies enable row level security;
alter table public.study_nodes enable row level security;
alter table public.saved_analyses enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.user_progress_events enable row level security;
alter table private.moderation_actions enable row level security;
alter table private.platform_metrics_daily enable row level security;
alter table private.cleanup_runs enable row level security;
