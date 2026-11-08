# Prompt to finish Campusly (paste into a fresh AI chat and attach campusly-project.zip)

You are my senior full-stack engineer. I attached "campusly-project.zip": a Vite + React 19 + TypeScript + Tailwind v4 + Supabase app called Campusly (a VIT Chennai-only social and chat app). Batch 1 is DONE and builds cleanly (tsc and vite build pass). Your job: build ALL remaining features (batches 2 to 7) so the app is complete and deployable. I'm a beginner: give COMPLETE file contents (never "rest unchanged"), exact paths, short plain-English notes.

FIRST, READ (before writing any code), in this order:
1. README.md and package.json
2. supabase/phase1_database.sql and supabase/phase2_additions.sql. They are the SOURCE OF TRUTH for tables, column grants, RLS, views and RPCs. Both are already deployed in my Supabase project.
3. src/types/db.ts (types already written for every table/view/RPC)
4. src/App.tsx (routes; every unbuilt screen is a <ComingSoonPage/> placeholder you must replace)
5. src/lib/* (supabase client, errors.ts with unwrap() and friendlyError(), utils.ts, constants.ts, api/*), src/store/*, src/hooks/*, src/components/ui/*, src/components/layout/*, src/pages/*

WHAT ALREADY EXISTS (reuse it, don't rebuild it)
- Auth: email OTP login/signup (@vitstudent.ac.in only), onboarding, route guards (ProtectedRoute, PublicOnlyRoute, OnboardingRoute, AdminRoute), authStore (profile, isAdmin).
- Shell: AppShell, Sidebar, BottomTabs, navItems.ts, ErrorBoundary, Toaster (toast.*), useShellSync (presence ping, unread counts, realtime via lib/api/realtime.ts), unreadStore.
- UI kit: Button, Card, Input/Textarea/Select (Field), Tabs, TagInput, Pill/CountBadge, Avatar, Modal/ConfirmDialog, Spinner/EmptyState/ErrorState/AsyncView, useAsync, useEditCountdown (10-minute edit window).
- API layer (src/lib/api): auth, profiles (getMyProfile, updateMyProfile, getPublicProfile(ByUsername), getMiniProfiles, touchPresence, checkIsAdmin), connections (sendRequest, listIncoming/Outgoing/Accepted, respond, removeConnection, getRelation), conversations (listMine, startDm, markSeen, markAllDelivered), notifications, storage (validateFile, compressImage, uploadFile, signedUrl, avatarUrl, removeFile), realtime.
- Design: Tailwind tokens in src/index.css (cream #F5F8EF, forest #08482D, mint #DAE7C7, .glass cards, focus ring). Keep this look: Inter / Inter Tight, 16px rounded, lucide icons, motion for light transitions, no real brand logos, no official VIT logo.

HARD RULES
- Do NOT edit supabase/phase1_database.sql (re-running it wipes all policies). If you need new database things, create supabase/phase3_additions.sql (safe to re-run; RLS on every new table; function search_path = ''; REVOKE execute from public/anon/authenticated and GRANT to authenticated only; narrow column grants; end with `notify pgrst, 'reload schema';`). Tell me clearly when I must run it.
- Respect the column grants in the SQL: profiles update only granted columns; messages update only body/deleted_at (edit/unsend only within 10 minutes, enforced by DB; "(edited)" = edited_at set, unsent = deleted_at set); confessions insert body only; chats and groups are created only by RPCs (start_dm, create_group(text,text,text,uuid[]), join_public_group, add_group_member); connections update only status; hearts are insert-only with to_user.
- UI never calls supabase directly: add new api modules in src/lib/api/*.ts using unwrap(). Every screen: loading, empty and error states (AsyncView). Mobile-first responsive, accessible (labels, focus, alt text). Never use the service-role key. Storage paths exactly as written in the SQL comments (avatars/<uid>/..., certificates/<uid>/..., chat-files/<conversation>/<uid>/..., voice-notes/<conversation>/<uid>/..., notes/<room>/<uid>/...). Private buckets use signed URLs.
- After every batch the project must still pass `npx tsc --noEmit` and `npm run build`. Check your own types against src/types/db.ts.

BATCHES (deliver one per reply; at the end of each give: files created/changed, a test checklist, and the line "Batch N done. Say continue.")

BATCH 2: PROFILE + ACHIEVEMENTS
Routes /profile, /profile/edit, /u/:username. Own and others' profile (header, detail chips, badges via user_badges, streak, hearts, last seen respecting privacy), edit form (reuse ProfileForm), privacy toggles (hide_online, hide_last_seen, hide_reg_no), achievements wall (add/edit/delete; types certificate/hackathon/fest/club_role/other; image/PDF upload to certificates bucket with signed URLs), buttons: Connect / Pending / Accept / Message / Heart (once per week) / Report / Block (use getRelation), blocked-users list in settings (list_blocked_users RPC) with Unblock.

BATCH 3: DISCOVER + REQUESTS
Routes /discover, /requests. discover_people RPC (match %, reasons, mutual_count, connection_status) with filters (batch, branch, school, residence, interest, search), pagination, person cards with Connect/Pending/Accept; weekly_leaderboard view ("Most loved"); Requests page (incoming accept/decline, outgoing cancel, accepted list with Message and Remove); notifications bell/list (notifications table, mark read, realtime).

BATCH 4: 1-TO-1 CHAT (the big one; split in two replies if needed)
Routes /chat, /chat/:id. Chat list from list_my_conversations (unread counts, last message preview, "unsent" preview, online dot). Conversation view: history with infinite scroll (keyset by created_at), optimistic send, text/long messages/emoji, image + file upload (chat-files), voice notes (MediaRecorder, waveform smallint[] up to 200 values, duration_ms, playback, voice-notes bucket), reply (reply_to), reactions (message_reactions), edit/unsend with visible 10-minute countdown (useEditCountdown; UI locks after, DB enforces), "(edited)" and "This message was unsent", delivered/seen ticks from message_receipts (mark_all_delivered, mark_conversation_seen), typing indicator via Realtime broadcast, online dot + "last seen" via Realtime Presence plus profiles_public.last_seen_at (show nothing when hidden), reconnect handling, group-safe components so Batch 5 reuses them.

BATCH 5: GROUPS
Routes /groups, /groups/new, /groups/:id. My groups, browse public groups (join_public_group, leave), create private group from accepted connections (create_group), group chat reusing Batch 4 components, member list, roles (owner/admin/member), add/remove members (add_group_member, delete on group_members), promote/demote, rename/description/avatar via granted columns, announcements, pinned messages (pinned_messages).

BATCH 6: CAMPUS FEATURES
/events (events_board view; create; filters by club and date; Going toggle with going_count and i_going), /teammates (teammate_posts with skill tags; match_teammate_profiles RPC; Invite via teammate_invites; invitee Accept/Decline), /study (study_rooms + study_notes upload/download in notes bucket), /lost-found (lost_found with optional image), /rides (rides; status open/full/closed), /confessions (post body only; read ONLY from confessions_feed; never fetch or show an author; "pending moderation" message after posting), /seniors (list seniors: profiles_public where batch is lower than mine; ask via senior_questions; seniors answer; asker sees answers), /notices (notices, pinned first, hide expired). Every post type has Report. "Message" buttons call startDm if connected, otherwise offer Connect.

BATCH 7: SAFETY, ADMIN, POLISH, DEPLOY
Reusable ReportDialog (reports table, reasons enum) wired on profiles, messages, posts, confessions, groups, events; Block everywhere. /admin (AdminRoute): reports queue (admin_list_reports, admin_resolve_report), confessions moderation (admin_list_pending_confessions, admin_review_confession), create/pin/delete notices. Notification badges polish, route-level code splitting (React.lazy) to fix the >500 kB bundle warning, error boundaries, 404, PWA manifest check. Then write DEPLOY.md: Supabase steps (run phase1 -> phase2 -> phase3 if any, Email auth with OTP code, Site URL and Redirect URLs, Realtime check, delete demo seed data at the bottom of phase1), Vercel steps (env vars VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, build command, vercel.json already included), a security checklist per table and bucket, a pre-launch test checklist, and the 10 most likely errors with fixes (OTP redirect, "permission denied", expired signed URL, realtime not firing, microphone permission, etc.).

DELIVERY RULES
1. Your first reply: a table of every file you will add or change per batch (one line each) and any phase3 SQL you foresee. No code yet.
2. Then one batch per reply. If you can create downloadable files, give them; otherwise print every file under a header with its exact path in a code block. If a batch is too long, finish what fits and say "continue".
3. Keep names and types consistent across batches. Before the final batch, re-read this prompt and list anything still missing.
4. When all batches are done, give the final zip contents list and a 15-minute test script covering: sign up, onboarding, connect two accounts, chat with a file and a voice note, edit and unsend, create a group, post an event, confession moderation by an admin.

Begin with delivery rule 1.
