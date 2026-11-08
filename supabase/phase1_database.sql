-- =====================================================================
-- CAMPUSLY — PHASE 1: DATABASE
-- Supabase Dashboard -> SQL Editor -> New query -> paste ALL -> Run.
-- Safe to run again (it cleans old policies first).
-- Sections:
--   0  clean old policies
--   1  tables
--   2  indexes
--   3  helper functions
--   4  triggers (email rule, profile, messages, hearts, blocks, ...)
--   5  RPC functions (start chat, create group, admin tools)
--   6  views (profiles_public, leaderboard, events, confessions)
--   7  Row Level Security policies
--   8  privileges (who may touch which column / function)
--   9  storage buckets + storage policies
--  10  realtime
--  11  seed data (fictional demo users)  <- delete before launch
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. CLEAN OLD POLICIES (makes the script re-runnable)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
       or (schemaname = 'storage' and policyname like 'campusly\_%')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- 1.1 profiles (one row per auth user, created automatically by a trigger)
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text,
  full_name      text,
  avatar_path    text,                       -- path inside the "avatars" bucket
  reg_no         text,
  batch          smallint,
  branch         text,
  school         text,
  residence      text,                       -- day_scholar | hosteller
  hostel_block   text,
  room_no        text,
  clubs          text[] not null default '{}',
  languages      text[] not null default '{}',
  interests      text[] not null default '{}',
  bio            text,
  social_link    text,
  streak_count   integer not null default 0,
  last_active_on date,
  hearts_total   integer not null default 0, -- "most loved"
  hide_online    boolean not null default false,
  hide_last_seen boolean not null default false,
  hide_reg_no    boolean not null default false,
  last_seen_at   timestamptz,
  onboarded      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint profiles_username_fmt   check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_name_len       check (full_name is null or char_length(btrim(full_name)) between 2 and 60),
  constraint profiles_reg_no_fmt     check (reg_no is null or reg_no ~* '^[0-9]{2}[a-z]{3}[0-9]{4}$'),
  constraint profiles_batch_rng      check (batch is null or batch between 2015 and 2040),
  constraint profiles_residence_chk  check (residence is null or residence in ('day_scholar','hosteller')),
  constraint profiles_hostel_only    check (coalesce(residence,'') = 'hosteller' or (hostel_block is null and room_no is null)),
  constraint profiles_bio_len        check (bio is null or char_length(bio) <= 300),
  constraint profiles_link_fmt       check (social_link is null or social_link ~* '^https?://[^[:space:]]{3,200}$'),
  constraint profiles_array_sizes    check (cardinality(clubs) <= 10 and cardinality(languages) <= 10 and cardinality(interests) <= 15)
);

-- 1.2 admins (no one can add themselves; insert rows from the SQL editor only)
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 1.3 badges + user_badges
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  icon        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- 1.4 achievements wall
create table if not exists public.achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('certificate','hackathon','fest','club_role','other')),
  title       text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  issuer      text check (issuer is null or char_length(issuer) <= 120),
  achieved_on date,
  file_path   text,                          -- path inside the "certificates" bucket
  created_at  timestamptz not null default now(),
  constraint achievements_file_owner check (file_path is null or file_path like (user_id::text || '/%'))
);

-- 1.5 hearts (one per person per week)
create table if not exists public.hearts (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  week_start date not null default (date_trunc('week', now() at time zone 'Asia/Kolkata'))::date,
  created_at timestamptz not null default now(),
  constraint hearts_not_self     check (from_user <> to_user),
  constraint hearts_once_a_week  unique (from_user, to_user, week_start)
);

-- 1.6 blocks
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- 1.7 connections (friend requests)
create table if not exists public.connections (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_not_self check (requester_id <> addressee_id)
);

-- 1.8 conversations (1-to-1 "dm" or "group") + members
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('dm','group')),
  created_by      uuid references public.profiles(id) on delete set null,
  dm_key          text unique,               -- "smallerId:biggerId" so a pair has only ONE dm
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint conversations_dm_key_chk check ((type = 'dm' and dm_key is not null) or (type = 'group' and dm_key is null))
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  muted           boolean not null default false,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

-- 1.9 messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind            text not null default 'text' check (kind in ('text','image','file','voice')),
  body            text,
  media_path      text,                      -- "<conversation_id>/<sender_id>/<file>" in chat-files or voice-notes
  media_name      text,
  media_mime      text,
  media_size      integer check (media_size is null or media_size between 0 and 26214400),
  duration_ms     integer check (duration_ms is null or duration_ms between 0 and 600000),
  waveform        smallint[] check (waveform is null or cardinality(waveform) <= 200),
  reply_to        uuid,
  edited_at       timestamptz,
  deleted_at      timestamptz,               -- unsent
  created_at      timestamptz not null default now(),
  constraint messages_id_conv_uq unique (id, conversation_id),
  constraint messages_reply_fk   foreign key (reply_to, conversation_id) references public.messages (id, conversation_id),
  constraint messages_body_len   check (body is null or char_length(body) <= 4000),
  constraint messages_content_chk check (
    deleted_at is not null
    or (kind = 'text' and body is not null and char_length(btrim(body)) >= 1)
    or (kind <> 'text' and media_path is not null)
  ),
  constraint messages_media_folder check (media_path is null or media_path like (conversation_id::text || '/%'))
);

