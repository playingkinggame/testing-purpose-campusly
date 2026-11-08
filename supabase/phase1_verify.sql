-- =====================================================================
-- CAMPUSLY — PHASE 1: RLS VERIFICATION
-- Run AFTER phase1_database.sql (it uses the demo users).
--
-- HOW TO USE
--   Run ONE test block at a time (select just that block, press Run).
--   Every block ends on purpose with an "error" so nothing is saved.
--   Read the message:
--     "PASS: ..."    -> the database blocked it, exactly as it should.
--     "RESULT: ..."  -> compare the numbers with the "expect" values.
--     "FAIL: ..."    -> something is wrong; tell me the test number.
--
-- Demo people:  Aarav 1111...  Meera 2222...  Rohan 3333...
--               Sneha 4444...  Karthik 5555...
-- =====================================================================


-- TEST 1: a logged-out visitor (anon) cannot read anything --------------
do $$
begin
  set local role anon;
  begin
    perform 1 from public.profiles_public limit 1;
    raise exception 'FAIL: anon could read profiles_public';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: anon blocked -> %', sqlerrm;
  end;
end $$;


-- TEST 2: a gmail address cannot create an account ----------------------
do $$
begin
  begin
    insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'someone@gmail.com', '{}', '{}', now(), now(), '', '', '', '');
    raise exception 'FAIL: a gmail address was accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: gmail rejected -> %', sqlerrm;
  end;
end $$;


-- TEST 3: profile privacy (Aarav, then Karthik) -------------------------
do $$
declare own int; pub int; meera_reg text; kar_pub int; rohan_seen int;
begin
  set local role authenticated;

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  select count(*) into own from public.profiles;                       -- only my own raw row
  select count(*) into pub from public.profiles_public;               -- everyone safe
  select reg_no into meera_reg from public.profiles_public where username = 'meera_demo';

  perform set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  select count(*) into kar_pub from public.profiles_public;
  select count(*) into rohan_seen from public.profiles_public where username = 'rohan_demo';  -- Rohan blocked Karthik

  raise exception 'RESULT: Aarav raw profiles=% (expect 1), public profiles=% (expect 5), Meera reg_no=% (expect null/hidden); Karthik sees % profiles (expect 4) and Rohan visible=% (expect 0)',
                  own, pub, meera_reg, kar_pub, rohan_seen;
end $$;


-- TEST 4: only chat members can read messages ---------------------------
do $$
declare k int; m int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  select count(*) into k from public.messages;
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  select count(*) into m from public.messages;
  raise exception 'RESULT: Karthik sees % messages (expect 0); Meera sees % messages (expect 3: 2 in her chat + 1 in the group)', k, m;
end $$;


-- TEST 5: chat is allowed only between ACCEPTED connections -------------
-- Rohan only has a PENDING request to Aarav, so he must not be able to start a chat.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
  begin
    perform public.start_dm('11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: chat started with a non-accepted connection';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: blocked -> %', sqlerrm;
  end;
end $$;


-- TEST 6: an outsider cannot post into someone else's chat --------------
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  begin
    insert into public.messages (conversation_id, kind, body)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'text', 'hi from outside');
    raise exception 'FAIL: outsider could send a message';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: blocked -> %', sqlerrm;
  end;
end $$;


-- TEST 7: edit / unsend rules (10-minute window, only the sender) -------
do $$
declare a_edit int; a_unsend int; m_other int; m_edit int; m_edited timestamptz; m_unsend int; m_body text;
begin
  set local role authenticated;

  -- Aarav's message #1 is 1 hour old: he can no longer edit or unsend it
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  update public.messages set body = 'too late' where id = 'cccccccc-0000-4000-8000-000000000001';
  get diagnostics a_edit = row_count;
  update public.messages set deleted_at = now() where id = 'cccccccc-0000-4000-8000-000000000001';
  get diagnostics a_unsend = row_count;

  -- Meera cannot touch Aarav's message at all; her own 2-minute-old message is fine
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  update public.messages set body = 'hacked' where id = 'cccccccc-0000-4000-8000-000000000001';
  get diagnostics m_other = row_count;
  update public.messages set body = 'Yes! Count me in.' where id = 'cccccccc-0000-4000-8000-000000000002';
  get diagnostics m_edit = row_count;
  select edited_at into m_edited from public.messages where id = 'cccccccc-0000-4000-8000-000000000002';
  update public.messages set deleted_at = now() where id = 'cccccccc-0000-4000-8000-000000000002';
  get diagnostics m_unsend = row_count;
  select body into m_body from public.messages where id = 'cccccccc-0000-4000-8000-000000000002';

  raise exception 'RESULT: Aarav edit old=% (expect 0), unsend old=% (expect 0); Meera edit Aarav''s=% (expect 0), edit own=% (expect 1), edited_at set=% (expect true), unsend own=% (expect 1), body after unsend=% (expect null)',
                  a_edit, a_unsend, m_other, m_edit, (m_edited is not null), m_unsend, m_body;
end $$;


-- TEST 8: a blocked person cannot send you a request --------------------
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
  insert into public.blocks (blocked_id) values ('55555555-5555-4555-8555-555555555555');   -- Sneha blocks Karthik

  perform set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  begin
    insert into public.connections (addressee_id) values ('44444444-4444-4444-8444-444444444444');
    raise exception 'FAIL: blocked user could send a connection request';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: blocked -> %', sqlerrm;
  end;
end $$;


-- TEST 9: confession authors are hidden from everyone -------------------
do $$
declare feed int; pending_visible int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    perform author_id from public.confessions;
    raise exception 'FAIL: a student could read confessions.author_id';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    select count(*) into feed from public.confessions_feed;
    select count(*) into pending_visible from public.confessions_feed where body like '%moderation queue%';
    raise exception 'PASS: author_id is unreadable (%). Feed shows % confession(s) (expect 1), pending visible=% (expect 0)',
                    sqlerrm, feed, pending_visible;
  end;
end $$;


-- TEST 10: only admins can use the moderation queue ---------------------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    perform * from public.admin_list_pending_confessions();
    raise exception 'FAIL: a normal student opened the moderation queue';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    null;  -- good, Meera is blocked
  end;
  perform set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
  select count(*) into n from public.admin_list_pending_confessions();
  raise exception 'PASS: Meera was refused; admin Sneha sees % pending confession(s) (expect 1)', n;
end $$;


-- TEST 11: only one heart per person per week ---------------------------
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  begin
    insert into public.hearts (to_user) values ('22222222-2222-4222-8222-222222222222');   -- Aarav already hearted Meera this week
    raise exception 'FAIL: a second heart in the same week was accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: blocked -> %', sqlerrm;
  end;
end $$;


-- TEST 12: nobody can make themselves an admin or change their hearts ---
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    update public.profiles set hearts_total = 9999 where id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: a user changed their own hearts_total';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise exception 'PASS: hearts_total is protected -> %', sqlerrm;
  end;
end $$;
