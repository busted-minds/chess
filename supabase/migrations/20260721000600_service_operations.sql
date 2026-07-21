-- Busted Minds Chess: service-only matchmaking, messaging, operations, and cleanup RPCs.

create or replace function public.service_house_move_context(
  p_actor_user_id uuid,
  p_game_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_house public.game_participants%rowtype;
  v_config private.house_player_configs%rowtype;
begin
  if not private.is_game_participant(p_game_id, p_actor_user_id) then
    raise exception using errcode = '42501', message = 'actor is not a game participant';
  end if;
  select g.* into v_game from public.games g where g.id = p_game_id;
  if not found or v_game.status <> 'active' or v_game.rated or v_game.bot_move_policy <> 'browser_legal' then
    raise exception using errcode = '42501', message = 'game is not eligible for browser-computed house moves';
  end if;
  select gp.* into v_house from public.game_participants gp
  where gp.game_id = p_game_id and gp.color = v_game.active_color and gp.participant_kind = 'house';
  if not found then
    raise exception using errcode = '55000', message = 'a house player is not the active participant';
  end if;
  select c.* into v_config from private.house_player_configs c
  where c.house_player_id = v_house.house_player_id and c.paused_at is null;
  if not found then
    raise exception using errcode = '55000', message = 'house player is unavailable';
  end if;
  return jsonb_build_object(
    'house_player_id', v_house.house_player_id,
    'engine_profile', v_config.engine_profile,
    'engine_version', v_config.engine_version,
    'difficulty', v_config.difficulty,
    'min_think_ms', v_config.min_think_ms,
    'max_think_ms', v_config.max_think_ms,
    'mistake_frequency', v_config.mistake_frequency,
    'risk_level', v_config.risk_level,
    'tactical_tendency', v_config.tactical_tendency,
    'positional_tendency', v_config.positional_tendency,
    'time_management', v_config.time_management,
    'opening_weights', v_config.opening_weights,
    'deterministic_seed', v_config.deterministic_seed,
    'expected_version', v_game.version
  );
end;
$$;

create or replace function public.service_get_game_mutation_response(
  p_actor_user_id uuid,
  p_game_id uuid,
  p_request_id uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request private.game_mutation_requests%rowtype;
begin
  if p_actor_user_id is null or p_game_id is null or p_request_id is null or p_request_hash is null then
    raise exception using errcode = '22023', message = 'invalid mutation lookup';
  end if;
  select mr.* into v_request from private.game_mutation_requests mr
  where mr.game_id = p_game_id and mr.request_id = p_request_id;
  if not found then
    return null;
  end if;
  if v_request.request_hash <> p_request_hash then
    raise exception using errcode = '22023', message = 'request id was reused with different input';
  end if;
  if not (
    (v_request.actor_kind = 'user' and v_request.actor_user_id = p_actor_user_id)
    or (v_request.actor_kind = 'house' and private.is_game_participant(p_game_id, p_actor_user_id))
  ) then
    raise exception using errcode = '42501', message = 'actor cannot inspect this mutation';
  end if;
  return v_request.response;
end;
$$;

create or replace function public.service_matchmake(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_variant text,
  p_rating_pool text,
  p_rated boolean,
  p_base_time_ms bigint,
  p_increment_ms integer,
  p_color_preference text,
  p_rating_range integer,
  p_allow_house_players boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_ticket public.matchmaking_tickets%rowtype;
  v_other public.matchmaking_tickets%rowtype;
  v_other_profile public.profiles%rowtype;
  v_house public.house_players%rowtype;
  v_rule private.matchmaking_rules%rowtype;
  v_game public.games%rowtype;
  v_actor_rating integer;
  v_actor_color text;
  v_other_color text;
  v_hash text;
  v_existing_hash text;
  v_response jsonb;
  v_inserted integer;
begin
  if p_actor_user_id is null or p_request_id is null
    or p_variant not in ('standard', 'chess960')
    or p_rating_pool not in ('bullet', 'blitz', 'rapid', 'classical', 'custom')
    or p_color_preference not in ('white', 'black', 'random')
    or p_base_time_ms < 0 or p_base_time_ms > 86400000
    or p_increment_ms < 0 or p_increment_ms > 600000
    or p_rating_range < 25 or p_rating_range > 2000 then
    raise exception using errcode = '22023', message = 'invalid matchmaking options';
  end if;
  if p_rated and (
    p_variant <> 'standard' or p_rating_pool = 'custom' or not private.is_permanent_user(p_actor_user_id)
  ) then
    raise exception using errcode = '42501', message = 'rated matchmaking requires a permanent account and standard pool';
  end if;
  select p.* into v_profile from public.profiles p
  where p.id = p_actor_user_id and p.status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'active profile required';
  end if;
  if exists (
    select 1 from private.user_sanctions s
    where s.user_id = p_actor_user_id and s.revoked_at is null
      and s.sanction_type in ('matchmaking_ban', 'account_ban')
      and s.starts_at <= statement_timestamp() and (s.ends_at is null or s.ends_at > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'matchmaking is unavailable for this account';
  end if;

  v_hash := encode(extensions.digest(concat_ws('|', p_variant, p_rating_pool, p_rated::text,
    p_base_time_ms::text, p_increment_ms::text, p_color_preference, p_rating_range::text,
    p_allow_house_players::text), 'sha256'), 'hex');
  select i.request_hash, i.response_body into v_existing_hash, v_response
  from private.idempotency_keys i
  where i.scope = 'matchmake' and i.actor_key = p_actor_user_id::text and i.request_id = p_request_id;
  if found then
    if v_existing_hash <> v_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    if v_response is null then
      raise exception using errcode = '55000', message = 'request is already in progress';
    end if;
    return v_response;
  end if;
  insert into private.idempotency_keys (scope, actor_key, request_id, request_hash, status, expires_at)
  values ('matchmake', p_actor_user_id::text, p_request_id, v_hash, 'processing',
    statement_timestamp() + interval '1 day')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception using errcode = '55000', message = 'request is already in progress';
  end if;

  v_actor_rating := coalesce((select r.rating from public.ratings r
    where r.user_id = p_actor_user_id and r.pool = nullif(p_rating_pool, 'custom')), 1200);

  select t.* into v_ticket from public.matchmaking_tickets t
  where t.user_id = p_actor_user_id and t.rating_pool = p_rating_pool
    and t.status in ('queued', 'offered')
  limit 1 for update;
  if found and v_ticket.expires_at <= statement_timestamp() then
    update public.matchmaking_tickets set status = 'expired' where id = v_ticket.id;
    v_ticket := null;
  end if;
  if v_ticket.id is not null and (
    v_ticket.variant <> p_variant or v_ticket.rated <> p_rated
    or v_ticket.base_time_ms <> p_base_time_ms or v_ticket.increment_ms <> p_increment_ms
  ) then
    raise exception using errcode = '55000', message = 'cancel the existing ticket before changing matchmaking options';
  end if;
  if v_ticket.id is null then
    insert into public.matchmaking_tickets (
      user_id, request_id, status, variant, rating_pool, rated, base_time_ms, increment_ms,
      color_preference, rating_at_queue, rating_range, allow_house_players
    ) values (
      p_actor_user_id, p_request_id, 'queued', p_variant, p_rating_pool, p_rated,
      p_base_time_ms, p_increment_ms, p_color_preference, v_actor_rating,
      p_rating_range, p_allow_house_players
    ) returning * into v_ticket;
  end if;

  select t.* into v_other
  from public.matchmaking_tickets t
  where t.id <> v_ticket.id
    and t.user_id <> p_actor_user_id
    and t.status = 'queued'
    and t.expires_at > statement_timestamp()
    and t.variant = p_variant
    and t.rating_pool = p_rating_pool
    and t.rated = p_rated
    and t.base_time_ms = p_base_time_ms
    and t.increment_ms = p_increment_ms
    and abs(t.rating_at_queue - v_ticket.rating_at_queue) <= greatest(t.rating_range, v_ticket.rating_range)
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = p_actor_user_id and b.blocked_id = t.user_id)
         or (b.blocker_id = t.user_id and b.blocked_id = p_actor_user_id)
    )
  order by t.queued_at
  limit 1 for update skip locked;

  if v_other.id is not null then
    select p.* into v_other_profile from public.profiles p where p.id = v_other.user_id and p.status = 'active';
    if not found then
      update public.matchmaking_tickets set status = 'cancelled' where id = v_other.id;
      v_other := null;
    end if;
  end if;

  if v_other.id is not null then
    v_actor_color := case
      when v_ticket.color_preference = 'white' and v_other.color_preference <> 'white' then 'white'
      when v_ticket.color_preference = 'black' and v_other.color_preference <> 'black' then 'black'
      when v_other.color_preference = 'white' and v_ticket.color_preference <> 'white' then 'black'
      when v_other.color_preference = 'black' and v_ticket.color_preference <> 'black' then 'white'
      when left(p_request_id::text, 1) < '8' then 'white' else 'black'
    end;
    v_other_color := case when v_actor_color = 'white' then 'black' else 'white' end;
    insert into public.games (
      variant, visibility, status, rated, rating_pool, matchmaking_source, bot_move_policy,
      initial_fen, current_fen, active_color, base_time_ms, white_time_ms, black_time_ms,
      increment_ms, turn_started_at, version, created_by
    ) values (
      p_variant, 'public', 'active', p_rated, nullif(p_rating_pool, 'custom'), 'public', 'none',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'white', p_base_time_ms, p_base_time_ms, p_base_time_ms,
      p_increment_ms, clock_timestamp(), 1, p_actor_user_id
    ) returning * into v_game;
    insert into public.game_participants (
      game_id, color, participant_kind, user_id, display_name_snapshot,
      avatar_url_snapshot, rating_snapshot, is_ready, last_connected_at
    ) values
      (v_game.id, v_actor_color, 'user', p_actor_user_id, v_profile.display_name,
        v_profile.avatar_url, v_ticket.rating_at_queue, true, statement_timestamp()),
      (v_game.id, v_other_color, 'user', v_other.user_id, v_other_profile.display_name,
        v_other_profile.avatar_url, v_other.rating_at_queue, true, statement_timestamp());
    update public.matchmaking_tickets set status = 'matched', matched_game_id = v_game.id
    where id in (v_ticket.id, v_other.id);
    v_response := jsonb_build_object(
      'status', 'matched', 'ticket_id', v_ticket.id, 'game_id', v_game.id,
      'share_id', v_game.share_id, 'color', v_actor_color, 'opponent_type', 'user',
      'version', v_game.version
    );
  else
    select r.* into v_rule from private.matchmaking_rules r where r.pool = p_rating_pool;
    if v_rule.pool is not null
      and p_allow_house_players and v_ticket.allow_house_players
      and v_rule.bot_fallback_enabled and v_rule.casual_bots_enabled
      and (not p_rated or v_rule.rated_bots_enabled)
      and statement_timestamp() >= v_ticket.queued_at + make_interval(secs => v_rule.fallback_wait_seconds) then
      select hp.* into v_house
      from public.house_players hp
      join private.house_player_configs hc on hc.house_player_id = hp.id
      where hp.is_enabled and hp.is_listed and hc.allow_matchmaking and hc.paused_at is null
        and (not p_rated or hc.allow_rated)
        and abs(hp.estimated_rating - v_ticket.rating_at_queue) <= least(
          v_rule.max_rating_range,
          greatest(v_ticket.rating_range,
            v_rule.initial_rating_range + floor(extract(epoch from (statement_timestamp() - v_ticket.queued_at))
              * v_rule.rating_range_growth_per_second)::integer)
        )
      order by abs(hp.estimated_rating - v_ticket.rating_at_queue), hp.id
      limit 1;
      if v_house.id is not null then
        v_actor_color := case
          when v_ticket.color_preference in ('white', 'black') then v_ticket.color_preference
          when left(p_request_id::text, 1) < '8' then 'white' else 'black'
        end;
        v_other_color := case when v_actor_color = 'white' then 'black' else 'white' end;
        insert into public.games (
          variant, visibility, status, rated, rating_pool, matchmaking_source, bot_move_policy,
          initial_fen, current_fen, active_color, base_time_ms, white_time_ms, black_time_ms,
          increment_ms, turn_started_at, version, created_by, metadata
        ) values (
          p_variant, 'public', 'active', p_rated, nullif(p_rating_pool, 'custom'), 'public',
          case when p_rated then 'deterministic_server' else 'browser_legal' end,
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          'white', p_base_time_ms, p_base_time_ms, p_base_time_ms,
          p_increment_ms, clock_timestamp(), 1, p_actor_user_id,
          jsonb_build_object('house_fallback', true)
        ) returning * into v_game;
        insert into public.game_participants (
          game_id, color, participant_kind, user_id, house_player_id, display_name_snapshot,
          avatar_url_snapshot, rating_snapshot, is_ready, last_connected_at
        ) values
          (v_game.id, v_actor_color, 'user', p_actor_user_id, null, v_profile.display_name,
            v_profile.avatar_url, v_ticket.rating_at_queue, true, statement_timestamp()),
          (v_game.id, v_other_color, 'house', null, v_house.id, v_house.display_name,
            v_house.avatar_path, v_house.estimated_rating, true, statement_timestamp());
        update public.matchmaking_tickets set status = 'matched', matched_game_id = v_game.id,
          matched_house_player_id = v_house.id where id = v_ticket.id;
        v_response := jsonb_build_object(
          'status', 'matched', 'ticket_id', v_ticket.id, 'game_id', v_game.id,
          'share_id', v_game.share_id, 'color', v_actor_color, 'opponent_type', 'house',
          'house_player_id', v_house.id, 'version', v_game.version
        );
      end if;
    end if;
    if v_response is null then
      v_response := jsonb_build_object(
        'status', 'queued', 'ticket_id', v_ticket.id, 'queued_at', v_ticket.queued_at,
        'expires_at', v_ticket.expires_at
      );
    end if;
  end if;

  update private.idempotency_keys set status = 'completed', response_code = 200,
    response_body = v_response, resource_type = case when v_game.id is null then 'matchmaking_ticket' else 'game' end,
    resource_id = coalesce(v_game.id::text, v_ticket.id::text)
  where scope = 'matchmake' and actor_key = p_actor_user_id::text and request_id = p_request_id;
  return v_response;
end;
$$;

-- Poll a specific durable ticket and advance the same queue operation. Holding
-- the ticket lock before re-entering service_matchmake prevents a concurrent
-- match from causing a polling request to create a second ticket.
create or replace function public.service_poll_matchmaking(
  p_actor_user_id uuid,
  p_ticket_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.matchmaking_tickets%rowtype;
  v_response jsonb;
begin
  if p_actor_user_id is null or p_ticket_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'invalid matchmaking poll';
  end if;

  select t.* into v_ticket
  from public.matchmaking_tickets t
  where t.id = p_ticket_id and t.user_id = p_actor_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ticket not found';
  end if;

  if v_ticket.status = 'matched' then
    return jsonb_build_object(
      'status', v_ticket.status,
      'ticket_id', v_ticket.id,
      'game_id', v_ticket.matched_game_id,
      'house_player_id', v_ticket.matched_house_player_id
    );
  end if;

  if v_ticket.status not in ('queued', 'offered') then
    return jsonb_build_object('status', v_ticket.status, 'ticket_id', v_ticket.id);
  end if;

  if v_ticket.expires_at <= statement_timestamp() then
    update public.matchmaking_tickets
    set status = 'expired'
    where id = v_ticket.id
    returning * into v_ticket;
    return jsonb_build_object('status', v_ticket.status, 'ticket_id', v_ticket.id);
  end if;

  v_response := public.service_matchmake(
    p_actor_user_id,
    p_request_id,
    v_ticket.variant,
    v_ticket.rating_pool,
    v_ticket.rated,
    v_ticket.base_time_ms,
    v_ticket.increment_ms,
    v_ticket.color_preference,
    v_ticket.rating_range,
    v_ticket.allow_house_players
  );
  return v_response;
end;
$$;

create or replace function public.service_cancel_matchmaking(
  p_actor_user_id uuid,
  p_ticket_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.matchmaking_tickets%rowtype;
  v_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  if p_actor_user_id is null or p_ticket_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'invalid cancellation request';
  end if;
  v_hash := encode(extensions.digest(p_ticket_id::text, 'sha256'), 'hex');
  select i.request_hash, i.response_body into v_existing_hash, v_response
  from private.idempotency_keys i where i.scope = 'cancel_matchmaking'
    and i.actor_key = p_actor_user_id::text and i.request_id = p_request_id;
  if found then
    if v_existing_hash <> v_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    return v_response;
  end if;
  select t.* into v_ticket from public.matchmaking_tickets t
  where t.id = p_ticket_id and t.user_id = p_actor_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ticket not found';
  end if;
  if v_ticket.status in ('queued', 'offered') then
    update public.matchmaking_tickets set status = 'cancelled' where id = p_ticket_id returning * into v_ticket;
  end if;
  v_response := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'status', v_ticket.status,
    'game_id', v_ticket.matched_game_id
  );
  insert into private.idempotency_keys (
    scope, actor_key, request_id, request_hash, status, response_code, response_body,
    resource_type, resource_id, expires_at
  ) values (
    'cancel_matchmaking', p_actor_user_id::text, p_request_id, v_hash, 'completed', 200,
    v_response, 'matchmaking_ticket', v_ticket.id::text, statement_timestamp() + interval '1 day'
  );
  return v_response;
end;
$$;

create or replace function public.service_send_game_chat(
  p_actor_user_id uuid,
  p_game_id uuid,
  p_request_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_message public.game_chat_messages%rowtype;
begin
  if p_actor_user_id is null or p_game_id is null or p_request_id is null
    or length(btrim(coalesce(p_body, ''))) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'invalid chat message';
  end if;
  if not private.is_game_participant(p_game_id, p_actor_user_id) then
    raise exception using errcode = '42501', message = 'only players may send game chat';
  end if;
  if exists (
    select 1 from private.user_sanctions s
    where s.user_id = p_actor_user_id and s.revoked_at is null
      and s.sanction_type in ('chat_mute', 'account_ban')
      and s.starts_at <= statement_timestamp() and (s.ends_at is null or s.ends_at > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'chat is unavailable for this account';
  end if;
  select m.* into v_message from public.game_chat_messages m
  where m.game_id = p_game_id and m.request_id = p_request_id;
  if found then
    if v_message.author_user_id <> p_actor_user_id or v_message.body <> btrim(p_body) then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    return jsonb_build_object('message_id', v_message.id, 'created_at', v_message.created_at, 'duplicate', true);
  end if;
  select p.* into v_profile from public.profiles p where p.id = p_actor_user_id and p.status = 'active';
  if not found then
    raise exception using errcode = '42501', message = 'active profile required';
  end if;
  insert into public.game_chat_messages (
    game_id, author_kind, author_user_id, author_name_snapshot, request_id, body
  ) values (
    p_game_id, 'user', p_actor_user_id, v_profile.display_name, p_request_id, btrim(p_body)
  ) returning * into v_message;
  return jsonb_build_object('message_id', v_message.id, 'created_at', v_message.created_at, 'duplicate', false);
end;
$$;

create or replace function public.service_submit_feedback(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_category text,
  p_message text,
  p_email text,
  p_page text,
  p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feedback public.feedback_messages%rowtype;
  v_category text;
  v_subject text;
begin
  if p_request_id is null or length(btrim(coalesce(p_message, ''))) not between 10 and 4000
    or (p_page is not null and length(p_page) > 500)
    or (p_ip_hash is not null and length(p_ip_hash) > 128) then
    raise exception using errcode = '22023', message = 'invalid feedback submission';
  end if;
  if p_actor_user_id is not null and not exists (
    select 1 from public.profiles p where p.id = p_actor_user_id and p.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'invalid actor';
  end if;
  select f.* into v_feedback from public.feedback_messages f where f.request_id = p_request_id;
  if found then
    if v_feedback.user_id is distinct from p_actor_user_id then
      raise exception using errcode = '22023', message = 'request id was reused';
    end if;
    return jsonb_build_object('feedback_id', v_feedback.id, 'status', v_feedback.status, 'duplicate', true);
  end if;
  v_category := case lower(coalesce(p_category, 'feedback'))
    when 'bug' then 'bug'
    when 'idea' then 'feature'
    when 'feature' then 'feature'
    when 'accessibility' then 'feature'
    when 'experience' then 'feedback'
    when 'feedback' then 'feedback'
    else 'contact'
  end;
  v_subject := left(initcap(coalesce(nullif(btrim(p_category), ''), 'Feedback'))
    || case when nullif(btrim(coalesce(p_page, '')), '') is null then '' else ' — ' || btrim(p_page) end, 160);
  insert into public.feedback_messages (
    user_id, request_id, email_hash, ip_hash, page, category, subject, body
  ) values (
    p_actor_user_id, p_request_id,
    case when nullif(btrim(coalesce(p_email, '')), '') is null then null
      else encode(extensions.digest(lower(btrim(p_email)), 'sha256'), 'hex') end,
    nullif(p_ip_hash, ''), nullif(left(coalesce(p_page, ''), 500), ''), v_category,
    v_subject, btrim(p_message)
  ) returning * into v_feedback;
  return jsonb_build_object('feedback_id', v_feedback.id, 'status', v_feedback.status, 'duplicate', false);
end;
$$;

create or replace function public.service_consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket private.rate_limit_buckets%rowtype;
  v_allowed boolean;
  v_retry_after integer;
begin
  if length(coalesce(p_bucket_key, '')) not between 8 and 256
    or p_limit < 1 or p_limit > 100000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'invalid rate-limit parameters';
  end if;
  insert into private.rate_limit_buckets (
    bucket_key, window_started_at, request_count, blocked_until, updated_at
  ) values (
    p_bucket_key, v_now, 1, null, v_now
  )
  on conflict (bucket_key) do update set
    window_started_at = case
      when private.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then v_now else private.rate_limit_buckets.window_started_at end,
    request_count = case
      when private.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then 1 else private.rate_limit_buckets.request_count + 1 end,
    blocked_until = case
      when private.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then null
      when private.rate_limit_buckets.request_count + 1 > p_limit
        then private.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds)
      else private.rate_limit_buckets.blocked_until end,
    updated_at = v_now
  returning * into v_bucket;

  v_allowed := v_bucket.request_count <= p_limit and (v_bucket.blocked_until is null or v_bucket.blocked_until <= v_now);
  v_retry_after := case when v_allowed then 0 else greatest(1,
    ceil(extract(epoch from (v_bucket.blocked_until - v_now)))::integer) end;
  return jsonb_build_object(
    'allowed', v_allowed,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_bucket.request_count),
    'reset_at', v_bucket.window_started_at + make_interval(secs => p_window_seconds),
    'retry_after_seconds', v_retry_after
  );
end;
$$;

create or replace function public.service_claim_draw(
  p_actor_user_id uuid,
  p_game_id uuid,
  p_expected_version integer,
  p_request_id uuid,
  p_termination text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_existing private.game_mutation_requests%rowtype;
  v_hash text;
  v_response jsonb;
begin
  if p_actor_user_id is null or p_game_id is null or p_request_id is null
    or p_expected_version < 0 or p_termination not in ('repetition', 'fifty_move') then
    raise exception using errcode = '22023', message = 'invalid draw claim';
  end if;
  v_hash := encode(extensions.digest(concat_ws('|', p_game_id::text, p_expected_version::text,
    p_termination), 'sha256'), 'hex');
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
  if v_game.status <> 'active' or v_game.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'game is not active at the expected version';
  end if;
  if not private.is_game_participant(p_game_id, p_actor_user_id) then
    raise exception using errcode = '42501', message = 'only a player may claim a draw';
  end if;
  -- The trusted route must replay the durable move list with chess.js before asserting p_termination.
  update public.games set status = 'completed', result = '1/2-1/2', termination = p_termination,
    ended_at = clock_timestamp(), turn_started_at = null, version = version + 1
  where id = p_game_id returning * into v_game;
  v_response := jsonb_build_object(
    'game_id', v_game.id, 'version', v_game.version, 'status', v_game.status,
    'result', v_game.result, 'termination', v_game.termination
  );
  insert into private.game_mutation_requests (
    game_id, request_id, actor_kind, actor_user_id, mutation_type,
    expected_version, request_hash, response, completed_at
  ) values (
    p_game_id, p_request_id, 'user', p_actor_user_id, 'draw', p_expected_version,
    v_hash, v_response, statement_timestamp()
  );
  if v_game.rated then
    perform public.service_apply_game_ratings(p_game_id);
  end if;
  return v_response;
end;
$$;

create or replace function public.service_admin_get_config(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(array['admin'], p_actor_user_id) then
    raise exception using errcode = '42501', message = 'administrator role required';
  end if;
  return jsonb_build_object(
    'feature_flags', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.key, 'description', f.description, 'enabled', f.enabled,
        'rollout_percent', f.rollout_percent, 'minimum_population', f.minimum_population,
        'public_config', f.public_config, 'updated_at', f.updated_at
      ) order by f.key), '[]'::jsonb) from public.feature_flags f
    ),
    'matchmaking_rules', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.pool), '[]'::jsonb)
      from private.matchmaking_rules r
    ),
    'house_players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', hp.id, 'slug', hp.slug, 'display_name', hp.display_name,
        'estimated_rating', hp.estimated_rating, 'is_enabled', hp.is_enabled,
        'is_listed', hp.is_listed, 'engine_profile', hc.engine_profile,
        'engine_version', hc.engine_version, 'difficulty', hc.difficulty,
        'allow_matchmaking', hc.allow_matchmaking, 'allow_tournaments', hc.allow_tournaments,
        'allow_rated', hc.allow_rated, 'rating_mode', hc.rating_mode,
        'paused_at', hc.paused_at, 'updated_at', hc.updated_at
      ) order by hp.estimated_rating, hp.slug), '[]'::jsonb)
      from public.house_players hp
      join private.house_player_configs hc on hc.house_player_id = hp.id
    ),
    'announcements', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.starts_at desc), '[]'::jsonb)
      from public.announcements a
    )
  );