-- 1.10 reactions + delivered/seen receipts
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.message_receipts (
  message_id   uuid not null references public.messages(id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  delivered_at timestamptz default now(),
  seen_at      timestamptz,
  primary key (message_id, user_id)
);

-- 1.11 groups (group id == its conversation id) + members with roles
create table if not exists public.groups (
  id           uuid primary key references public.conversations(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 60),
  description  text check (description is null or char_length(description) <= 300),
  avatar_path  text,
  visibility   text not null default 'private' check (visibility in ('public','private')),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  member_count integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 1.12 pinned messages + announcements
create table if not exists public.pinned_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id      uuid not null,
  pinned_by       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pinned_at       timestamptz not null default now(),
  unique (conversation_id, message_id),
  foreign key (message_id, conversation_id) references public.messages (id, conversation_id) on delete cascade
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 2 and 100),
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- 1.13 campus tables
create table if not exists public.teammate_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 3 and 120),
  description   text check (description is null or char_length(description) <= 1000),
  event_name    text check (event_name is null or char_length(event_name) <= 120),
  skills_needed text[] not null default '{}' check (cardinality(skills_needed) <= 12),
  team_size     smallint check (team_size is null or team_size between 2 and 20),
  status        text not null default 'open' check (status in ('open','closed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.study_rooms (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 3 and 80),
  subject     text check (subject is null or char_length(subject) <= 80),
  description text check (description is null or char_length(description) <= 500),
  created_at  timestamptz not null default now()
);

create table if not exists public.study_notes (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.study_rooms(id) on delete cascade,
  uploader_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 120),
  file_path   text not null,                 -- "<room_id>/<uploader_id>/<file>" in the "notes" bucket
  file_name   text,
  mime_type   text,
  size_bytes  integer check (size_bytes is null or size_bytes between 0 and 10485760),
  created_at  timestamptz not null default now(),
  constraint study_notes_folder check (file_path like (room_id::text || '/' || uploader_id::text || '/%'))
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (description is null or char_length(description) <= 1000),
  location    text check (location is null or char_length(location) <= 120),
  club        text check (club is null or char_length(club) <= 80),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.event_going (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.lost_found (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('lost','found')),
  title       text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (description is null or char_length(description) <= 500),
  location    text check (location is null or char_length(location) <= 120),
  image_path  text,
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now()
);

create table if not exists public.rides (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  origin      text not null check (char_length(btrim(origin)) between 2 and 120),
  destination text not null check (char_length(btrim(destination)) between 2 and 120),
  depart_at   timestamptz not null,
  seats       smallint not null default 1 check (seats between 1 and 8),
  cost_note   text check (cost_note is null or char_length(cost_note) <= 120),
  notes       text check (notes is null or char_length(notes) <= 300),
  status      text not null default 'open' check (status in ('open','full','closed')),
  created_at  timestamptz not null default now()
);

-- 1.14 confessions: author_id is stored but NO ONE can select it (see section 8)
create table if not exists public.confessions (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid default auth.uid() references public.profiles(id) on delete set null,
  body        text not null check (char_length(btrim(body)) between 10 and 1000),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- 1.15 notices (admin-written campus notices)
create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid default auth.uid() references public.profiles(id) on delete set null,
  title      text not null check (char_length(btrim(title)) between 3 and 120),
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  pinned     boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 1.16 reports
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','message','post','confession','group','event')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam','harassment','hate','nsfw','impersonation','self_harm','other')),
  details     text check (details is null or char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- Turn on Row Level Security for EVERY table in public
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------
create unique index if not exists profiles_username_uq  on public.profiles (lower(username));
create unique index if not exists profiles_reg_no_uq    on public.profiles (upper(reg_no)) where reg_no is not null;
create index if not exists profiles_branch_idx          on public.profiles (branch);
create index if not exists profiles_batch_idx           on public.profiles (batch);
create index if not exists profiles_school_idx          on public.profiles (school);
create index if not exists profiles_interests_gin       on public.profiles using gin (interests);

create unique index if not exists connections_pair_uq   on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists connections_addressee_idx    on public.connections (addressee_id, status);
create index if not exists connections_requester_idx    on public.connections (requester_id, status);

create index if not exists blocks_blocked_idx           on public.blocks (blocked_id);
create index if not exists hearts_to_week_idx           on public.hearts (to_user, week_start);
create index if not exists achievements_user_idx        on public.achievements (user_id, created_at desc);
create index if not exists user_badges_user_idx         on public.user_badges (user_id);

create index if not exists conv_members_user_idx        on public.conversation_members (user_id);
create index if not exists messages_conv_created_idx    on public.messages (conversation_id, created_at desc);
create index if not exists receipts_user_idx            on public.message_receipts (user_id);
create index if not exists group_members_user_idx       on public.group_members (user_id);
create index if not exists groups_visibility_idx        on public.groups (visibility);

create index if not exists teammate_skills_gin          on public.teammate_posts using gin (skills_needed);
create index if not exists study_notes_room_idx         on public.study_notes (room_id, created_at desc);
create index if not exists events_starts_idx            on public.events (starts_at);
create index if not exists confessions_status_idx       on public.confessions (status, created_at desc);
create index if not exists reports_status_idx           on public.reports (status, created_at desc);
create index if not exists announcements_group_idx      on public.announcements (group_id, created_at desc);


-- ---------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (used inside RLS policies)
--    SECURITY DEFINER + search_path='' so they can look at tables safely.
--    The "a or b = auth.uid()" guard stops people probing OTHER people's data.
-- ---------------------------------------------------------------------
create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.current_week_start() returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'Asia/Kolkata')::date
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (a = auth.uid() or b = auth.uid())
     and exists (
       select 1 from public.blocks
       where (blocker_id = a and blocked_id = b)
          or (blocker_id = b and blocked_id = a)
     )
$$;

create or replace function public.are_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (a = auth.uid() or b = auth.uid())
     and exists (
       select 1 from public.connections
       where status = 'accepted'
         and ((requester_id = a and addressee_id = b)
           or (requester_id = b and addressee_id = a))
     )
