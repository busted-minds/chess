-- Busted Minds Chess: durable Realtime publication, avatar storage, and health metadata.

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'games',
      'game_moves',
      'game_offers',
      'game_chat_messages',
      'matchmaking_tickets',
      'challenges',
      'tournaments',
      'tournament_entries',
      'tournament_rounds',
      'tournament_pairings',
      'tournament_messages',
      'direct_messages',
      'notifications'
    ]
    loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables pt
        where pt.pubname = 'supabase_realtime'
          and pt.schemaname = 'public'
          and pt.tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

-- The primary keys provide compact old-row identity for Realtime updates/deletes.
-- Transient online status and spectator presence belong in Realtime Presence/Broadcast,
-- not durable database rows or this publication.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and private.is_permanent_user()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.service_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'database_time', statement_timestamp(),
    'schema_version', '20260721000700',
    'active_games', (select count(*) from public.games g where g.status = 'active'),
    'queued_players', (select count(*) from public.matchmaking_tickets t where t.status = 'queued'),
    'realtime_publication', exists (
      select 1 from pg_catalog.pg_publication p where p.pubname = 'supabase_realtime'
    )
  );
$$;

revoke all on function public.service_health() from public, anon, authenticated;
grant execute on function public.service_health() to service_role;