end;
$$;

create or replace function public.service_admin_update_config(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_house_id uuid;
  v_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  if not private.has_role(array['admin'], p_actor_user_id) then
    raise exception using errcode = '42501', message = 'administrator role required';
  end if;
  if p_request_id is null or p_patch is null or jsonb_typeof(p_patch) <> 'object'
    or octet_length(p_patch::text) > 65536 then
    raise exception using errcode = '22023', message = 'invalid configuration patch';
  end if;
  v_hash := encode(extensions.digest(p_patch::text, 'sha256'), 'hex');
  select i.request_hash, i.response_body into v_existing_hash, v_response
  from private.idempotency_keys i where i.scope = 'admin_update_config'
    and i.actor_key = p_actor_user_id::text and i.request_id = p_request_id;
  if found then
    if v_existing_hash <> v_hash then
      raise exception using errcode = '22023', message = 'request id was reused with different input';
    end if;
    return v_response;
  end if;

  for v_key, v_value in
    select e.key, e.value from jsonb_each(coalesce(p_patch -> 'feature_flags', '{}'::jsonb)) e
  loop
    if jsonb_typeof(v_value) = 'boolean' then
      update public.feature_flags set enabled = (v_value::text)::boolean where key = v_key;
    elsif jsonb_typeof(v_value) = 'object' then
      update public.feature_flags set
        enabled = coalesce((v_value ->> 'enabled')::boolean, enabled),
        rollout_percent = coalesce((v_value ->> 'rollout_percent')::smallint, rollout_percent),
        minimum_population = coalesce((v_value ->> 'minimum_population')::integer, minimum_population),
        public_config = coalesce(v_value -> 'public_config', public_config)
      where key = v_key;
    else
      raise exception using errcode = '22023', message = 'feature flag patch must be a boolean or object';
    end if;
    if not found then
      raise exception using errcode = 'P0002', message = format('unknown feature flag: %s', v_key);
    end if;
  end loop;

  for v_key, v_value in
    select e.key, e.value from jsonb_each(coalesce(p_patch -> 'matchmaking_rules', '{}'::jsonb)) e
  loop
    update private.matchmaking_rules set
      bot_fallback_enabled = coalesce((v_value ->> 'bot_fallback_enabled')::boolean, bot_fallback_enabled),
      fallback_wait_seconds = coalesce((v_value ->> 'fallback_wait_seconds')::smallint, fallback_wait_seconds),
      initial_rating_range = coalesce((v_value ->> 'initial_rating_range')::integer, initial_rating_range),
      rating_range_growth_per_second = coalesce((v_value ->> 'rating_range_growth_per_second')::numeric, rating_range_growth_per_second),
      max_rating_range = coalesce((v_value ->> 'max_rating_range')::integer, max_rating_range),
      casual_bots_enabled = coalesce((v_value ->> 'casual_bots_enabled')::boolean, casual_bots_enabled),
      rated_bots_enabled = coalesce((v_value ->> 'rated_bots_enabled')::boolean, rated_bots_enabled),
      tournament_bots_enabled = coalesce((v_value ->> 'tournament_bots_enabled')::boolean, tournament_bots_enabled),
      max_bot_game_ratio = coalesce((v_value ->> 'max_bot_game_ratio')::numeric, max_bot_game_ratio)
    where pool = v_key;
    if not found then
      raise exception using errcode = 'P0002', message = format('unknown matchmaking pool: %s', v_key);
    end if;
  end loop;

  for v_key, v_value in
    select e.key, e.value from jsonb_each(coalesce(p_patch -> 'house_players', '{}'::jsonb)) e
  loop
    begin
      v_house_id := v_key::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = format('invalid house-player id: %s', v_key);
    end;
    update public.house_players set
      is_enabled = coalesce((v_value ->> 'is_enabled')::boolean, is_enabled),
      is_listed = coalesce((v_value ->> 'is_listed')::boolean, is_listed),
      estimated_rating = coalesce((v_value ->> 'estimated_rating')::integer, estimated_rating)
    where id = v_house_id;
    if not found then
      raise exception using errcode = 'P0002', message = format('unknown house player: %s', v_key);
    end if;
    update private.house_player_configs set
      difficulty = coalesce((v_value ->> 'difficulty')::smallint, difficulty),
      allow_matchmaking = coalesce((v_value ->> 'allow_matchmaking')::boolean, allow_matchmaking),
      allow_tournaments = coalesce((v_value ->> 'allow_tournaments')::boolean, allow_tournaments),
      allow_rated = coalesce((v_value ->> 'allow_rated')::boolean, allow_rated),
      rating_mode = coalesce(v_value ->> 'rating_mode', rating_mode),
      paused_at = case
        when v_value ? 'paused' and (v_value ->> 'paused')::boolean then statement_timestamp()
        when v_value ? 'paused' then null
        else paused_at
      end
    where house_player_id = v_house_id;
  end loop;

  if p_patch ? 'maintenance_mode' then
    update public.feature_flags set enabled = (p_patch ->> 'maintenance_mode')::boolean
    where key = 'maintenance_mode';
    if not found then
      raise exception using errcode = 'P0002', message = 'maintenance_mode feature flag is not configured';
    end if;
  end if;

  if p_patch ? 'announcement' then
    v_value := p_patch -> 'announcement';
    if jsonb_typeof(v_value) <> 'object'
      or nullif(btrim(v_value ->> 'slug'), '') is null
      or nullif(btrim(v_value ->> 'title'), '') is null
      or nullif(btrim(v_value ->> 'body'), '') is null then
      raise exception using errcode = '22023', message = 'announcement requires slug, title, and body';
    end if;
    insert into public.announcements (
      slug, title, body, severity, starts_at, ends_at, is_published
    ) values (
      (v_value ->> 'slug')::extensions.citext,
      left(btrim(v_value ->> 'title'), 120),
      left(btrim(v_value ->> 'body'), 1000),
      coalesce(v_value ->> 'severity', 'info'),
      coalesce((v_value ->> 'starts_at')::timestamptz, statement_timestamp()),
      (v_value ->> 'ends_at')::timestamptz,
      coalesce((v_value ->> 'is_published')::boolean, false)
    )
    on conflict (slug) do update set
      title = excluded.title,
      body = excluded.body,
      severity = excluded.severity,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      is_published = excluded.is_published;
  end if;

  insert into private.audit_log (
    actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    p_actor_user_id, 'admin', 'platform.config.update', 'platform', 'global', p_request_id,
    jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k))
  );
  v_response := public.service_admin_get_config(p_actor_user_id);
  insert into private.idempotency_keys (
    scope, actor_key, request_id, request_hash, status, response_code, response_body,
    resource_type, resource_id, expires_at
  ) values (
    'admin_update_config', p_actor_user_id::text, p_request_id, v_hash, 'completed', 200,
    v_response, 'platform_config', 'global', statement_timestamp() + interval '7 days'
  );
  return v_response;