$$;

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = auth.uid()
  )
$$;

create or replace function public.group_role(gid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.group_members where group_id = gid and user_id = auth.uid()
$$;

-- Can the signed-in user send a message in this conversation right now?
create or replace function public.can_send(cid uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare t text; other uuid;
begin
  select type into t from public.conversations where id = cid;
  if t is null or not public.is_member(cid) then return false; end if;
  if t = 'group' then return true; end if;
  select user_id into other from public.conversation_members
    where conversation_id = cid and user_id <> auth.uid() limit 1;
  return other is not null
     and public.are_connected(auth.uid(), other)
     and not public.is_blocked(auth.uid(), other);
end $$;

-- Pin messages: any member in a 1-to-1 chat, only owner/admin in a group
create or replace function public.can_manage_conversation(cid uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare t text;
begin
  select type into t from public.conversations where id = cid;
  if t = 'dm' then return public.is_member(cid); end if;
  if t = 'group' then return coalesce(public.group_role(cid), '') in ('owner','admin'); end if;
  return false;
end $$;

create or replace function public.is_message_member(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = mid and cm.user_id = auth.uid()
  )
$$;

create or replace function public.is_message_recipient(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = mid and cm.user_id = auth.uid() and m.sender_id <> auth.uid()
  )
$$;


-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- 4.1 ONLY @vitstudent.ac.in emails can ever exist in auth.users
create or replace function public.enforce_vit_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null
     or lower(btrim(new.email)) !~ '^[a-z0-9._%+-]+@vitstudent\.ac\.in$' then
    raise exception 'Only @vitstudent.ac.in email addresses can join Campusly';
  end if;
  return new;
end $$;

create or replace trigger trg_enforce_vit_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_vit_email();

-- 4.2 auto-create an empty profile for every new user
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

create or replace trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.3 profiles: updated_at, onboarding rules, reg_no cannot change later
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and old.reg_no is not null and new.reg_no is distinct from old.reg_no then
    raise exception 'Registration number cannot be changed once saved';
  end if;
  if new.onboarded and (new.username is null or new.full_name is null or new.reg_no is null
      or new.batch is null or new.branch is null or new.school is null or new.residence is null) then
    raise exception 'Please fill in all required profile fields first';
  end if;
  return new;
end $$;

create or replace trigger trg_profiles_guard   before update on public.profiles for each row execute function public.profiles_guard();
create or replace trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- 4.4 hearts: server decides week + sender; +1 to "most loved" counter
create or replace function public.hearts_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.week_start := public.current_week_start();
  if auth.uid() is not null then new.from_user := auth.uid(); end if;
  return new;
end $$;

create or replace function public.hearts_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set hearts_total = hearts_total + 1 where id = new.to_user;
  return null;
end $$;

create or replace trigger trg_00_hearts_stamp before insert on public.hearts for each row execute function public.hearts_before_insert();
create or replace trigger trg_hearts_count    after  insert on public.hearts for each row execute function public.hearts_after_insert();

-- 4.5 connections: only the receiver can accept/decline; nothing else can change
create or replace function public.connections_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'A connection''s people cannot be changed';
  end if;
  if new.status is distinct from old.status then
    if auth.uid() <> old.addressee_id then
      raise exception 'Only the person who received the request can respond to it';
    end if;
    if not (old.status in ('pending','declined') and new.status in ('accepted','declined')) then
      raise exception 'That status change is not allowed';
    end if;
    new.responded_at := now();
  else
    new.responded_at := old.responded_at;
  end if;
  return new;
end $$;

create or replace trigger trg_connections_guard before update on public.connections for each row execute function public.connections_before_update();

-- 4.6 blocking someone removes any connection between you two
create or replace function public.blocks_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.connections
   where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
      or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return null;
end $$;

create or replace trigger trg_blocks_cleanup after insert on public.blocks for each row execute function public.blocks_after_insert();

-- 4.7 messages: server stamps sender + time (client can't fake them)
create or replace function public.messages_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.sender_id  := auth.uid();
    new.created_at := now();
    new.edited_at  := null;
    new.deleted_at := null;
  end if;
  return new;
end $$;

-- 4.8 messages: edit / unsend rules (only sender, only within 10 minutes)
create or replace function public.messages_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'This message was unsent and cannot be changed';
  end if;
  if auth.uid() is not null and old.sender_id <> auth.uid() then
    raise exception 'Only the sender can change a message';
  end if;

  new.edited_at := old.edited_at;          -- the client never sets this itself

  if new.deleted_at is distinct from old.deleted_at then
    -- UNSEND
    if auth.uid() is not null and now() - old.created_at > interval '10 minutes' then
      raise exception 'You can only unsend a message within 10 minutes';
    end if;
    new.deleted_at  := now();
    new.body        := null;
    new.media_path  := null;
    new.media_name  := null;
    new.media_mime  := null;
    new.media_size  := null;
    new.duration_ms := null;
    new.waveform    := null;
    return new;
  end if;

  if new.body is distinct from old.body then
    -- EDIT
    if old.kind <> 'text' then
      raise exception 'Only text messages can be edited';
    end if;
    if auth.uid() is not null and now() - old.created_at > interval '10 minutes' then
      raise exception 'You can only edit a message within 10 minutes';
    end if;
    new.edited_at := now();
  end if;

  if (new.id, new.conversation_id, new.sender_id, new.kind, new.created_at, new.reply_to,
      new.media_path, new.media_name, new.media_mime, new.media_size, new.duration_ms, new.waveform)
     is distinct from
     (old.id, old.conversation_id, old.sender_id, old.kind, old.created_at, old.reply_to,
      old.media_path, old.media_name, old.media_mime, old.media_size, old.duration_ms, old.waveform) then
    raise exception 'Only the text of a message can be edited';
  end if;
  return new;
end $$;

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end $$;

create or replace trigger trg_00_messages_stamp  before insert on public.messages for each row execute function public.messages_before_insert();
create or replace trigger trg_messages_guard     before update on public.messages for each row execute function public.messages_before_update();
create or replace trigger trg_messages_last_msg  after  insert on public.messages for each row execute function public.messages_after_insert();

-- 4.9 group_members -> keeps conversation_members + member_count in sync
create or replace function public.group_members_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.conversation_members (conversation_id, user_id)
      values (new.group_id, new.user_id) on conflict do nothing;
    update public.groups set member_count = member_count + 1 where id = new.group_id;
  elsif tg_op = 'DELETE' then
    delete from public.conversation_members where conversation_id = old.group_id and user_id = old.user_id;
    update public.groups set member_count = greatest(member_count - 1, 0) where id = old.group_id;
  end if;
  return null;
end $$;

create or replace trigger trg_group_members_sync
  after insert or delete on public.group_members
  for each row execute function public.group_members_after();

-- 4.10 basic rate limits (spam protection). Ignored for SQL-editor/service work.
create or replace function public.limit_inserts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid; n integer;
begin
  if auth.uid() is null then return new; end if;
  uid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2::interval',
                 tg_table_name, tg_argv[0])
     into n using uid, tg_argv[2];
  if n >= tg_argv[1]::integer then
    raise exception 'Slow down: you are doing that too often. Try again later.';
  end if;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
      ('messages',       'sender_id',    '60', '1 minute'),
      ('connections',    'requester_id', '30', '1 day'),
      ('reports',        'reporter_id',  '20', '1 day'),
      ('confessions',    'author_id',    '3',  '1 day'),
      ('teammate_posts', 'author_id',    '10', '1 day'),
      ('lost_found',     'author_id',    '10', '1 day'),
      ('rides',          'author_id',    '10', '1 day'),
      ('events',         'creator_id',   '5',  '1 day'),
      ('study_notes',    'uploader_id',  '30', '1 day')
    ) as v(tbl, col, max_n, win)
  loop
    execute format('create index if not exists %I on public.%I (%I, created_at desc)',
                   r.tbl || '_' || r.col || '_created_idx', r.tbl, r.col);
    execute format('create or replace trigger %I before insert on public.%I for each row execute function public.limit_inserts(%L, %L, %L)',
                   'trg_90_' || r.tbl || '_limit', r.tbl, r.col, r.max_n, r.win);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 5. RPC FUNCTIONS (the ONLY way to create chats / groups / join)
-- ---------------------------------------------------------------------

-- Update "last seen" + daily streak (India time)
create or replace function public.touch_presence() returns void
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if auth.uid() is null then return; end if;
  update public.profiles
     set last_seen_at   = now(),
         streak_count   = case
                            when last_active_on = today     then streak_count
                            when last_active_on = today - 1 then streak_count + 1
                            else 1
                          end,
         last_active_on = today
   where id = auth.uid();
end $$;

-- Start (or reopen) a 1-to-1 chat. Only accepted connections, never blocked pairs.
create or replace function public.start_dm(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid; k text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_other is null or p_other = me then raise exception 'Invalid person'; end if;
  if public.is_blocked(me, p_other) or not public.are_connected(me, p_other) then
    raise exception 'You can only chat with your accepted connections';
  end if;
  k := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into cid from public.conversations where dm_key = k;
  if cid is null then
    insert into public.conversations (type, created_by, dm_key)
      values ('dm', me, k) on conflict (dm_key) do nothing returning id into cid;
    if cid is null then select id into cid from public.conversations where dm_key = k; end if;
    insert into public.conversation_members (conversation_id, user_id)
      values (cid, me), (cid, p_other) on conflict do nothing;
  end if;
  return cid;
end $$;

-- Create a group. Everyone you add must be an accepted connection.
create or replace function public.create_group(
  p_name text,
  p_description text default null,
  p_visibility text default 'private',
  p_member_ids uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gid uuid; m uuid; ids uuid[] := coalesce(p_member_ids, '{}');
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_visibility not in ('public','private') then raise exception 'Invalid group type'; end if;
  if cardinality(ids) > 49 then raise exception 'Add at most 49 people at once'; end if;
  foreach m in array ids loop
    if m <> me and (not public.are_connected(me, m) or public.is_blocked(me, m)) then
      raise exception 'You can only add accepted connections to a group';
    end if;
  end loop;
  insert into public.conversations (type, created_by) values ('group', me) returning id into gid;
  insert into public.groups (id, name, description, visibility, owner_id)
    values (gid, btrim(p_name), p_description, p_visibility, me);
  insert into public.group_members (group_id, user_id, role) values (gid, me, 'owner');
  foreach m in array ids loop
    if m <> me then
      insert into public.group_members (group_id, user_id, role) values (gid, m, 'member') on conflict do nothing;
    end if;
  end loop;
  return gid;
end $$;

create or replace function public.join_public_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.groups where id = p_group and visibility = 'public') then
    raise exception 'This group is not public';
  end if;
  insert into public.group_members (group_id, user_id, role)
    values (p_group, auth.uid(), 'member') on conflict do nothing;
end $$;

create or replace function public.add_group_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if coalesce(public.group_role(p_group), '') not in ('owner','admin') then
    raise exception 'Only group owners and admins can add members';
  end if;
  if public.is_blocked(me, p_user) or not public.are_connected(me, p_user) then
    raise exception 'You can only add accepted connections';
  end if;
  insert into public.group_members (group_id, user_id, role)
    values (p_group, p_user, 'member') on conflict do nothing;
end $$;

-- Admin-only tools for the confession moderation queue
create or replace function public.admin_list_pending_confessions()
returns table (id uuid, body text, author_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select c.id, c.body, c.author_id, c.created_at
    from public.confessions c where c.status = 'pending' order by c.created_at;
end $$;

create or replace function public.admin_review_confession(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.confessions
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending';
end $$;


-- ---------------------------------------------------------------------
-- 6. VIEWS (what the app is allowed to see)
--    Views run with the owner's rights, so each one carries its own filter.
-- ---------------------------------------------------------------------

-- Everyone's SAFE profile. Hides: room number, hidden reg no, hidden last seen,
-- unfinished profiles, and anyone who blocked you / you blocked.
create or replace view public.profiles_public with (security_barrier = true) as
select
  p.id, p.username, p.full_name, p.avatar_path,
  p.batch, p.branch, p.school, p.residence, p.hostel_block,
  p.clubs, p.languages, p.interests, p.bio, p.social_link,
  p.streak_count, p.hearts_total,
  case when p.hide_reg_no then null else p.reg_no end as reg_no,
  case when p.hide_last_seen or p.hide_online then null else p.last_seen_at end as last_seen_at,
  p.created_at
from public.profiles p
where p.onboarded
  and not public.is_blocked(auth.uid(), p.id);

create or replace view public.weekly_leaderboard with (security_barrier = true) as
select p.id, p.username, p.full_name, p.avatar_path, p.branch, p.batch,
       count(*)::integer as hearts_this_week
from public.hearts h
join public.profiles_public p on p.id = h.to_user
where h.week_start = public.current_week_start()
group by p.id, p.username, p.full_name, p.avatar_path, p.branch, p.batch
order by hearts_this_week desc, p.full_name
limit 50;

create or replace view public.events_board with (security_barrier = true) as
select e.id, e.creator_id, e.title, e.description, e.location, e.club,
       e.starts_at, e.ends_at, e.created_at,
       (select count(*) from public.event_going g where g.event_id = e.id)::integer as going_count,
       exists (select 1 from public.event_going g where g.event_id = e.id and g.user_id = auth.uid()) as i_going
from public.events e
where not public.is_blocked(auth.uid(), e.creator_id);

-- Approved confessions only, with NO author column at all.
create or replace view public.confessions_feed with (security_barrier = true) as
select c.id, c.body, c.created_at
from public.confessions c
where c.status = 'approved';


-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY POLICIES
-- ---------------------------------------------------------------------

-- profiles: you can read/update ONLY your own raw row. Others use profiles_public.
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- admins: no policies = nobody can read or write from the app

-- badges
create policy badges_select       on public.badges      for select to authenticated using (true);
create policy user_badges_select  on public.user_badges for select to authenticated using (not public.is_blocked(auth.uid(), user_id));

-- achievements (public wall, owner edits)
create policy achievements_select on public.achievements for select to authenticated using (not public.is_blocked(auth.uid(), user_id));
create policy achievements_insert on public.achievements for insert to authenticated with check (user_id = auth.uid());
create policy achievements_update on public.achievements for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy achievements_delete on public.achievements for delete to authenticated using (user_id = auth.uid());

-- hearts: you can see the hearts YOU gave; you can give one to anyone not blocked
create policy hearts_select_given on public.hearts for select to authenticated using (from_user = auth.uid());
create policy hearts_insert       on public.hearts for insert to authenticated
  with check (from_user = auth.uid() and not public.is_blocked(from_user, to_user));

-- blocks: private to the blocker
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- connections
create policy connections_select on public.connections for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy connections_insert on public.connections for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending' and not public.is_blocked(requester_id, addressee_id));
create policy connections_update on public.connections for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());
create policy connections_delete on public.connections for delete to authenticated
  using ((requester_id = auth.uid() and status = 'pending')                                   -- cancel my request
      or (status = 'accepted' and (requester_id = auth.uid() or addressee_id = auth.uid()))); -- remove connection

-- conversations + members (created only through start_dm / create_group)
create policy conversations_select on public.conversations for select to authenticated using (public.is_member(id));
create policy conv_members_select  on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
create policy conv_members_update  on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages
create policy messages_select on public.messages for select to authenticated
  using (public.is_member(conversation_id) and not public.is_blocked(auth.uid(), sender_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send(conversation_id));
create policy messages_update on public.messages for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null
         and now() - created_at <= interval '10 minutes'
         and public.can_send(conversation_id))
  with check (sender_id = auth.uid());
-- no delete policy: "unsend" is an update

-- reactions + receipts
create policy reactions_select on public.message_reactions for select to authenticated using (public.is_message_member(message_id));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_message_member(message_id));
create policy reactions_delete on public.message_reactions for delete to authenticated using (user_id = auth.uid());

create policy receipts_select on public.message_receipts for select to authenticated using (public.is_message_member(message_id));
create policy receipts_insert on public.message_receipts for insert to authenticated
  with check (user_id = auth.uid() and public.is_message_recipient(message_id));
create policy receipts_update on public.message_receipts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_message_recipient(message_id));

-- groups
create policy groups_select on public.groups for select to authenticated
  using (visibility = 'public' or public.is_member(id));
create policy groups_update on public.groups for update to authenticated
  using (coalesce(public.group_role(id), '') in ('owner','admin'))
  with check (coalesce(public.group_role(id), '') in ('owner','admin'));

create policy group_members_select on public.group_members for select to authenticated using (public.is_member(group_id));
create policy group_members_update on public.group_members for update to authenticated
  using (public.group_role(group_id) = 'owner' and role <> 'owner')
  with check (role in ('admin','member'));
create policy group_members_delete on public.group_members for delete to authenticated
  using (role <> 'owner' and (
           user_id = auth.uid()                                              -- leave
        or public.group_role(group_id) = 'owner'                             -- owner removes anyone
        or (public.group_role(group_id) = 'admin' and role = 'member')));    -- admin removes members

-- pins + announcements
create policy pins_select on public.pinned_messages for select to authenticated using (public.is_member(conversation_id));
create policy pins_insert on public.pinned_messages for insert to authenticated
  with check (pinned_by = auth.uid() and public.can_manage_conversation(conversation_id));
create policy pins_delete on public.pinned_messages for delete to authenticated using (public.can_manage_conversation(conversation_id));

create policy announcements_select on public.announcements for select to authenticated using (public.is_member(group_id));
create policy announcements_insert on public.announcements for insert to authenticated
  with check (author_id = auth.uid() and coalesce(public.group_role(group_id), '') in ('owner','admin'));
create policy announcements_update on public.announcements for update to authenticated
  using (coalesce(public.group_role(group_id), '') in ('owner','admin'))
  with check (coalesce(public.group_role(group_id), '') in ('owner','admin'));
create policy announcements_delete on public.announcements for delete to authenticated
  using (coalesce(public.group_role(group_id), '') in ('owner','admin'));

-- the same 4 rules (read / create own / edit own / delete own-or-admin) for 6 campus tables
do $$
declare t record;
begin
  for t in select * from (values
      ('teammate_posts','author_id'), ('lost_found','author_id'), ('rides','author_id'),
      ('study_rooms','creator_id'),   ('events','creator_id'),    ('study_notes','uploader_id')
    ) as v(tbl, col)
  loop
    execute format('create policy %I on public.%I for select to authenticated using (not public.is_blocked(auth.uid(), %I))',
                   t.tbl || '_select', t.tbl, t.col);
    execute format('create policy %I on public.%I for insert to authenticated with check (%I = auth.uid())',
                   t.tbl || '_insert', t.tbl, t.col);
    execute format('create policy %I on public.%I for update to authenticated using (%I = auth.uid()) with check (%I = auth.uid())',
                   t.tbl || '_update', t.tbl, t.col, t.col);
    execute format('create policy %I on public.%I for delete to authenticated using (%I = auth.uid() or public.is_admin())',
                   t.tbl || '_delete', t.tbl, t.col);
  end loop;
end $$;

-- event_going: you only see / change your own "going"
create policy event_going_select on public.event_going for select to authenticated using (user_id = auth.uid());
create policy event_going_insert on public.event_going for insert to authenticated with check (user_id = auth.uid());
create policy event_going_delete on public.event_going for delete to authenticated using (user_id = auth.uid());

-- confessions: you can submit; nobody can select the table (use confessions_feed / admin functions)
create policy confessions_insert on public.confessions for insert to authenticated with check (author_id = auth.uid());

-- notices: everyone reads, only admins write
create policy notices_select on public.notices for select to authenticated using (expires_at is null or expires_at > now());
create policy notices_insert on public.notices for insert to authenticated with check (public.is_admin());
create policy notices_update on public.notices for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notices_delete on public.notices for delete to authenticated using (public.is_admin());

-- reports: you see your own; admins see and update all
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_update on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 8. PRIVILEGES (a second wall behind RLS)
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- views are read-only
revoke insert, update, delete on public.profiles_public, public.weekly_leaderboard,
                                 public.events_board,    public.confessions_feed from authenticated;

-- profiles: no insert/delete; update only these columns (never hearts, streak, last_seen...)
revoke insert, update, delete on public.profiles from authenticated;
grant update (username, full_name, avatar_path, reg_no, batch, branch, school, residence,
              hostel_block, room_no, clubs, languages, interests, bio, social_link,
              hide_online, hide_last_seen, hide_reg_no, onboarded)
  on public.profiles to authenticated;

-- admins / badges are managed from the SQL editor only
revoke all on public.admins from authenticated;
revoke insert, update, delete on public.badges, public.user_badges from authenticated;

-- hearts can't be edited or removed
revoke update, delete on public.hearts from authenticated;

-- connections: only "status" can change
revoke update on public.connections from authenticated;
grant update (status) on public.connections to authenticated;

-- chats and groups are created by RPC functions only
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_members from authenticated;
grant update (muted, last_read_at) on public.conversation_members to authenticated;
revoke insert, delete on public.groups from authenticated;
revoke update on public.groups from authenticated;
grant update (name, description, avatar_path) on public.groups to authenticated;
revoke insert, update on public.group_members from authenticated;
grant update (role) on public.group_members to authenticated;

-- messages: never hard-deleted; only body / deleted_at can be updated
revoke delete on public.messages from authenticated;
revoke update on public.messages from authenticated;
grant update (body, deleted_at) on public.messages to authenticated;

-- confessions: you can ONLY write the body. author_id can never be read by anyone in the app.
revoke all on public.confessions from authenticated;
grant insert (body) on public.confessions to authenticated;

-- functions: nothing callable by default, then allow exactly what the app needs
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.try_uuid(text), public.current_week_start(), public.is_admin(),
  public.is_blocked(uuid, uuid), public.are_connected(uuid, uuid), public.is_member(uuid),
  public.group_role(uuid), public.can_send(uuid), public.can_manage_conversation(uuid),
  public.is_message_member(uuid), public.is_message_recipient(uuid),
  public.touch_presence(), public.start_dm(uuid),
  public.create_group(text, text, text, uuid[]), public.join_public_group(uuid),
  public.add_group_member(uuid, uuid),
  public.admin_list_pending_confessions(), public.admin_review_confession(uuid, boolean)
  to authenticated;


-- ---------------------------------------------------------------------
-- 9. STORAGE BUCKETS + POLICIES
--    avatars = public read (anyone with the link). All others = private (signed URLs).
--    Upload paths:
--      avatars       <user_id>/<file>
--      certificates  <user_id>/<file>
--      chat-files    <conversation_id>/<user_id>/<file>
--      voice-notes   <conversation_id>/<user_id>/<file>
--      notes         <room_id>/<user_id>/<file>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',      'avatars',      true,  2097152,
     array['image/jpeg','image/png','image/webp']),
  ('certificates', 'certificates', false, 5242880,
     array['image/jpeg','image/png','image/webp','application/pdf']),
  ('chat-files',   'chat-files',   false, 20971520,
     array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip',
           'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('voice-notes',  'voice-notes',  false, 5242880,
     array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a']),
  ('notes',        'notes',        false, 10485760,
     array['application/pdf','image/jpeg','image/png','image/webp','text/plain',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- avatars: owner writes into their own folder
create policy campusly_avatars_read   on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy campusly_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy campusly_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy campusly_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- certificates: any signed-in student can view (public achievements wall); owner manages
create policy campusly_certs_read   on storage.objects for select to authenticated
  using (bucket_id = 'certificates');
create policy campusly_certs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy campusly_certs_update on storage.objects for update to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy campusly_certs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

-- chat-files + voice-notes: only members of that conversation
create policy campusly_chat_read on storage.objects for select to authenticated
  using (bucket_id in ('chat-files','voice-notes')
         and public.is_member(public.try_uuid((storage.foldername(name))[1])));
create policy campusly_chat_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('chat-files','voice-notes')
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.can_send(public.try_uuid((storage.foldername(name))[1])));
create policy campusly_chat_delete on storage.objects for delete to authenticated
  using (bucket_id in ('chat-files','voice-notes')
         and (storage.foldername(name))[2] = auth.uid()::text);

-- notes: any signed-in student can read; uploader writes inside <room_id>/<their id>/
create policy campusly_notes_read on storage.objects for select to authenticated
  using (bucket_id = 'notes');
create policy campusly_notes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[2] = auth.uid()::text);
create policy campusly_notes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[2] = auth.uid()::text);


-- ---------------------------------------------------------------------
-- 10. REALTIME (live updates). RLS still decides who receives what.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages','message_reactions','message_receipts','conversation_members',
                             'connections','group_members','pinned_messages','announcements']
    loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

