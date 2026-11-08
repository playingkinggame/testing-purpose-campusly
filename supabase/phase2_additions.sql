-- =====================================================================
-- CAMPUSLY — PHASE 2 ADDITIONS
-- Run AFTER phase1_database.sql. Safe to run again and again.
-- Supabase Dashboard -> SQL Editor -> New query -> paste ALL -> Run.
--
-- IMPORTANT: phase1_database.sql deletes ALL policies when you re-run it.
-- If you ever re-run phase 1, run this file again afterwards.
--
-- What this adds:
--   1  notifications (+ triggers)            5  discover_people (match %)
--   2  teammate_invites                      6  chat helpers (list, unread, seen)
--   3  senior_questions                      7  admin report tools
--   4  small helpers (username, blocked)     8  teammate matching
-- Rules used everywhere: RLS on, search_path = '', execute only for
-- signed-in users (never anon / public), column grants as narrow as possible.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. NOTIFICATIONS
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('connection_request','connection_accepted','teammate_invite','senior_question','senior_answer')),
  actor_id   uuid references public.profiles(id) on delete set null,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;   -- rows are created only by triggers


-- ---------------------------------------------------------------------
-- 2. TEAMMATE INVITES
-- ---------------------------------------------------------------------
create table if not exists public.teammate_invites (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.teammate_posts(id) on delete cascade,
  from_user  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  message    text check (message is null or char_length(message) <= 300),
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  constraint teammate_invites_not_self check (from_user <> to_user),
  constraint teammate_invites_once unique (post_id, to_user)
);
create index if not exists teammate_invites_to_idx   on public.teammate_invites (to_user, status);
create index if not exists teammate_invites_from_idx on public.teammate_invites (from_user, created_at desc);
alter table public.teammate_invites enable row level security;

drop policy if exists teammate_invites_select on public.teammate_invites;
drop policy if exists teammate_invites_insert on public.teammate_invites;
drop policy if exists teammate_invites_update on public.teammate_invites;
drop policy if exists teammate_invites_delete on public.teammate_invites;

create policy teammate_invites_select on public.teammate_invites for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
-- only the author of the post can invite, and never someone blocked
create policy teammate_invites_insert on public.teammate_invites for insert to authenticated
  with check (
    from_user = auth.uid()
    and status = 'pending'
    and not public.is_blocked(from_user, to_user)
    and exists (select 1 from public.teammate_posts t where t.id = post_id and t.author_id = auth.uid())
  );
-- only the invited person answers, only while pending
create policy teammate_invites_update on public.teammate_invites for update to authenticated
  using (to_user = auth.uid() and status = 'pending')
  with check (to_user = auth.uid() and status in ('accepted','declined'));
create policy teammate_invites_delete on public.teammate_invites for delete to authenticated
  using (from_user = auth.uid() and status = 'pending');

revoke all on public.teammate_invites from anon, authenticated;
grant select, delete on public.teammate_invites to authenticated;
grant insert (post_id, to_user, message) on public.teammate_invites to authenticated;
grant update (status) on public.teammate_invites to authenticated;

create or replace trigger trg_90_teammate_invites_limit
  before insert on public.teammate_invites
  for each row execute function public.limit_inserts('from_user', '20', '1 day');


