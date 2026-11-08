# Deploying Campusly

## 1. Supabase

1. Create a Supabase project.
2. **SQL Editor** -> run these files **in order** (each one: paste all, press Run):
   1. `supabase/phase1_database.sql` (run it ONCE on a fresh project. Re-running wipes and rebuilds all policies)
   2. `supabase/phase2_additions.sql`
   3. `supabase/phase3_additions.sql` (lost & found photo bucket; safe to re-run)
   4. `supabase/phase4_password_auth.sql` (password sign-in helpers; safe to re-run)
3. **Authentication -> Sign In / Providers -> Email**: Email provider ON, minimum password length `8`. Keep **Confirm email** ON for a real launch (students must click the link sent to their `@vitstudent.ac.in` inbox). For quick local testing you may turn it off.
4. **Authentication -> URL Configuration**: set **Site URL** to your live address. Add to **Redirect URLs**:
   - `http://localhost:3000/app.html`
   - `https://YOUR-DOMAIN/app.html`
5. **Project Settings -> Authentication -> SMTP**: add your own SMTP before launch (the built-in sender allows only a few emails per hour).
6. **Realtime**: Database -> Replication (Publications). `messages`, `message_reactions`, `message_receipts`, `connections` must be enabled for `supabase_realtime`.
7. **Project Settings -> API**: copy the Project URL and the `anon` / publishable key. Never use the `service_role` / secret key in this project.
8. **Delete the demo data** at the bottom of `phase1_database.sql` (the commented "REMOVE DEMO DATA BEFORE LAUNCH" block). Run those four `delete` lines once.

Only `@vitstudent.ac.in` emails can ever be created: the database trigger `enforce_vit_email` rejects every other domain, even if someone bypasses the website.

## 2. Run locally

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY
```

```bash
npm install
npm run dev     # http://localhost:3000 (landing)  and  /app.html#/login (app)
npm run build   # type-check + production build
```

## 3. Make yourself admin

Sign up, confirm your email, then in the SQL editor (use your own email):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'your.name@vitstudent.ac.in'
on conflict do nothing;
```

Reload the app: **Admin** appears in the menu.

## 4. Deploy on Vercel

1. Push the project to GitHub (`.env` and `.env.local` are git-ignored; never commit them).
2. Vercel -> **Add New Project** -> import the repo. Framework: Vite. Build command `npm run build`. Output directory `dist` (`vercel.json` already says this).
3. **Settings -> Environment Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
4. Put the final Vercel address into Supabase **Site URL** and **Redirect URLs** (step 1.4).

## 5. Security checklist

Tables: every table has Row Level Security on (phase 1 turns it on for all of `public`).

| Item | What protects it |
| --- | --- |
| `profiles` | you read/update only your own row; others see `profiles_public` (hides room no., hidden reg no., hidden last seen, blocked people) |
| `messages` | members only; edit/unsend only by the sender within 10 minutes (database trigger) |
| `connections` | only the receiver can accept/decline; chat only between accepted connections |
| `confessions` | author column is unreadable by everyone; the app reads `confessions_feed`; only admins moderate |
| `admins`, `badges`, `user_badges` | no write access from the app |
| Chats and groups | created only by RPCs (`start_dm`, `create_group`, `join_public_group`, `add_group_member`) |

Buckets: `avatars` is **public-read** (profile photos). `certificates`, `chat-files`, `voice-notes`, `notes` and `campus-photos` are **private** (signed URLs). Chat files and voice notes: conversation members only. Certificates, notes and campus photos: any signed-in student can view, only the owner uploads or deletes.

Also check: no `service_role` key anywhere in the code (`grep -ri service_role src`), and `.env` is not in the repository.

## 6. Pre-launch test (15 minutes, two browsers or one normal + one private window)

1. Sign up Account A with a real VIT email. A non-VIT email must show an error.
2. Confirm the email link, finish onboarding (photo, username, reg no.).
3. Sign up Account B the same way.
4. A: Discover -> Connect to B. B: Requests -> Accept.
5. A messages B: send text, an image, a PDF, a voice note (allow the microphone).
6. Check typing indicator, delivered/seen ticks, reply, reaction.
7. Edit a message, then unsend one. After 10 minutes both must be locked.
8. A creates a private group with B and posts a message and an announcement.
9. Post an event; B marks Going.
10. B posts a confession; confirm it shows "pending". Admin approves it in /admin; it appears on the feed with no author.
11. Report a post; resolve it in /admin.
12. Block B from A; B must no longer find A or message A.

## 7. The 10 most likely errors

| Problem | Fix |
| --- | --- |
| `npm run build` fails on types | run `npx tsc --noEmit` and fix the first error shown |
| Email link opens but you are logged out / "link expired" | add the exact `.../app.html` address to Supabase Redirect URLs; links are single-use, request a new one |
| "Email rate limit exceeded" | add custom SMTP (step 1.5) |
| "Database error saving new user" | the email is not `@vitstudent.ac.in` |
| "We could not find your profile" | run `phase4_password_auth.sql`, log in again |
| "permission denied" / "row-level security" | a phase file was skipped or phase 1 was re-run without phase 2-4. Run them again in order |
| Lost & found photos broken for other students | re-run `phase3_additions.sql` |
| Image or file shows "expired" | signed links last about an hour; reload the page |
| Chat does not update live | enable the 4 tables in Realtime (step 1.6); check the browser console for websocket errors |
| Voice note will not record | allow the microphone in the browser; the site must be HTTPS (Vercel is) |