alter table public.message_reactions replica identity full;   -- so "reaction removed" events carry details


-- ---------------------------------------------------------------------
-- 11. SEED DATA — FICTIONAL DEMO PEOPLE (delete before launch, see bottom)
--     These fake accounts cannot log in (no password, fake inboxes).
--     Use them to test RLS with phase1_verify.sql.
-- ---------------------------------------------------------------------

-- 11.1 real reference data: badges
insert into public.badges (slug, name, description, icon) values
  ('early-adopter', 'Early Adopter',  'Joined Campusly in the first wave', 'sparkles'),
  ('club-leader',   'Club Leader',    'Leads a campus club',                'crown'),
  ('hackathon-pro', 'Hackathon Pro',  'Took part in a hackathon',           'trophy'),
  ('helpful-senior','Helpful Senior', 'Helps juniors find their way',       'heart-handshake'),
  ('streak-7',      '7-Day Streak',   'Visited 7 days in a row',            'flame')
on conflict (slug) do nothing;

-- 11.2 demo users (the trigger creates their empty profiles)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','aarav.demo@vitstudent.ac.in', '', now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','meera.demo@vitstudent.ac.in', '', now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','rohan.demo@vitstudent.ac.in', '', now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','sneha.demo@vitstudent.ac.in', '', now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','',''),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555555','authenticated','authenticated','karthik.demo@vitstudent.ac.in','', now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '','','','')
on conflict (id) do nothing;