-- ---------------------------------------------------------------------
-- 3. SENIOR QUESTIONS (juniors ask seniors from an earlier batch)
-- ---------------------------------------------------------------------
create or replace function public.is_senior_of_me(p_senior uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and p_senior <> auth.uid()
     and exists (
       select 1 from public.profiles s
       join public.profiles me on me.id = auth.uid()
       where s.id = p_senior and s.onboarded and me.batch is not null and s.batch < me.batch
     )
$$;

create table if not exists public.senior_questions (
  id          uuid primary key default gen_random_uuid(),
  asker_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  senior_id   uuid not null references public.profiles(id) on delete cascade,
  question    text not null check (char_length(btrim(question)) between 5 and 500),
  answer      text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  answered_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint senior_questions_not_self check (asker_id <> senior_id)
);
create index if not exists senior_questions_senior_idx on public.senior_questions (senior_id, created_at desc);
create index if not exists senior_questions_asker_idx  on public.senior_questions (asker_id, created_at desc);
alter table public.senior_questions enable row level security;

drop policy if exists senior_questions_select on public.senior_questions;
drop policy if exists senior_questions_insert on public.senior_questions;
drop policy if exists senior_questions_update on public.senior_questions;
drop policy if exists senior_questions_delete on public.senior_questions;

create policy senior_questions_select on public.senior_questions for select to authenticated
  using ((asker_id = auth.uid() or senior_id = auth.uid()) and not public.is_blocked(asker_id, senior_id));
create policy senior_questions_insert on public.senior_questions for insert to authenticated
  with check (asker_id = auth.uid() and public.is_senior_of_me(senior_id) and not public.is_blocked(asker_id, senior_id));
create policy senior_questions_update on public.senior_questions for update to authenticated
  using (senior_id = auth.uid()) with check (senior_id = auth.uid());
create policy senior_questions_delete on public.senior_questions for delete to authenticated
  using (asker_id = auth.uid());

revoke all on public.senior_questions from anon, authenticated;
grant select, delete on public.senior_questions to authenticated;
grant insert (senior_id, question) on public.senior_questions to authenticated;
grant update (answer) on public.senior_questions to authenticated;   -- only the senior's answer can change

create or replace function public.senior_questions_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.answered_at := case when new.answer is not null then now() else null end;
  return new;
end $$;
create or replace trigger trg_senior_questions_guard
  before update on public.senior_questions
  for each row execute function public.senior_questions_before_update();

create or replace trigger trg_90_senior_questions_limit
  before insert on public.senior_questions
  for each row execute function public.limit_inserts('asker_id', '5', '1 day');


-- ---------------------------------------------------------------------
-- 1b. NOTIFICATION TRIGGERS (after the tables above exist)
-- ---------------------------------------------------------------------
create or replace function public.notify_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'connections' then
    if tg_op = 'INSERT' and new.status = 'pending' then
      insert into public.notifications (user_id, kind, actor_id, ref_id)
        values (new.addressee_id, 'connection_request', new.requester_id, new.id);
    elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
      insert into public.notifications (user_id, kind, actor_id, ref_id)
        values (new.requester_id, 'connection_accepted', new.addressee_id, new.id);
    end if;
  elsif tg_table_name = 'teammate_invites' and tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, actor_id, ref_id)
      values (new.to_user, 'teammate_invite', new.from_user, new.post_id);
  elsif tg_table_name = 'senior_questions' then
    if tg_op = 'INSERT' then
      insert into public.notifications (user_id, kind, actor_id, ref_id)
        values (new.senior_id, 'senior_question', new.asker_id, new.id);
    elsif tg_op = 'UPDATE' and new.answer is not null and old.answer is null then
      insert into public.notifications (user_id, kind, actor_id, ref_id)
        values (new.asker_id, 'senior_answer', new.senior_id, new.id);
    end if;
  end if;
  return null;
end $$;

create or replace trigger trg_notify_connections
  after insert or update on public.connections
  for each row execute function public.notify_events();
create or replace trigger trg_notify_invites
  after insert on public.teammate_invites
  for each row execute function public.notify_events();
create or replace trigger trg_notify_seniors
  after insert or update on public.senior_questions
  for each row execute function public.notify_events();


-- ---------------------------------------------------------------------
-- 4. SMALL HELPERS
-- ---------------------------------------------------------------------
-- Is this username free? (also sees people who have not finished onboarding)
create or replace function public.is_username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and not exists (
       select 1 from public.profiles
       where lower(username) = lower(btrim(p_username)) and id <> auth.uid()
     )
$$;

