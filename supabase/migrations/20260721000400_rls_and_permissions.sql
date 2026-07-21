-- Busted Minds Chess: centralized authorization helpers, RLS, and column privileges.

create or replace function private.is_permanent_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and not coalesce(u.is_anonymous, false)
      and u.deleted_at is null
  );
$$;

create or replace function private.has_role(p_roles text[], p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles r
    where r.user_id = p_user_id
      and r.role = any(p_roles)
  );
$$;

create or replace function private.is_profile_visible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.status = 'active'
      and (p.is_public or p.id = auth.uid())
  );
$$;

create or replace function private.is_game_participant(p_game_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.game_participants gp
    where gp.game_id = p_game_id
      and gp.participant_kind = 'user'
      and gp.user_id = p_user_id
  );
$$;

create or replace function private.can_view_game(p_game_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    where g.id = p_game_id
      and (
        g.visibility in ('public', 'unlisted')
        or private.is_game_participant(g.id, p_user_id)
        or exists (
          select 1
          from public.game_spectator_access sa
          where sa.game_id = g.id
            and sa.user_id = p_user_id
            and sa.permission = 'allowed'
        )
        or private.has_role(array['admin', 'moderator'], p_user_id)
      )
  );
$$;

create or replace function private.is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_permanent_user(p_user_id) and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
      and cm.left_at is null
  );
$$;

create or replace function private.is_club_member(p_club_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_permanent_user(p_user_id) and exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = p_user_id
      and cm.status = 'active'
  );
$$;

create or replace function private.are_friends(p_first uuid, p_second uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_first is not null and p_second is not null and exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_first and f.addressee_id = p_second)
        or (f.requester_id = p_second and f.addressee_id = p_first))
  );
$$;

create or replace function private.can_view_tournament(p_tournament_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = p_tournament_id
      and (
        t.visibility in ('public', 'unlisted')
        or t.organizer_id = p_user_id
        or (t.club_id is not null and private.is_club_member(t.club_id, p_user_id))
        or exists (
          select 1 from public.tournament_entries te
          where te.tournament_id = t.id and te.user_id = p_user_id
        )
        or private.has_role(array['admin', 'moderator'], p_user_id)
      )
  );
$$;

create or replace function private.can_view_collection(p_collection_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_collections c
    where c.id = p_collection_id
      and (c.visibility in ('public', 'unlisted') or c.owner_id = p_user_id)
  );
$$;

create or replace function private.can_view_study(p_study_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studies s
    where s.id = p_study_id
      and (s.visibility in ('public', 'unlisted') or s.owner_id = p_user_id)
  );
$$;

revoke all on function private.is_permanent_user(uuid) from public, anon;
revoke all on function private.has_role(text[], uuid) from public;
revoke all on function private.is_profile_visible(uuid) from public;
revoke all on function private.is_game_participant(uuid, uuid) from public;
revoke all on function private.can_view_game(uuid, uuid) from public;
revoke all on function private.is_conversation_member(uuid, uuid) from public, anon;
revoke all on function private.is_club_member(uuid, uuid) from public;
revoke all on function private.are_friends(uuid, uuid) from public, anon;
revoke all on function private.can_view_tournament(uuid, uuid) from public;
revoke all on function private.can_view_collection(uuid, uuid) from public;
revoke all on function private.can_view_study(uuid, uuid) from public;

grant execute on function private.is_permanent_user(uuid) to authenticated;
grant execute on function private.has_role(text[], uuid) to anon, authenticated;
grant execute on function private.is_profile_visible(uuid) to anon, authenticated;
grant execute on function private.is_game_participant(uuid, uuid) to anon, authenticated;
grant execute on function private.can_view_game(uuid, uuid) to anon, authenticated;
grant execute on function private.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function private.is_club_member(uuid, uuid) to anon, authenticated;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.can_view_tournament(uuid, uuid) to anon, authenticated;
grant execute on function private.can_view_collection(uuid, uuid) to anon, authenticated;
grant execute on function private.can_view_study(uuid, uuid) to anon, authenticated;

-- Reset all exposed privileges before granting a deliberately narrow client surface.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public, extensions to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant update (username, display_name, avatar_url, country_code, bio, is_public, locale, last_seen_at)
  on public.profiles to authenticated;
grant update on public.profile_preferences to authenticated;

-- Public profiles and private preferences.
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles for select
using (
  (status = 'active' and is_public)
  or id = auth.uid()
  or private.has_role(array['admin', 'moderator'])
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and status = 'active')
with check (id = auth.uid() and status = 'active');

drop policy if exists profile_preferences_select_self on public.profile_preferences;
create policy profile_preferences_select_self on public.profile_preferences for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin']));
drop policy if exists profile_preferences_update_self on public.profile_preferences;
create policy profile_preferences_update_self on public.profile_preferences for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists house_players_select_listed on public.house_players;
create policy house_players_select_listed on public.house_players for select
using ((is_enabled and is_listed) or private.has_role(array['admin', 'moderator']));