-- 11.3 fill in their profiles
update public.profiles p set
  username = v.username, full_name = v.full_name, reg_no = v.reg_no, batch = v.batch,
  branch = v.branch, school = v.school, residence = v.residence,
  hostel_block = v.hostel_block, room_no = v.room_no,
  clubs = v.clubs, languages = v.languages, interests = v.interests,
  bio = v.bio, hide_reg_no = v.hide_reg_no, onboarded = true
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'aarav_demo',   'Aarav Menon',  '23BCE1001', 2023::smallint, 'CSE',        'SCOPE', 'hosteller',   'A Block'::text, '204'::text,
     array['Coding Club'], array['English','Malayalam'], array['Web Dev','Hackathons','Cricket'],
     'Demo user. Loves building things at midnight.', false),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'meera_demo',   'Meera Iyer',   '23BCE1002', 2023::smallint, 'CSE',        'SCOPE', 'day_scholar', null::text,      null::text,
     array['Coding Club','Dance Club'], array['English','Tamil'], array['Web Dev','Dance','Design'],
     'Demo user. Frontend + Bharatanatyam.', true),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'rohan_demo',   'Rohan Das',    '22BEC1003', 2022::smallint, 'ECE',        'SENSE', 'hosteller',   'B Block'::text, '112'::text,
     array['Robotics Club'], array['English','Bengali','Hindi'], array['Robotics','Cricket','Embedded'],
     'Demo user. Soldering irons and chai.', false),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'sneha_demo',   'Sneha Reddy',  '24BME1004', 2024::smallint, 'Mechanical', 'SMEC',  'day_scholar', null::text,      null::text,
     array['Design Club'], array['English','Telugu'], array['Design','Music','CAD'],
     'Demo user (also the demo admin).', false),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'karthik_demo', 'Karthik Raj',  '21BIT1005', 2021::smallint, 'IT',         'SCOPE', 'hosteller',   'A Block'::text, '310'::text,
     array['AI Club'], array['English','Tamil'], array['AI','Hackathons','Chess'],
     'Demo user. Final year, happy to help juniors.', false)
) as v(id, username, full_name, reg_no, batch, branch, school, residence, hostel_block, room_no,
       clubs, languages, interests, bio, hide_reg_no)
