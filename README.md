# Campusly

A mobile-first campus social app for VIT students: profiles, connections, chat, groups, events, teammates, study rooms, lost & found, rides, anonymous confessions, senior Q&A and notices.

Built with **Vite + React 19 + TypeScript + Tailwind CSS v4 + Supabase**.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Run the SQL files in `supabase/` in order (see [DEPLOY.md](DEPLOY.md)). Then reload the app.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview the production build |

## Features

- **Auth & onboarding** — email signup, profile setup, unique usernames, avatar upload.
- **Profiles** — public profiles, achievements, certificates, badges, hearts, privacy settings, blocked users.
- **Discover** — filters, compatibility scores, leaderboard, connection requests.
- **Chat** — direct messages, images, files, voice notes, replies, reactions, read receipts, typing indicators, edit/unsend within 10 minutes, pinned messages.
- **Groups** — public/private groups, member roles, announcements, group chat and pins.
- **Campus boards** — events with RSVP, teammate finder with smart matching and invites, study rooms with notes, lost & found, ride sharing.
- **Community** — anonymous moderated confessions, senior connect Q&A, official notices.
- **Notifications** — in-app bell, activity list, realtime unread badges.
- **Admin** — report queue, confession moderation, notice publishing.

## Structure

```
src/
  components/   shared UI, layout, chat, social, discover, campus
  hooks/        async data, pagination, realtime, chat, presence
  lib/api/      every Supabase query lives here (UI never calls Supabase directly)
  pages/        route screens
  store/        auth, unread and presence stores
  types/        database types
supabase/       phase1, phase2 and phase3 SQL
```

## Safety

- RLS is enabled on every table; the app uses only the anon key.
- Private storage buckets are read through signed URLs.
- Reports, blocking, privacy toggles and confession moderation are built in.
- No service-role key belongs in this repository.