-- People I blocked (the profiles_public view hides them, so the block list needs this)
drop function if exists public.list_blocked_users();
create or replace function public.list_blocked_users()
returns table (blocked_id uuid, username text, full_name text, avatar_path text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, p.username, p.full_name, p.avatar_path, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;


-- ---------------------------------------------------------------------
-- 5. DISCOVER: "people you may vibe with"
--    Reads profile data ONLY from profiles_public. Reads connections only to
--    count mutual friends and to show request status (never returns other
--    people's connection lists).
--    Score (max 99): same branch 25 · shared clubs 15 each (max 30) ·
--    same hostel block 10 · shared interests 8 each (max 32) ·
--    mutual friends 6 each (max 18) · same batch 5 · same school 5 ·
--    shared languages 3 each (max 6)
-- ---------------------------------------------------------------------
drop function if exists public.discover_people(smallint, text, text, text, text, text, boolean, integer, integer);
create or replace function public.discover_people(
  p_batch             smallint default null,
  p_branch            text     default null,
  p_school            text     default null,
  p_residence         text     default null,
  p_interest          text     default null,
  p_query             text     default null,
  p_include_connected boolean  default false,
  p_limit             integer  default 30,
  p_offset            integer  default 0
)
returns table (
  id uuid, username text, full_name text, avatar_path text, batch smallint, branch text, school text,
  residence text, hostel_block text, clubs text[], languages text[], interests text[], bio text,
  streak_count integer, hearts_total integer,
  match_percent integer, reasons text[], mutual_count integer,
  connection_id uuid, connection_status text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me record;
  q  text := nullif(btrim(p_query), '');
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.profiles_public pp where pp.id = auth.uid();
  if not found then raise exception 'Finish your profile first'; end if;
  if q is not null then q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_'); end if;

  return query
  with mine as (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end as fid
    from public.connections c
    where c.status = 'accepted' and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
  ),
  base as (
    select pp.*,
      array(select lower(x) from unnest(pp.clubs)     x intersect select lower(x) from unnest(me.clubs)     x) as sc,
      array(select lower(x) from unnest(pp.interests) x intersect select lower(x) from unnest(me.interests) x) as si,
      array(select lower(x) from unnest(pp.languages) x intersect select lower(x) from unnest(me.languages) x) as sl,
      (select count(*) from public.connections c2
        where c2.status = 'accepted'
          and ((c2.requester_id = pp.id and c2.addressee_id in (select fid from mine))
            or (c2.addressee_id = pp.id and c2.requester_id in (select fid from mine))))::integer as mutual,
      cx.id as cid,
      case
        when cx.id is null then 'none'
        when cx.status = 'accepted' then 'accepted'
        when cx.status = 'pending'  then case when cx.requester_id = auth.uid() then 'pending_out' else 'pending_in' end
        when cx.status = 'declined' then case when cx.requester_id = auth.uid() then 'declined_out' else 'declined_in' end
        else 'none'
      end as cstatus
    from public.profiles_public pp
    left join lateral (
      select c.id, c.status, c.requester_id from public.connections c
      where (c.requester_id = auth.uid() and c.addressee_id = pp.id)
         or (c.addressee_id = auth.uid() and c.requester_id = pp.id)
      limit 1
    ) cx on true
    where pp.id <> auth.uid()
      and (p_batch is null or pp.batch = p_batch)
      and (p_branch is null or pp.branch ilike p_branch)
      and (p_school is null or pp.school ilike p_school)
      and (p_residence is null or pp.residence = p_residence)
      and (p_interest is null or exists (select 1 from unnest(pp.interests) x where lower(x) = lower(p_interest)))
      and (q is null or pp.full_name ilike '%' || q || '%' or pp.username ilike '%' || q || '%')
  ),
  scored as (
    select b.*,
      ( case when b.branch is not null and b.branch = me.branch then 25 else 0 end
      + least(cardinality(b.sc) * 15, 30)
      + case when me.residence = 'hosteller' and b.residence = 'hosteller'
                  and b.hostel_block is not null and b.hostel_block = me.hostel_block then 10 else 0 end
      + least(cardinality(b.si) * 8, 32)
      + least(b.mutual * 6, 18)
      + case when b.batch is not null and b.batch = me.batch then 5 else 0 end
      + case when b.school is not null and b.school = me.school then 5 else 0 end
      + least(cardinality(b.sl) * 3, 6) ) as raw
    from base b
  )
  select s.id, s.username, s.full_name, s.avatar_path, s.batch, s.branch, s.school,
         s.residence, s.hostel_block, s.clubs, s.languages, s.interests, s.bio,
         s.streak_count, s.hearts_total,
         least(99, s.raw)::integer,
         array_remove(array[
           case when s.branch is not null and s.branch = me.branch then 'Same branch (' || s.branch || ')' end,
           case when cardinality(s.sc) > 0 then 'Shared clubs: ' || array_to_string(s.sc, ', ') end,
           case when me.residence = 'hosteller' and s.residence = 'hosteller'
                     and s.hostel_block is not null and s.hostel_block = me.hostel_block
                then 'Same hostel block (' || s.hostel_block || ')' end,
           case when cardinality(s.si) > 0 then 'Shared interests: ' || array_to_string(s.si, ', ') end,
           case when s.mutual > 0 then s.mutual || ' mutual friend' || case when s.mutual > 1 then 's' else '' end end,
           case when s.batch is not null and s.batch = me.batch then 'Same batch (' || s.batch || ')' end,
           case when cardinality(s.sl) > 0 then 'Speaks ' || array_to_string(s.sl, ', ') end
         ], null),
         s.mutual, s.cid, s.cstatus
  from scored s
  where p_include_connected or s.cstatus <> 'accepted'
  order by s.raw desc, s.hearts_total desc, s.full_name
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;


-- ---------------------------------------------------------------------
-- 6. CHAT HELPERS
-- ---------------------------------------------------------------------
-- One call for the whole chat list (last message + unread + who it is with)
drop function if exists public.list_my_conversations();
create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid, type text, last_message_at timestamptz,
  last_message_id uuid, last_message_kind text, last_message_body text,
  last_message_sender uuid, last_message_unsent boolean,
  unread_count integer, muted boolean,
  other_user_id uuid, group_name text, group_avatar text, group_visibility text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  return query
  select c.id, c.type, coalesce(c.last_message_at, c.created_at),
         lm.id, lm.kind, lm.body, lm.sender_id, (lm.deleted_at is not null),
         coalesce(un.n, 0)::integer, cm.muted,
         ou.user_id, g.name, g.avatar_path, g.visibility
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  left join public.groups g on g.id = c.id
  left join lateral (
    select m.user_id from public.conversation_members m
    where c.type = 'dm' and m.conversation_id = c.id and m.user_id <> auth.uid() limit 1
  ) ou on true
  left join lateral (
    select m.id, m.kind, m.body, m.sender_id, m.deleted_at from public.messages m
    where m.conversation_id = c.id and not public.is_blocked(auth.uid(), m.sender_id)
    order by m.created_at desc limit 1
  ) lm on true
  left join lateral (
    select count(*) as n from public.messages m
    where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null
      and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
      and not public.is_blocked(auth.uid(), m.sender_id)
  ) un on true
  where cm.user_id = auth.uid()
    and (c.type = 'group' or (ou.user_id is not null and not public.is_blocked(auth.uid(), ou.user_id)))
  order by coalesce(c.last_message_at, c.created_at) desc;
end $$;

-- I opened the chat: mark everything from others as seen + move my read marker
create or replace function public.mark_conversation_seen(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not public.is_member(p_conversation) then raise exception 'You are not in this chat'; end if;
  insert into public.message_receipts (message_id, user_id, delivered_at, seen_at)
    select m.id, auth.uid(), now(), now()
    from public.messages m
    where m.conversation_id = p_conversation and m.sender_id <> auth.uid() and m.deleted_at is null
      and m.created_at > now() - interval '30 days'
      and not exists (select 1 from public.message_receipts r
                      where r.message_id = m.id and r.user_id = auth.uid() and r.seen_at is not null)
  on conflict (message_id, user_id) do update
    set seen_at      = coalesce(public.message_receipts.seen_at, now()),
        delivered_at = coalesce(public.message_receipts.delivered_at, now());
  update public.conversation_members set last_read_at = now()
    where conversation_id = p_conversation and user_id = auth.uid();
end $$;

-- My app is open: everything sent to me counts as "delivered" (grey double tick)
create or replace function public.mark_all_delivered() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.message_receipts (message_id, user_id, delivered_at)
    select m.id, auth.uid(), now()
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id and cm.user_id = auth.uid()
    where m.sender_id <> auth.uid() and m.deleted_at is null
      and m.created_at > now() - interval '7 days'
  on conflict (message_id, user_id) do nothing;
end $$;


-- ---------------------------------------------------------------------
-- 7. ADMIN: REPORT QUEUE
-- ---------------------------------------------------------------------
drop function if exists public.admin_list_reports(text);
create or replace function public.admin_list_reports(p_status text default 'open')
returns table (
  id uuid, reporter_id uuid, target_type text, target_id uuid, reason text, details text,
  status text, created_at timestamptz, target_preview text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
    case r.target_type
      when 'profile' then (select coalesce(p.full_name, '?') || ' (@' || coalesce(p.username, '?') || ')'
                           from public.profiles p where p.id = r.target_id)
      when 'message' then (select coalesce(left(m.body, 300), '[' || m.kind || ']')
                           from public.messages m where m.id = r.target_id)
      when 'post' then coalesce(
                           (select t.title from public.teammate_posts t where t.id = r.target_id),
                           (select l.title from public.lost_found l where l.id = r.target_id),
                           (select ri.origin || ' → ' || ri.destination from public.rides ri where ri.id = r.target_id),
                           (select n.title from public.study_notes n where n.id = r.target_id))
      when 'confession' then (select left(c.body, 300) from public.confessions c where c.id = r.target_id)
      when 'group' then (select g.name from public.groups g where g.id = r.target_id)
      when 'event' then (select e.title from public.events e where e.id = r.target_id)
    end
  from public.reports r
  where p_status = 'all' or r.status = p_status
  order by r.created_at desc
  limit 200;
end $$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('reviewing','actioned','dismissed') then raise exception 'Invalid status'; end if;
  update public.reports
     set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end $$;


-- ---------------------------------------------------------------------
-- 8. TEAMMATE MATCHING (author of a post sees students whose interests or
--    clubs match the skills the post asks for)
-- ---------------------------------------------------------------------
drop function if exists public.match_teammate_profiles(uuid);
create or replace function public.match_teammate_profiles(p_post uuid)
returns table (
  id uuid, username text, full_name text, avatar_path text, branch text, batch smallint,
  interests text[], matched_skills text[], invite_status text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  return query
  select pp.id, pp.username, pp.full_name, pp.avatar_path, pp.branch, pp.batch, pp.interests,
         m.skills, inv.status
  from public.teammate_posts t
  cross join public.profiles_public pp
  cross join lateral (
    select array(
      select s from unnest(t.skills_needed) s
      where lower(s) in (select lower(i) from unnest(pp.interests) i)
         or lower(s) in (select lower(c) from unnest(pp.clubs) c)
    ) as skills
  ) m
  left join public.teammate_invites inv on inv.post_id = t.id and inv.to_user = pp.id
  where t.id = p_post and t.author_id = auth.uid()
    and pp.id <> auth.uid() and cardinality(m.skills) > 0
  order by cardinality(m.skills) desc, pp.full_name
  limit 30;
end $$;


-- ---------------------------------------------------------------------
-- 9. REALTIME for notifications (only who they belong to receive them)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 10. FUNCTION PRIVILEGES
--     New functions are NOT private by default, so we lock each one:
--     nobody (public / anon) can run them; only signed-in users can.
--     Trigger functions are locked completely (triggers still run them).
-- ---------------------------------------------------------------------
revoke all on function public.notify_events()                from public, anon, authenticated;
revoke all on function public.senior_questions_before_update() from public, anon, authenticated;

revoke all on function public.is_senior_of_me(uuid)          from public, anon, authenticated;
revoke all on function public.is_username_available(text)    from public, anon, authenticated;
revoke all on function public.list_blocked_users()           from public, anon, authenticated;
revoke all on function public.discover_people(smallint, text, text, text, text, text, boolean, integer, integer)
                                                             from public, anon, authenticated;
revoke all on function public.list_my_conversations()        from public, anon, authenticated;
revoke all on function public.mark_conversation_seen(uuid)   from public, anon, authenticated;
revoke all on function public.mark_all_delivered()           from public, anon, authenticated;
revoke all on function public.admin_list_reports(text)       from public, anon, authenticated;
revoke all on function public.admin_resolve_report(uuid, text) from public, anon, authenticated;
revoke all on function public.match_teammate_profiles(uuid)  from public, anon, authenticated;

grant execute on function
  public.is_senior_of_me(uuid),
  public.is_username_available(text),
  public.list_blocked_users(),
  public.discover_people(smallint, text, text, text, text, text, boolean, integer, integer),
  public.list_my_conversations(),
  public.mark_conversation_seen(uuid),
  public.mark_all_delivered(),
  public.admin_list_reports(text),
  public.admin_resolve_report(uuid, text),
  public.match_teammate_profiles(uuid)
  to authenticated;

notify pgrst, 'reload schema';