where p.id = v.id;

insert into public.admins (user_id) values ('44444444-4444-4444-8444-444444444444') on conflict do nothing;

-- 11.4 badges for demo users
insert into public.user_badges (user_id, badge_id)
select u.id, b.id from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'early-adopter'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'club-leader'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'helpful-senior')
) as u(id, slug) join public.badges b on b.slug = u.slug
on conflict do nothing;

-- 11.5 connections: aarav<->meera accepted, rohan->aarav pending, meera<->sneha accepted, karthik->aarav declined
insert into public.connections (id, requester_id, addressee_id, status, responded_at) values
  ('eeeeeeee-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted', now()),
  ('eeeeeeee-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','pending',  null),
  ('eeeeeeee-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','accepted', now()),
  ('eeeeeeee-0000-4000-8000-000000000004','55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','declined', now())
on conflict (id) do nothing;

-- rohan blocks karthik
insert into public.blocks (blocker_id, blocked_id)
values ('33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555') on conflict do nothing;

-- hearts (this week)
insert into public.hearts (from_user, to_user) values
  ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
on conflict do nothing;

-- achievement
insert into public.achievements (id, user_id, kind, title, description, issuer, achieved_on) values
  ('ffffffff-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','hackathon',
   'Campus Hack Night Finalist','Built a study-planner app in 12 hours.','Demo Coding Club', current_date - 30)
