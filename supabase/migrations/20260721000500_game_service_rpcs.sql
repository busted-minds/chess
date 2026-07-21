-- Busted Minds Chess: trusted, transactional game and rating RPCs.
-- Every public function in this file is callable only with the service-role database role.

create or replace function public.service_has_role(p_user_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_roles, p_user_id);
$$;

create or replace function public.service_create_game(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_variant text,
  p_initial_fen text,
  p_base_time_ms bigint,
  p_increment_ms integer,
  p_rated boolean,
  p_rating_pool text,
  p_visibility text,
  p_color_preference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_game public.games%rowtype;
  v_color text;
  v_invite_token text;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
  v_inserted integer;
begin
  if p_actor_user_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'actor and request id are required';
  end if;
  if p_variant not in ('standard', 'chess960', 'from_position')
    or p_visibility not in ('public', 'unlisted', 'private')
    or p_color_preference not in ('white', 'black', 'random') then
    raise exception using errcode = '22023', message = 'invalid game options';
  end if;
  if p_base_time_ms < 0 or p_base_time_ms > 86400000
    or p_increment_ms < 0 or p_increment_ms > 600000 then
    raise exception using errcode = '22023', message = 'invalid time control';
  end if;
  if p_initial_fen is null or length(p_initial_fen) > 256 then
    raise exception using errcode = '22023', message = 'invalid initial FEN';
  end if;
  if p_rated and (
    p_variant <> 'standard'
    or p_rating_pool not in ('bullet', 'blitz', 'rapid', 'classical')
    or not private.is_permanent_user(p_actor_user_id)
  ) then
    raise exception using errcode = '42501', message = 'rated games require a permanent account and standard chess';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = p_actor_user_id and p.status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'active profile required';
  end if;

  v_request_hash := encode(extensions.digest(
    concat_ws('|', p_variant, p_initial_fen, p_base_time_ms::text, p_increment_ms::text,
      p_rated::text, coalesce(p_rating_pool, ''), p_visibility, p_color_preference), 'sha256'), 'hex');

  select i.request_hash, i.response_body
  into v_existing_hash, v_response
  from private.idempotency_keys i
  where i.scope = 'create_game'
    and i.actor_key = p_actor_user_id::text
    and i.request_id = p_request_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    if v_response is null then
      raise exception using errcode = '55000', message = 'request is already in progress';
    end if;
    return v_response;
  end if;

  insert into private.idempotency_keys (
    scope, actor_key, request_id, request_hash, status, expires_at
  ) values (
    'create_game', p_actor_user_id::text, p_request_id, v_request_hash, 'processing',
    statement_timestamp() + interval '7 days'
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception using errcode = '55000', message = 'request is already in progress';
  end if;

  v_color := case
    when p_color_preference in ('white', 'black') then p_color_preference
    when left(p_request_id::text, 1) < '8' then 'white'
    else 'black'
  end;

  insert into public.games (
    variant, visibility, status, rated, rating_pool, matchmaking_source,
    bot_move_policy, initial_fen, current_fen, result, active_color,
    base_time_ms, white_time_ms, black_time_ms, increment_ms, created_by
  ) values (
    p_variant, p_visibility, 'pending', p_rated,
    case when p_rated then p_rating_pool else null end,
    'invite', 'none', p_initial_fen, p_initial_fen, '*', 'white',
    p_base_time_ms, p_base_time_ms, p_base_time_ms, p_increment_ms, p_actor_user_id
  ) returning * into v_game;

  insert into public.game_participants (
    game_id, color, participant_kind, user_id, display_name_snapshot,
    avatar_url_snapshot, rating_snapshot, is_ready, last_connected_at
  ) values (
    v_game.id, v_color, 'user', p_actor_user_id, v_profile.display_name,
    v_profile.avatar_url,
    (select r.rating from public.ratings r where r.user_id = p_actor_user_id and r.pool = p_rating_pool),
    true, statement_timestamp()
  );

  v_invite_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into private.game_invites (
    game_id, token_hash, created_by, max_uses, expires_at
  ) values (
    v_game.id, extensions.digest(v_invite_token, 'sha256'), p_actor_user_id, 1,
    statement_timestamp() + interval '24 hours'
  );

  v_response := jsonb_build_object(
    'game_id', v_game.id,
    'share_id', v_game.share_id,
    'invite_token', v_invite_token,
    'color', v_color,
    'version', v_game.version,
    'status', v_game.status
  );

  update private.idempotency_keys
  set status = 'completed', response_code = 201, response_body = v_response,
      resource_type = 'game', resource_id = v_game.id::text
  where scope = 'create_game' and actor_key = p_actor_user_id::text and request_id = p_request_id;

  return v_response;
end;
$$;

create or replace function public.service_join_game(
  p_actor_user_id uuid,
  p_game_id uuid,
  p_invite_token text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_game public.games%rowtype;
  v_invite private.game_invites%rowtype;
  v_existing_participant public.game_participants%rowtype;
  v_color text;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
  v_inserted integer;
begin
  if p_actor_user_id is null or p_game_id is null or p_request_id is null
    or p_invite_token is null or length(p_invite_token) < 16 then
    raise exception using errcode = '22023', message = 'invalid join request';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = p_actor_user_id and p.status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'active profile required';
  end if;

  v_request_hash := encode(extensions.digest(
    concat_ws('|', p_game_id::text, p_invite_token), 'sha256'), 'hex');
  select i.request_hash, i.response_body into v_existing_hash, v_response
  from private.idempotency_keys i
  where i.scope = 'join_game' and i.actor_key = p_actor_user_id::text and i.request_id = p_request_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    if v_response is null then
      raise exception using errcode = '55000', message = 'request is already in progress';
    end if;
    return v_response;
  end if;

  insert into private.idempotency_keys (scope, actor_key, request_id, request_hash, status, expires_at)
  values ('join_game', p_actor_user_id::text, p_request_id, v_request_hash, 'processing',
    statement_timestamp() + interval '7 days')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception using errcode = '55000', message = 'request is already in progress';
  end if;

  select g.* into v_game from public.games g where g.id = p_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'game not found';
  end if;

  select gp.* into v_existing_participant
  from public.game_participants gp
  where gp.game_id = p_game_id and gp.user_id = p_actor_user_id;
  if found then
    v_response := jsonb_build_object(
      'game_id', v_game.id, 'share_id', v_game.share_id, 'color', v_existing_participant.color,
      'version', v_game.version, 'status', v_game.status, 'already_joined', true
    );
    update private.idempotency_keys set status = 'completed', response_code = 200,
      response_body = v_response, resource_type = 'game', resource_id = v_game.id::text
    where scope = 'join_game' and actor_key = p_actor_user_id::text and request_id = p_request_id;
    return v_response;
  end if;

  if v_game.status <> 'pending' then
    raise exception using errcode = '55000', message = 'game is not accepting players';
  end if;
  if v_game.rated and not private.is_permanent_user(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'rated games require a permanent account';
  end if;

  select gi.* into v_invite
  from private.game_invites gi
  where gi.game_id = p_game_id
    and gi.token_hash = extensions.digest(p_invite_token, 'sha256')
  for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= statement_timestamp()
    or v_invite.use_count >= v_invite.max_uses then
    raise exception using errcode = '42501', message = 'invite is invalid or expired';
  end if;

  if (select count(*) from public.game_participants gp where gp.game_id = p_game_id) >= 2 then
    raise exception using errcode = '55000', message = 'game is full';
  end if;

  select case when gp.color = 'white' then 'black' else 'white' end into v_color
  from public.game_participants gp where gp.game_id = p_game_id limit 1;
  v_color := coalesce(v_color, 'white');

  insert into public.game_participants (
    game_id, color, participant_kind, user_id, display_name_snapshot,
    avatar_url_snapshot, rating_snapshot, is_ready, last_connected_at
  ) values (
    p_game_id, v_color, 'user', p_actor_user_id, v_profile.display_name,
    v_profile.avatar_url,
    (select r.rating from public.ratings r where r.user_id = p_actor_user_id and r.pool = v_game.rating_pool),
    true, statement_timestamp()
  );

  update private.game_invites
  set use_count = use_count + 1,
      revoked_at = case when use_count + 1 >= max_uses then statement_timestamp() else revoked_at end
  where id = v_invite.id;

  update public.games
  set status = 'active', turn_started_at = clock_timestamp(), version = version + 1
  where id = p_game_id
  returning * into v_game;

  v_response := jsonb_build_object(
    'game_id', v_game.id, 'share_id', v_game.share_id, 'color', v_color,
    'version', v_game.version, 'status', v_game.status
  );
  update private.idempotency_keys set status = 'completed', response_code = 200,
    response_body = v_response, resource_type = 'game', resource_id = v_game.id::text
  where scope = 'join_game' and actor_key = p_actor_user_id::text and request_id = p_request_id;
  return v_response;
end;
$$;

-- Mirror the application rule used by chess.js timeout adjudication. The FEN
-- comes from the locked durable game row, never from the action or move
-- request. Keeping this check in the transaction prevents a trusted service
-- caller from accidentally converting an insufficient-material draw into a
-- win before ratings are applied.
create or replace function private.timeout_result_from_fen(
  p_fen text,
  p_loser_color text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_board text := split_part(p_fen, ' ', 1);
  v_winner_color text;
  v_major_or_pawn_count integer;
  v_minor_count integer;
  v_opponent_nonking_count integer;
  v_has_mating_material boolean;
begin
  if p_fen is null or p_loser_color is null
    or p_loser_color not in ('white', 'black')
    or v_board !~ '^[prnbqkPRNBQK1-8/]+$'
    or array_length(string_to_array(v_board, '/'), 1) <> 8 then
    raise exception using errcode = '22023', message = 'invalid position for timeout adjudication';
  end if;

  v_winner_color := case when p_loser_color = 'white' then 'black' else 'white' end;
  if v_winner_color = 'white' then
    v_major_or_pawn_count := length(regexp_replace(v_board, '[^PRQ]', '', 'g'));
    v_minor_count := length(regexp_replace(v_board, '[^BN]', '', 'g'));
    v_opponent_nonking_count := length(regexp_replace(v_board, '[^prqbn]', '', 'g'));
  else
    v_major_or_pawn_count := length(regexp_replace(v_board, '[^prq]', '', 'g'));
    v_minor_count := length(regexp_replace(v_board, '[^bn]', '', 'g'));
    v_opponent_nonking_count := length(regexp_replace(v_board, '[^PRQBN]', '', 'g'));
  end if;

  v_has_mating_material := v_major_or_pawn_count > 0
    or v_minor_count >= 2
    or (v_minor_count = 1 and v_opponent_nonking_count > 0);

  if not v_has_mating_material then
    return '1/2-1/2';
  end if;
  return case when v_winner_color = 'white' then '1-0' else '0-1' end;
end;
$$;

-- Remove the pre-material-integrity contracts when this file is used to
-- refresh an existing disposable database. The current signatures below are
-- otherwise safe to create repeatedly.
drop function if exists public.service_submit_move(
  uuid, uuid, uuid, uuid, integer, uuid, text, text, text, text, text, text,
  text, text, text, text, text, integer, bigint
);

create or replace function public.service_submit_move(
  p_actor_user_id uuid,
  p_actor_house_player_id uuid,
  p_computed_by_user_id uuid,
  p_game_id uuid,
  p_expected_version integer,
  p_request_id uuid,
  p_request_hash text,
  p_uci text,
  p_san text,
  p_resulting_fen text,
  p_resulting_pgn text,
  p_position_key text,
  p_status text,
  p_result text,
  p_termination text,
  p_timeout_result text,
  p_engine_profile text,
  p_engine_version text,
  p_engine_level integer,
  p_engine_seed bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_participant public.game_participants%rowtype;
  v_config private.house_player_configs%rowtype;
  v_existing private.game_mutation_requests%rowtype;
  v_now timestamptz;
  v_elapsed_ms integer;
  v_remaining_before bigint;
  v_remaining_after bigint;
  v_next_color text;
  v_next_version integer;
  v_next_ply integer;
  v_move_id uuid;
  v_timeout_result text;
  v_response jsonb;
begin
  if p_game_id is null or p_request_id is null or p_request_hash is null
    or p_expected_version < 0 or num_nonnulls(p_actor_user_id, p_actor_house_player_id) <> 1 then
    raise exception using errcode = '22023', message = 'invalid move request';
  end if;
  if p_uci is null or p_uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?$'
    or p_san is null or length(p_san) > 32
    or p_resulting_fen is null or length(p_resulting_fen) > 256
    or p_resulting_pgn is null or octet_length(p_resulting_pgn) > 262144
    or (p_position_key is not null and length(p_position_key) > 32) then
    raise exception using errcode = '22023', message = 'invalid move transition payload';
  end if;
  if p_status not in ('active', 'completed')
    or (p_status = 'active' and (p_result <> '*' or p_termination is not null))
    or (p_status = 'completed' and (p_result not in ('1-0', '0-1', '1/2-1/2') or p_termination is null)) then
    raise exception using errcode = '22023', message = 'invalid resulting game state';
  end if;

  select g.* into v_game from public.games g where g.id = p_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'game not found';
  end if;

  select mr.* into v_existing
  from private.game_mutation_requests mr
  where mr.game_id = p_game_id and mr.request_id = p_request_id;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    if v_existing.response is null then
      raise exception using errcode = '55000', message = 'request is already in progress';
    end if;
    return v_existing.response;
  end if;

  if v_game.status <> 'active' then
    raise exception using errcode = '55000', message = 'game is not active';
  end if;
  if v_game.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale game version';
  end if;

  select gp.* into v_participant
  from public.game_participants gp
  where gp.game_id = p_game_id
    and gp.color = v_game.active_color
    and (
      (p_actor_user_id is not null and gp.participant_kind = 'user' and gp.user_id = p_actor_user_id)
      or (p_actor_house_player_id is not null and gp.participant_kind = 'house' and gp.house_player_id = p_actor_house_player_id)
    );
  if not found then
    raise exception using errcode = '42501', message = 'actor is not the player to move';
  end if;

  if p_actor_user_id is not null then
    if p_computed_by_user_id is not null
      or num_nonnulls(p_engine_profile, p_engine_version, p_engine_level, p_engine_seed) <> 0 then
      raise exception using errcode = '22023', message = 'human moves cannot include engine identity';
    end if;
  else
    select c.* into v_config
    from private.house_player_configs c
    where c.house_player_id = p_actor_house_player_id
      and c.paused_at is null;
    if not found then
      raise exception using errcode = '42501', message = 'house-player engine identity is not approved';
    end if;
    if (p_engine_profile is not null and p_engine_profile <> v_config.engine_profile)
      or (p_engine_version is not null and p_engine_version <> v_config.engine_version)
      or (p_engine_level is not null and p_engine_level <> v_config.difficulty)
      or (p_engine_seed is not null and p_engine_seed <> v_config.deterministic_seed) then
      raise exception using errcode = '42501', message = 'house-player engine identity does not match approved configuration';
    end if;
    p_engine_profile := v_config.engine_profile;
    p_engine_version := v_config.engine_version;
    p_engine_level := v_config.difficulty;
    p_engine_seed := v_config.deterministic_seed;
    if v_game.rated and (v_game.bot_move_policy <> 'deterministic_server' or not v_config.allow_rated) then
      raise exception using errcode = '42501', message = 'this house-player move is not eligible for rated play';
    end if;
    if v_game.bot_move_policy = 'browser_legal' and (
      p_computed_by_user_id is null or not private.is_game_participant(p_game_id, p_computed_by_user_id)
    ) then
      raise exception using errcode = '42501', message = 'browser-computed house move lacks an auditable participant';
    end if;
  end if;

  v_now := clock_timestamp();
  v_elapsed_ms := least(2147483647, greatest(0,
    floor(extract(epoch from (v_now - v_game.turn_started_at)) * 1000)))::integer;
  v_remaining_before := case when v_game.active_color = 'white'
    then v_game.white_time_ms else v_game.black_time_ms end;

  if v_elapsed_ms >= v_remaining_before then
    v_timeout_result := private.timeout_result_from_fen(v_game.current_fen, v_game.active_color);
    if p_timeout_result is distinct from v_timeout_result then
      raise exception using errcode = '22023', message = 'server timeout adjudication mismatch';
    end if;
    update public.games
    set status = 'completed', result = v_timeout_result, termination = 'timeout', ended_at = v_now,
        turn_started_at = null,
        white_time_ms = case when active_color = 'white' then 0 else white_time_ms end,
        black_time_ms = case when active_color = 'black' then 0 else black_time_ms end,
        version = version + 1
    where id = p_game_id
    returning * into v_game;

    v_response := jsonb_build_object(
      'game_id', v_game.id, 'version', v_game.version, 'status', v_game.status,
      'result', v_game.result, 'termination', v_game.termination,
      'white_time_ms', v_game.white_time_ms, 'black_time_ms', v_game.black_time_ms,
      'timeout', true
    );
    insert into private.game_mutation_requests (
      game_id, request_id, actor_kind, actor_user_id, actor_house_player_id,
      mutation_type, expected_version, request_hash, response, completed_at
    ) values (
      p_game_id, p_request_id,
      case when p_actor_user_id is not null then 'user' else 'house' end,
      p_actor_user_id, p_actor_house_player_id, 'timeout', p_expected_version,
      p_request_hash, v_response, statement_timestamp()
    );
    if v_game.rated then
      perform public.service_apply_game_ratings(p_game_id);
    end if;
    return v_response;
  end if;

  v_remaining_after := v_remaining_before - v_elapsed_ms + v_game.increment_ms;
  v_next_color := case when v_game.active_color = 'white' then 'black' else 'white' end;
  v_next_version := v_game.version + 1;
  v_next_ply := v_game.move_count + 1;

  insert into public.game_moves (
    game_id, ply, resulting_version, request_id, actor_kind, actor_user_id,
    actor_house_player_id, color, uci, san, position_key, elapsed_ms, clock_after_ms,
    engine_profile, engine_version, engine_level, engine_seed, computed_by_user_id, created_at
  ) values (
    p_game_id, v_next_ply, v_next_version, p_request_id,
    case when p_actor_user_id is not null then 'user' else 'house' end,
    p_actor_user_id, p_actor_house_player_id, v_game.active_color, p_uci, p_san,
    p_position_key, v_elapsed_ms, v_remaining_after,
    p_engine_profile, p_engine_version, p_engine_level, p_engine_seed, p_computed_by_user_id, v_now
  ) returning id into v_move_id;

  update public.games
  set current_fen = p_resulting_fen,
      pgn = p_resulting_pgn,
      white_time_ms = case when active_color = 'white' then v_remaining_after else white_time_ms end,
      black_time_ms = case when active_color = 'black' then v_remaining_after else black_time_ms end,
      active_color = v_next_color,
      status = p_status,
      result = p_result,
      termination = p_termination,
      turn_started_at = case when p_status = 'active' then v_now else null end,
      first_move_at = coalesce(first_move_at, v_now),
      ended_at = case when p_status = 'completed' then v_now else null end,
      version = v_next_version,
      move_count = v_next_ply
  where id = p_game_id and version = p_expected_version
  returning * into v_game;
  if not found then
    raise exception using errcode = '40001', message = 'stale game version';
  end if;

  v_response := jsonb_build_object(
    'game_id', v_game.id, 'move_id', v_move_id, 'ply', v_next_ply,
    'version', v_game.version, 'status', v_game.status, 'result', v_game.result,
    'termination', v_game.termination, 'active_color', v_game.active_color,
    'current_fen', v_game.current_fen, 'white_time_ms', v_game.white_time_ms,
    'black_time_ms', v_game.black_time_ms, 'turn_started_at', v_game.turn_started_at,
    'timeout', false
  );
  insert into private.game_mutation_requests (
    game_id, request_id, actor_kind, actor_user_id, actor_house_player_id,
    mutation_type, expected_version, request_hash, response, completed_at
  ) values (
    p_game_id, p_request_id,
    case when p_actor_user_id is not null then 'user' else 'house' end,
    p_actor_user_id, p_actor_house_player_id, 'move', p_expected_version,
    p_request_hash, v_response, statement_timestamp()
  );
  if v_game.rated and v_game.status = 'completed' then
    perform public.service_apply_game_ratings(p_game_id);
  end if;
  return v_response;
end;
$$;

drop function if exists public.service_game_action(uuid, uuid, integer, uuid, text);

create or replace function public.service_game_action(
  p_actor_user_id uuid,
  p_game_id uuid,
  p_expected_version integer,
  p_request_id uuid,
  p_action text,
  p_timeout_result text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_participant public.game_participants%rowtype;
  v_existing private.game_mutation_requests%rowtype;
  v_offer public.game_offers%rowtype;
  v_hash text;
  v_now timestamptz := clock_timestamp();
  v_elapsed_ms bigint;
  v_active_remaining bigint;
  v_result text;
  v_response jsonb;
begin
  if p_actor_user_id is null or p_game_id is null or p_request_id is null
    or p_expected_version < 0 or p_action not in (
      'resign', 'abort', 'claim_timeout', 'claim_draw', 'offer_draw', 'accept_draw', 'decline_draw',
      'offer_takeback', 'request_takeback', 'accept_takeback', 'decline_takeback'
    ) then
    raise exception using errcode = '22023', message = 'invalid game action';
  end if;
  v_hash := encode(extensions.digest(concat_ws('|', p_game_id::text, p_expected_version::text, p_action), 'sha256'), 'hex');

  select g.* into v_game from public.games g where g.id = p_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'game not found';
  end if;
  select mr.* into v_existing from private.game_mutation_requests mr
  where mr.game_id = p_game_id and mr.request_id = p_request_id;
  if found then
    if v_existing.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    return v_existing.response;
  end if;
  if v_game.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale game version';
  end if;
  select gp.* into v_participant from public.game_participants gp
  where gp.game_id = p_game_id and gp.user_id = p_actor_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'only a player may perform this action';
  end if;

  if p_action in (
      'resign', 'claim_timeout', 'claim_draw', 'offer_draw', 'accept_draw', 'decline_draw',
      'offer_takeback', 'request_takeback', 'accept_takeback', 'decline_takeback'
    )
    and v_game.status <> 'active' then
    raise exception using errcode = '55000', message = 'game is not active';
  end if;

  if p_action = 'resign' then
    v_result := case when v_participant.color = 'white' then '0-1' else '1-0' end;
    update public.games set status = 'completed', result = v_result, termination = 'resignation',
      ended_at = v_now, turn_started_at = null, version = version + 1
    where id = p_game_id returning * into v_game;
  elsif p_action = 'abort' then
    if v_game.status not in ('pending', 'active') or v_game.move_count >= 2 then
      raise exception using errcode = '55000', message = 'game can no longer be aborted';
    end if;
    update public.games set status = 'aborted', result = '*', termination = 'abort',
      ended_at = v_now, turn_started_at = null, version = version + 1
    where id = p_game_id returning * into v_game;
  elsif p_action = 'claim_timeout' then
    v_elapsed_ms := greatest(0, floor(extract(epoch from (v_now - v_game.turn_started_at)) * 1000));
    v_active_remaining := case when v_game.active_color = 'white' then v_game.white_time_ms else v_game.black_time_ms end;
    if v_elapsed_ms < v_active_remaining then
      raise exception using errcode = '55000', message = 'active clock has not expired';
    end if;
    v_result := private.timeout_result_from_fen(v_game.current_fen, v_game.active_color);
    if p_timeout_result is distinct from v_result then
      raise exception using errcode = '22023', message = 'server timeout adjudication mismatch';
    end if;
    update public.games set status = 'completed', result = v_result, termination = 'timeout',
      ended_at = v_now, turn_started_at = null,
      white_time_ms = case when active_color = 'white' then 0 else white_time_ms end,
      black_time_ms = case when active_color = 'black' then 0 else black_time_ms end,
      version = version + 1
    where id = p_game_id returning * into v_game;
  elsif p_action = 'claim_draw' then
    raise exception using errcode = '22023',
      message = 'use service_claim_draw with a server-validated repetition or fifty_move reason';
  elsif p_action in ('offer_draw', 'offer_takeback', 'request_takeback') then
    insert into public.game_offers (
      game_id, offer_type, offered_by_color, offered_by_user_id, status, request_id,
      expires_at
    ) values (
      p_game_id, case when p_action = 'offer_draw' then 'draw' else 'takeback' end,
      v_participant.color, p_actor_user_id, 'pending', p_request_id,
      statement_timestamp() + interval '5 minutes'
    ) returning * into v_offer;
  elsif p_action in ('accept_draw', 'decline_draw') then
    select o.* into v_offer from public.game_offers o
    where o.game_id = p_game_id and o.offer_type = 'draw' and o.status = 'pending'
      and o.offered_by_color <> v_participant.color
    order by o.created_at desc limit 1 for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'no opponent draw offer exists';
    end if;
    update public.game_offers set
      status = case when p_action = 'accept_draw' then 'accepted' else 'declined' end,
      resolved_at = v_now
    where id = v_offer.id returning * into v_offer;
    if p_action = 'accept_draw' then
      update public.games set status = 'completed', result = '1/2-1/2', termination = 'agreement',
        ended_at = v_now, turn_started_at = null, version = version + 1
      where id = p_game_id returning * into v_game;
    end if;
  elsif p_action in ('accept_takeback', 'decline_takeback') then
    select o.* into v_offer from public.game_offers o
    where o.game_id = p_game_id and o.offer_type = 'takeback' and o.status = 'pending'
      and o.offered_by_color <> v_participant.color
    order by o.created_at desc limit 1 for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'no opponent takeback request exists';
    end if;
    update public.game_offers set
      status = case when p_action = 'accept_takeback' then 'accepted' else 'declined' end,
      resolved_at = v_now
    where id = v_offer.id returning * into v_offer;
  end if;

  v_response := jsonb_build_object(
    'game_id', v_game.id, 'version', v_game.version, 'status', v_game.status,
    'result', v_game.result, 'termination', v_game.termination,
    'offer_id', case when v_offer.id is null then null else v_offer.id end,
    'requires_rewind', p_action = 'accept_takeback',
    'action', p_action
  );
  insert into private.game_mutation_requests (
    game_id, request_id, actor_kind, actor_user_id, mutation_type,
    expected_version, request_hash, response, completed_at
  ) values (
    p_game_id, p_request_id, 'user', p_actor_user_id,
    case
      when p_action = 'resign' then 'resign'
      when p_action = 'abort' then 'abort'
      when p_action = 'claim_timeout' then 'timeout'
      when p_action in ('claim_draw', 'offer_draw', 'accept_draw', 'decline_draw') then 'draw'
      else 'takeback'
    end,
    p_expected_version, v_hash, v_response, statement_timestamp()
  );
  if v_game.rated and v_game.status = 'completed' then
    perform public.service_apply_game_ratings(p_game_id);
  end if;
  return v_response;
end;
$$;

create or replace function public.service_apply_game_ratings(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_white public.game_participants%rowtype;
  v_black public.game_participants%rowtype;
  v_white_rating public.ratings%rowtype;
  v_black_rating public.ratings%rowtype;
  v_white_score numeric(2,1);
  v_black_score numeric(2,1);
  v_white_expected numeric;
  v_black_expected numeric;
  v_white_k integer;
  v_black_k integer;
  v_white_after integer;
  v_black_after integer;
  v_white_provisional_after boolean;
  v_black_provisional_after boolean;
begin
  if p_game_id is null then
    raise exception using errcode = '22023', message = 'game id is required';
  end if;
  select g.* into v_game from public.games g where g.id = p_game_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'game not found';
  end if;
  if not v_game.rated or v_game.status <> 'completed' then
    raise exception using errcode = '55000', message = 'only completed rated games can update ratings';
  end if;
  if v_game.rating_applied_at is not null then
    return jsonb_build_object('game_id', p_game_id, 'already_applied', true);
  end if;

  select gp.* into v_white from public.game_participants gp
  where gp.game_id = p_game_id and gp.color = 'white';
  select gp.* into v_black from public.game_participants gp
  where gp.game_id = p_game_id and gp.color = 'black';
  if v_white.id is null or v_black.id is null
    or (v_white.participant_kind = 'user' and (v_white.user_id is null or not private.is_permanent_user(v_white.user_id)))
    or (v_black.participant_kind = 'user' and (v_black.user_id is null or not private.is_permanent_user(v_black.user_id))) then
    raise exception using errcode = '42501', message = 'both rated participants must be eligible permanent identities';
  end if;
  if (v_white.participant_kind = 'house' and not exists (
      select 1 from private.house_player_configs c where c.house_player_id = v_white.house_player_id
        and c.allow_rated and c.rating_mode = 'dynamic' and c.paused_at is null))
    or (v_black.participant_kind = 'house' and not exists (
      select 1 from private.house_player_configs c where c.house_player_id = v_black.house_player_id
        and c.allow_rated and c.rating_mode = 'dynamic' and c.paused_at is null)) then
    raise exception using errcode = '42501', message = 'house player is not eligible for dynamic rated play';
  end if;

  if v_white.participant_kind = 'user' then
    insert into public.ratings (owner_kind, user_id, pool)
    values ('user', v_white.user_id, v_game.rating_pool)
    on conflict (user_id, pool) where user_id is not null do nothing;
  else
    insert into public.ratings (owner_kind, house_player_id, pool, rating, peak_rating, provisional)
    values ('house', v_white.house_player_id, v_game.rating_pool,
      coalesce(v_white.rating_snapshot, 1200), coalesce(v_white.rating_snapshot, 1200), false)
    on conflict (house_player_id, pool) where house_player_id is not null do nothing;
  end if;
  if v_black.participant_kind = 'user' then
    insert into public.ratings (owner_kind, user_id, pool)
    values ('user', v_black.user_id, v_game.rating_pool)
    on conflict (user_id, pool) where user_id is not null do nothing;
  else
    insert into public.ratings (owner_kind, house_player_id, pool, rating, peak_rating, provisional)
    values ('house', v_black.house_player_id, v_game.rating_pool,
      coalesce(v_black.rating_snapshot, 1200), coalesce(v_black.rating_snapshot, 1200), false)
    on conflict (house_player_id, pool) where house_player_id is not null do nothing;
  end if;

  select r.* into v_white_rating from public.ratings r
  where r.pool = v_game.rating_pool
    and ((v_white.participant_kind = 'user' and r.user_id = v_white.user_id)
      or (v_white.participant_kind = 'house' and r.house_player_id = v_white.house_player_id));
  select r.* into v_black_rating from public.ratings r
  where r.pool = v_game.rating_pool
    and ((v_black.participant_kind = 'user' and r.user_id = v_black.user_id)
      or (v_black.participant_kind = 'house' and r.house_player_id = v_black.house_player_id));

  -- Stable lock ordering prevents reciprocal games from deadlocking rating rows.
  perform 1 from public.ratings r
  where r.id in (v_white_rating.id, v_black_rating.id)
  order by r.id for update;
  select r.* into v_white_rating from public.ratings r where r.id = v_white_rating.id;
  select r.* into v_black_rating from public.ratings r where r.id = v_black_rating.id;

  v_white_score := case v_game.result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  v_black_score := 1 - v_white_score;
  v_white_expected := 1 / (1 + power(10::numeric, (v_black_rating.rating - v_white_rating.rating)::numeric / 400));
  v_black_expected := 1 - v_white_expected;
  v_white_k := case when v_white_rating.games_played < 20 then 40 when v_white_rating.rating >= 2400 then 10 else 20 end;
  v_black_k := case when v_black_rating.games_played < 20 then 40 when v_black_rating.rating >= 2400 then 10 else 20 end;
  v_white_after := greatest(0, least(4000,
    v_white_rating.rating + round(v_white_k * (v_white_score - v_white_expected))::integer));
  v_black_after := greatest(0, least(4000,
    v_black_rating.rating + round(v_black_k * (v_black_score - v_black_expected))::integer));
  v_white_provisional_after := v_white_rating.games_played + 1 < 20;
  v_black_provisional_after := v_black_rating.games_played + 1 < 20;

  update public.ratings set
    rating = v_white_after,
    provisional = v_white_provisional_after,
    games_played = games_played + 1,
    wins = wins + case when v_white_score = 1 then 1 else 0 end,
    draws = draws + case when v_white_score = 0.5 then 1 else 0 end,
    losses = losses + case when v_white_score = 0 then 1 else 0 end,
    current_streak = case when v_white_score = 1 then greatest(1, current_streak + 1)
      when v_white_score = 0 then least(-1, current_streak - 1) else 0 end,
    peak_rating = greatest(peak_rating, v_white_after),
    last_played_at = statement_timestamp()
  where id = v_white_rating.id;

  update public.ratings set
    rating = v_black_after,
    provisional = v_black_provisional_after,
    games_played = games_played + 1,
    wins = wins + case when v_black_score = 1 then 1 else 0 end,
    draws = draws + case when v_black_score = 0.5 then 1 else 0 end,
    losses = losses + case when v_black_score = 0 then 1 else 0 end,
    current_streak = case when v_black_score = 1 then greatest(1, current_streak + 1)
      when v_black_score = 0 then least(-1, current_streak - 1) else 0 end,
    peak_rating = greatest(peak_rating, v_black_after),
    last_played_at = statement_timestamp()
  where id = v_black_rating.id;

  insert into public.rating_events (
    game_id, owner_kind, user_id, house_player_id, owner_name_snapshot, pool,
    rating_before, rating_after, rating_change, opponent_rating, score, algorithm,
    provisional_before, provisional_after
  ) values
  (
    p_game_id, v_white.participant_kind, v_white.user_id, v_white.house_player_id,
    v_white.display_name_snapshot, v_game.rating_pool, v_white_rating.rating, v_white_after,
    v_white_after - v_white_rating.rating, v_black_rating.rating, v_white_score,
    'elo-v1', v_white_rating.provisional, v_white_provisional_after
  ),
  (
    p_game_id, v_black.participant_kind, v_black.user_id, v_black.house_player_id,
    v_black.display_name_snapshot, v_game.rating_pool, v_black_rating.rating, v_black_after,
    v_black_after - v_black_rating.rating, v_white_rating.rating, v_black_score,
    'elo-v1', v_black_rating.provisional, v_black_provisional_after
  );

  update public.games set rating_applied_at = statement_timestamp() where id = p_game_id;
  return jsonb_build_object(
    'game_id', p_game_id, 'already_applied', false,
    'white', jsonb_build_object('before', v_white_rating.rating, 'after', v_white_after,
      'change', v_white_after - v_white_rating.rating),
    'black', jsonb_build_object('before', v_black_rating.rating, 'after', v_black_after,
      'change', v_black_after - v_black_rating.rating),
    'algorithm', 'elo-v1'
  );
end;
$$;

revoke all on function public.service_has_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.timeout_result_from_fen(text, text) from public, anon, authenticated;
revoke all on function public.service_create_game(uuid, uuid, text, text, bigint, integer, boolean, text, text, text)
  from public, anon, authenticated;
revoke all on function public.service_join_game(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.service_submit_move(
  uuid, uuid, uuid, uuid, integer, uuid, text, text, text, text, text, text,
  text, text, text, text, text, text, integer, bigint
) from public, anon, authenticated;
revoke all on function public.service_game_action(uuid, uuid, integer, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.service_apply_game_ratings(uuid) from public, anon, authenticated;

grant execute on function public.service_has_role(uuid, text[]) to service_role;
grant execute on function public.service_create_game(uuid, uuid, text, text, bigint, integer, boolean, text, text, text)
  to service_role;
grant execute on function public.service_join_game(uuid, uuid, text, uuid) to service_role;
grant execute on function public.service_submit_move(
  uuid, uuid, uuid, uuid, integer, uuid, text, text, text, text, text, text,
  text, text, text, text, text, text, integer, bigint
) to service_role;
grant execute on function public.service_game_action(uuid, uuid, integer, uuid, text, text) to service_role;
grant execute on function public.service_apply_game_ratings(uuid) to service_role;
