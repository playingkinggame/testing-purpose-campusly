import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { MiniProfile, MyProfile, ProfilePatch, PublicProfile } from '@/types/db';

export const PUBLIC_COLUMNS =
  'id, username, full_name, avatar_path, batch, branch, school, residence, hostel_block, clubs, languages, interests, bio, social_link, streak_count, hearts_total, reg_no, last_seen_at, created_at';
export const MINI_COLUMNS = 'id, username, full_name, avatar_path';

// Exactly the columns the database lets me update (see "grant update (...)" in phase1_database.sql).
const GRANTED: Array<keyof ProfilePatch> = [
  'username', 'full_name', 'avatar_path', 'reg_no', 'batch', 'branch', 'school', 'residence', 'hostel_block',
  'room_no', 'clubs', 'languages', 'interests', 'bio', 'social_link', 'hide_online', 'hide_last_seen',
  'hide_reg_no', 'onboarded',
];

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const res = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return unwrap<MyProfile | null>(res);
}

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<MyProfile> {
  const clean: Record<string, unknown> = {};
  for (const k of GRANTED) if (k in patch) clean[k] = patch[k];
  const res = await supabase.from('profiles').update(clean).eq('id', userId).select('*').single();
  return unwrap<MyProfile>(res);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const res = await supabase.rpc('is_username_available', { p_username: username });
  return unwrap<boolean>(res) === true;
}

export async function touchPresence(): Promise<void> {
  await supabase.rpc('touch_presence'); // errors here are not worth showing
}

export async function checkIsAdmin(): Promise<boolean> {
  const res = await supabase.rpc('is_admin');
  return res.error ? false : res.data === true;
}

export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const res = await supabase.from('profiles_public').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle();
  return unwrap<PublicProfile | null>(res);
}

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const res = await supabase.from('profiles_public').select(PUBLIC_COLUMNS).eq('username', username.toLowerCase()).maybeSingle();
  return unwrap<PublicProfile | null>(res);
}

/** Look up many people at once. Blocked people simply do not appear (the view hides them). */
export async function getMiniProfiles(ids: string[]): Promise<Map<string, MiniProfile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, MiniProfile>();
  if (!unique.length) return map;
  const res = await supabase.from('profiles_public').select(MINI_COLUMNS).in('id', unique);
  for (const p of unwrap<MiniProfile[]>(res) ?? []) map.set(p.id, p);
  return map;
}