on conflict (id) do nothing;

-- 11.6 a 1-to-1 chat (aarav + meera) and a public group
insert into public.conversations (id, type, created_by, dm_key) values
  ('aaaaaaaa-0000-4000-8000-000000000001','dm','11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-0000-4000-8000-000000000002','group','11111111-1111-4111-8111-111111111111', null)
on conflict (id) do nothing;

insert into public.conversation_members (conversation_id, user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.groups (id, name, description, visibility, owner_id) values
  ('aaaaaaaa-0000-4000-8000-000000000002','VIT Chennai Coders','Demo public group for coders','public','11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','owner'),
  ('aaaaaaaa-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','member')
on conflict do nothing;

insert into public.messages (id, conversation_id, sender_id, kind, body, created_at) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','text','Hey Meera! Are you joining the hack night?', now() - interval '1 hour'),
  ('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','text','Yes! Let''s team up.',                       now() - interval '2 minutes'),
  ('cccccccc-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','text','Welcome to VIT Chennai Coders!',              now() - interval '30 minutes')
on conflict (id) do nothing;

insert into public.message_receipts (message_id, user_id, delivered_at, seen_at) values
  ('cccccccc-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222', now() - interval '59 minutes', now() - interval '58 minutes')
on conflict do nothing;

-- 11.7 campus content
insert into public.events (id, creator_id, title, description, location, club, starts_at) values
  ('dddddddd-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Hack Night (demo)','12 hours, snacks, and good vibes.','Academic Block 1','Coding Club', now() + interval '3 days')
on conflict (id) do nothing;
insert into public.event_going (event_id, user_id) values
  ('dddddddd-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222') on conflict do nothing;

insert into public.notices (id, author_id, title, body, pinned) values
  ('dddddddd-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','Welcome to Campusly (demo)','This is a demo pinned notice.', true)
on conflict (id) do nothing;

insert into public.teammate_posts (id, author_id, title, description, event_name, skills_needed, team_size) values
  ('dddddddd-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','Need a frontend dev for Hack Night','Looking for React + Figma people.','Hack Night (demo)', array['React','Figma'], 4)
on conflict (id) do nothing;

insert into public.study_rooms (id, creator_id, name, subject, description) values
  ('dddddddd-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','DSA Night Prep','Data Structures','Daily problem solving.')
on conflict (id) do nothing;

insert into public.lost_found (id, author_id, kind, title, description, location) values
  ('dddddddd-0000-4000-8000-000000000005','44444444-4444-4444-8444-444444444444','lost','Black water bottle','Lost near the library.','Library')
on conflict (id) do nothing;

insert into public.rides (id, author_id, origin, destination, depart_at, seats, cost_note) values
  ('dddddddd-0000-4000-8000-000000000006','33333333-3333-4333-8333-333333333333','VIT Chennai','Chennai Airport', now() + interval '2 days', 3, 'Split fuel')
on conflict (id) do nothing;

insert into public.confessions (id, author_id, body, status) values
  ('dddddddd-0000-4000-8000-000000000007','55555555-5555-4555-8555-555555555555','The library AC is the real MVP of exam season.','approved'),
  ('dddddddd-0000-4000-8000-000000000008','55555555-5555-4555-8555-555555555555','This one is waiting in the moderation queue.','pending')
on conflict (id) do nothing;

-- Tell the API to pick up all the new tables/functions right away
notify pgrst, 'reload schema';

-- =====================================================================
-- REMOVE DEMO DATA BEFORE LAUNCH (run separately, not now):
--   delete from public.conversations where id in
--     ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002');
--   delete from auth.users where email like '%.demo@vitstudent.ac.in';
--   delete from public.events  where id = 'dddddddd-0000-4000-8000-000000000001';
--   delete from public.notices where id = 'dddddddd-0000-4000-8000-000000000002';
-- =====================================================================