drop policy if exists feature_flags_select_public on public.feature_flags;
create policy feature_flags_select_public on public.feature_flags for select
using (true);

drop policy if exists announcements_select_active on public.announcements;
create policy announcements_select_active on public.announcements for select
using (
  (is_published and starts_at <= statement_timestamp() and (ends_at is null or ends_at > statement_timestamp()))
  or private.has_role(array['admin', 'moderator'])
);

-- Games and all durable game-channel rows share one access predicate.
drop policy if exists games_select_permitted on public.games;
create policy games_select_permitted on public.games for select
using (private.can_view_game(id));

drop policy if exists challenges_select_permitted on public.challenges;
create policy challenges_select_permitted on public.challenges for select
using (
  challenger_id = auth.uid()
  or challenged_user_id = auth.uid()
  or (visibility = 'unlisted' and status = 'open')
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists game_participants_select_permitted on public.game_participants;
create policy game_participants_select_permitted on public.game_participants for select
using (private.can_view_game(game_id));

drop policy if exists game_spectator_access_select_permitted on public.game_spectator_access;
create policy game_spectator_access_select_permitted on public.game_spectator_access for select
using (
  user_id = auth.uid()
  or private.is_game_participant(game_id)
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists game_moves_select_permitted on public.game_moves;
create policy game_moves_select_permitted on public.game_moves for select
using (private.can_view_game(game_id));

drop policy if exists game_offers_select_permitted on public.game_offers;
create policy game_offers_select_permitted on public.game_offers for select
using (private.is_game_participant(game_id) or private.has_role(array['admin', 'moderator']));

drop policy if exists game_chat_select_permitted on public.game_chat_messages;
create policy game_chat_select_permitted on public.game_chat_messages for select
using (
  private.can_view_game(game_id)
  and (moderation_state = 'visible' or author_user_id = auth.uid() or private.has_role(array['admin', 'moderator']))
);

drop policy if exists matchmaking_tickets_select_self on public.matchmaking_tickets;
create policy matchmaking_tickets_select_self on public.matchmaking_tickets for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin', 'moderator']));

drop policy if exists ratings_select_visible on public.ratings;
create policy ratings_select_visible on public.ratings for select
using (
  owner_kind = 'house'
  or user_id = auth.uid()
  or private.is_profile_visible(user_id)
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists rating_events_select_visible on public.rating_events;
create policy rating_events_select_visible on public.rating_events for select
using (
  owner_kind = 'house'
  or user_id = auth.uid()
  or private.is_profile_visible(user_id)
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists seasons_select_all on public.seasons;
create policy seasons_select_all on public.seasons for select using (true);
drop policy if exists season_standings_select_all on public.season_standings;
create policy season_standings_select_all on public.season_standings for select using (true);

-- Permanent-account social data.
drop policy if exists friendships_select_involved on public.friendships;
create policy friendships_select_involved on public.friendships for select to authenticated
using (
  private.is_permanent_user()
  and (requester_id = auth.uid() or addressee_id = auth.uid() or private.has_role(array['admin', 'moderator']))
);

drop policy if exists user_blocks_select_owner on public.user_blocks;
create policy user_blocks_select_owner on public.user_blocks for select to authenticated
using (private.is_permanent_user() and (blocker_id = auth.uid() or private.has_role(array['admin', 'moderator'])));

drop policy if exists user_mutes_select_owner on public.user_mutes;
create policy user_mutes_select_owner on public.user_mutes for select to authenticated
using (private.is_permanent_user() and (muter_id = auth.uid() or private.has_role(array['admin', 'moderator'])));

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select to authenticated
using (private.is_conversation_member(id) or private.has_role(array['admin', 'moderator']));

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members for select to authenticated
using (private.is_conversation_member(conversation_id) or private.has_role(array['admin', 'moderator']));

drop policy if exists direct_messages_select_member on public.direct_messages;
create policy direct_messages_select_member on public.direct_messages for select to authenticated
using (
  (private.is_conversation_member(conversation_id)
    and (moderation_state = 'visible' or author_id = auth.uid()))
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists clubs_select_permitted on public.clubs;
create policy clubs_select_permitted on public.clubs for select
using (
  (is_active and visibility in ('public', 'unlisted'))
  or owner_id = auth.uid()
  or private.is_club_member(id)
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists club_members_select_permitted on public.club_members;
create policy club_members_select_permitted on public.club_members for select
using (
  user_id = auth.uid()
  or private.is_club_member(club_id)
  or exists (select 1 from public.clubs c where c.id = club_id and c.visibility = 'public' and c.is_active)
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists club_messages_select_permitted on public.club_messages;
create policy club_messages_select_permitted on public.club_messages for select
using (
  (private.is_club_member(club_id) and moderation_state = 'visible')
  or author_id = auth.uid()
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists activity_feed_select_permitted on public.activity_feed_items;
create policy activity_feed_select_permitted on public.activity_feed_items for select
using (
  (visibility = 'public' and (expires_at is null or expires_at > statement_timestamp()))
  or actor_user_id = auth.uid()
  or (visibility = 'friends' and private.are_friends(actor_user_id, auth.uid()))
  or (visibility = 'club' and club_id is not null and private.is_club_member(club_id))
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists game_reactions_select_permitted on public.game_reactions;
create policy game_reactions_select_permitted on public.game_reactions for select
using (private.can_view_game(game_id));

drop policy if exists game_favorites_select_self on public.game_favorites;
create policy game_favorites_select_self on public.game_favorites for select to authenticated
using (user_id = auth.uid());

drop policy if exists game_collections_select_permitted on public.game_collections;
create policy game_collections_select_permitted on public.game_collections for select
using (visibility in ('public', 'unlisted') or owner_id = auth.uid());

drop policy if exists game_collection_items_select_permitted on public.game_collection_items;
create policy game_collection_items_select_permitted on public.game_collection_items for select
using (private.can_view_collection(collection_id));

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin', 'moderator']));

drop policy if exists user_reports_select_permitted on public.user_reports;
create policy user_reports_select_permitted on public.user_reports for select to authenticated
using (reporter_id = auth.uid() or private.has_role(array['admin', 'moderator']));

drop policy if exists feedback_select_permitted on public.feedback_messages;
create policy feedback_select_permitted on public.feedback_messages for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin', 'support']));

-- Public events and tournaments; private/club events inherit tournament visibility.
drop policy if exists scheduled_events_select_permitted on public.scheduled_events;
create policy scheduled_events_select_permitted on public.scheduled_events for select
using (visibility in ('public', 'unlisted') or private.has_role(array['admin', 'moderator']));

drop policy if exists tournaments_select_permitted on public.tournaments;
create policy tournaments_select_permitted on public.tournaments for select
using (private.can_view_tournament(id));

drop policy if exists tournament_entries_select_permitted on public.tournament_entries;
create policy tournament_entries_select_permitted on public.tournament_entries for select
using (private.can_view_tournament(tournament_id));

drop policy if exists tournament_rounds_select_permitted on public.tournament_rounds;
create policy tournament_rounds_select_permitted on public.tournament_rounds for select
using (private.can_view_tournament(tournament_id));

drop policy if exists tournament_pairings_select_permitted on public.tournament_pairings;
create policy tournament_pairings_select_permitted on public.tournament_pairings for select
using (private.can_view_tournament(tournament_id));

drop policy if exists tournament_messages_select_permitted on public.tournament_messages;
create policy tournament_messages_select_permitted on public.tournament_messages for select
using (
  private.can_view_tournament(tournament_id)
  and (moderation_state = 'visible' or author_user_id = auth.uid() or private.has_role(array['admin', 'moderator']))
);

-- Training and progression.
drop policy if exists puzzles_select_published on public.puzzles;
create policy puzzles_select_published on public.puzzles for select
using (status = 'published' or private.has_role(array['admin', 'moderator']));

drop policy if exists puzzle_attempts_select_self on public.puzzle_attempts;
create policy puzzle_attempts_select_self on public.puzzle_attempts for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin']));

drop policy if exists opening_lines_select_published on public.opening_lines;
create policy opening_lines_select_published on public.opening_lines for select
using (is_published or private.has_role(array['admin', 'moderator']));

drop policy if exists lessons_select_published on public.lessons;
create policy lessons_select_published on public.lessons for select
using (is_published or private.has_role(array['admin', 'moderator']));

drop policy if exists lesson_progress_select_self on public.lesson_progress;
create policy lesson_progress_select_self on public.lesson_progress for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin']));

drop policy if exists studies_select_permitted on public.studies;
create policy studies_select_permitted on public.studies for select
using (visibility in ('public', 'unlisted') or owner_id = auth.uid() or private.has_role(array['admin', 'moderator']));

drop policy if exists study_nodes_select_permitted on public.study_nodes;
create policy study_nodes_select_permitted on public.study_nodes for select
using (private.can_view_study(study_id));

drop policy if exists saved_analyses_select_self on public.saved_analyses;
create policy saved_analyses_select_self on public.saved_analyses for select to authenticated
using (owner_id = auth.uid() or private.has_role(array['admin']));

drop policy if exists achievements_select_active on public.achievements;
create policy achievements_select_active on public.achievements for select
using (is_active or private.has_role(array['admin', 'moderator']));

drop policy if exists user_achievements_select_visible on public.user_achievements;
create policy user_achievements_select_visible on public.user_achievements for select
using (
  user_id = auth.uid()
  or (earned_at is not null and private.is_profile_visible(user_id))
  or private.has_role(array['admin', 'moderator'])
);

drop policy if exists missions_select_active on public.missions;
create policy missions_select_active on public.missions for select
using (is_active or private.has_role(array['admin', 'moderator']));

drop policy if exists user_missions_select_self on public.user_missions;
create policy user_missions_select_self on public.user_missions for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin']));

drop policy if exists user_progress_events_select_self on public.user_progress_events;
create policy user_progress_events_select_self on public.user_progress_events for select to authenticated
using (user_id = auth.uid() or private.has_role(array['admin']));