end;
$$;

create or replace function public.service_cleanup_expired_data(
  p_requested_by text,
  p_batch_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_run_id uuid;
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_counts jsonb := '{}'::jsonb;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'cleanup batch size must be between 1 and 5000';
  end if;
  if nullif(p_requested_by, '') is not null and p_requested_by <> 'system' then
    begin
      v_actor := p_requested_by::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'invalid cleanup requester';
    end;
    if not private.has_role(array['admin'], v_actor) then
      raise exception using errcode = '42501', message = 'administrator role required';
    end if;
  end if;

  insert into private.cleanup_runs (requested_by) values (v_actor) returning id into v_run_id;

  with doomed as (
    select i.scope, i.actor_key, i.request_id from private.idempotency_keys i
    where i.expires_at <= v_now order by i.expires_at limit p_batch_size
  )
  delete from private.idempotency_keys i using doomed d
  where i.scope = d.scope and i.actor_key = d.actor_key and i.request_id = d.request_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('idempotency_keys', v_count);

  with doomed as (
    select mr.game_id, mr.request_id from private.game_mutation_requests mr
    where mr.created_at < v_now - interval '7 days'
    order by mr.created_at limit p_batch_size
  )
  delete from private.game_mutation_requests mr using doomed d
  where mr.game_id = d.game_id and mr.request_id = d.request_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('game_mutation_requests', v_count);

  with expired as (
    select t.id from public.matchmaking_tickets t
    where t.status in ('queued', 'offered') and t.expires_at <= v_now
    order by t.expires_at limit p_batch_size
  )
  update public.matchmaking_tickets t set status = 'expired'
  from expired e where t.id = e.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('matchmaking_expired', v_count);

  with doomed as (
    select t.id from public.matchmaking_tickets t
    where t.status in ('cancelled', 'expired') and t.updated_at < v_now - interval '7 days'
    order by t.updated_at limit p_batch_size
  )
  delete from public.matchmaking_tickets t using doomed d where t.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('matchmaking_deleted', v_count);

  with expired as (
    select c.id from public.challenges c where c.status = 'open' and c.expires_at <= v_now
    order by c.expires_at limit p_batch_size
  )
  update public.challenges c set status = 'expired' from expired e where c.id = e.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('challenges_expired', v_count);

  with doomed as (
    select gi.id from private.game_invites gi
    where gi.expires_at <= v_now or gi.revoked_at is not null
    order by gi.expires_at limit p_batch_size
  )
  delete from private.game_invites gi using doomed d where gi.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('game_invites', v_count);

  with doomed as (
    select b.bucket_key from private.rate_limit_buckets b
    where b.updated_at < v_now - interval '2 days'
    order by b.updated_at limit p_batch_size
  )
  delete from private.rate_limit_buckets b using doomed d where b.bucket_key = d.bucket_key;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('rate_limit_buckets', v_count);

  with doomed as (
    select n.id from public.notifications n
    where (n.expires_at is not null and n.expires_at <= v_now)
      or (n.read_at is not null and n.read_at < v_now - interval '90 days')
    order by n.created_at limit p_batch_size
  )
  delete from public.notifications n using doomed d where n.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('notifications', v_count);

  with doomed as (
    select a.id from public.activity_feed_items a
    where (a.expires_at is not null and a.expires_at <= v_now)
      or (not a.curated and a.published_at < v_now - interval '90 days')
    order by a.published_at limit p_batch_size
  )
  delete from public.activity_feed_items a using doomed d where a.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('activity_feed_items', v_count);

  with doomed as (
    select m.id from public.game_chat_messages m
    join public.games g on g.id = m.game_id
    where g.ended_at < v_now - interval '90 days'
    order by m.created_at limit p_batch_size
  )
  delete from public.game_chat_messages m using doomed d where m.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('game_chat_messages', v_count);

  with doomed as (
    select g.id from public.games g
    join auth.users u on u.id = g.created_by and coalesce(u.is_anonymous, false)
    where not g.rated
      and not exists (select 1 from public.tournament_pairings tp where tp.game_id = g.id)
      and (
        (g.status = 'pending' and g.created_at < v_now - interval '1 day')
        or (g.status = 'active' and g.move_count = 0 and g.updated_at < v_now - interval '1 day')
        or (g.status = 'aborted' and g.ended_at < v_now - interval '7 days')
      )
    order by g.created_at limit p_batch_size
  )
  delete from public.games g using doomed d where g.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('abandoned_guest_games', v_count);

  with doomed as (
    select a.id from private.audit_log a where a.created_at < v_now - interval '180 days'
    order by a.created_at limit p_batch_size
  )
  delete from private.audit_log a using doomed d where a.id = d.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('audit_log', v_count);

  update private.cleanup_runs set completed_at = clock_timestamp(), deleted_counts = v_counts
  where id = v_run_id;
  return jsonb_build_object('run_id', v_run_id, 'completed_at', clock_timestamp(), 'counts', v_counts);
end;
$$;

revoke all on function public.service_house_move_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_get_game_mutation_response(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.service_matchmake(uuid, uuid, text, text, boolean, bigint, integer, text, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.service_poll_matchmaking(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_cancel_matchmaking(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_send_game_chat(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.service_submit_feedback(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.service_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.service_claim_draw(uuid, uuid, integer, uuid, text) from public, anon, authenticated;
revoke all on function public.service_admin_get_config(uuid) from public, anon, authenticated;
revoke all on function public.service_admin_update_config(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.service_cleanup_expired_data(text, integer) from public, anon, authenticated;

grant execute on function public.service_house_move_context(uuid, uuid) to service_role;
grant execute on function public.service_get_game_mutation_response(uuid, uuid, uuid, text) to service_role;
grant execute on function public.service_matchmake(uuid, uuid, text, text, boolean, bigint, integer, text, integer, boolean)
  to service_role;
grant execute on function public.service_poll_matchmaking(uuid, uuid, uuid) to service_role;
grant execute on function public.service_cancel_matchmaking(uuid, uuid, uuid) to service_role;
grant execute on function public.service_send_game_chat(uuid, uuid, uuid, text) to service_role;
grant execute on function public.service_submit_feedback(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.service_consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.service_claim_draw(uuid, uuid, integer, uuid, text) to service_role;
grant execute on function public.service_admin_get_config(uuid) to service_role;
grant execute on function public.service_admin_update_config(uuid, uuid, jsonb) to service_role;
grant execute on function public.service_cleanup_expired_data(text, integer) to service_role;
