import { supabase } from '../supabase';
import { unwrap } from '../errors';
import { requireUserId } from './auth';
import { getMiniProfiles } from './profiles';
import { compressImage, uploadFile, validateFile } from './storage';
import { safeFileName } from '../utils';
import type { Announcement, Group, GroupMember, GroupRole, MiniProfile, PinnedMessage } from '@/types/db';

export interface GroupWithRole extends Group { role: GroupRole }
export interface GroupMemberWithProfile extends GroupMember { person: MiniProfile | null }
export interface AnnouncementWithAuthor extends Announcement { author: MiniProfile | null }
export interface PinnedWithAuthor extends PinnedMessage { sender: MiniProfile | null }

export async function listMyGroups(): Promise<GroupWithRole[]> {
  const me = await requireUserId();
  const links = await supabase.from('group_members').select('group_id, role').eq('user_id', me);
  const rows = unwrap<Array<{ group_id: string; role: GroupRole }>>(links) ?? [];
  if (!rows.length) return [];
  const roles = new Map(rows.map((r) => [r.group_id, r.role]));
  const res = await supabase.from('groups').select('*').in('id', rows.map((r) => r.group_id)).order('created_at', { ascending: false });
  const groups = unwrap<Group[]>(res) ?? [];
  return groups.map((g) => ({ ...g, role: roles.get(g.id) ?? 'member' }));
}

export async function listPublicGroups(): Promise<Group[]> {
  const res = await supabase.from('groups').select('*').eq('visibility', 'public').order('member_count', { ascending: false }).limit(50);
  return unwrap<Group[]>(res) ?? [];
}

export async function getGroup(id: string): Promise<{ group: Group; role: GroupRole | null; members: GroupMemberWithProfile[] } | null> {
  const groupRes = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
  const group = unwrap<Group | null>(groupRes);
  if (!group) return null;
  const me = await requireUserId();
  const roleRes = await supabase.from('group_members').select('role').eq('group_id', id).eq('user_id', me).maybeSingle();
  const role = (unwrap<{ role: GroupRole } | null>(roleRes)?.role ?? null);
  const membersRes = await supabase.from('group_members').select('*').eq('group_id', id).order('joined_at');
  const memberRows = unwrap<GroupMember[]>(membersRes) ?? [];
  const people = await getMiniProfiles(memberRows.map((m) => m.user_id));
  const members = memberRows
    .map((m) => ({ ...m, person: people.get(m.user_id) ?? null }))
    .sort((a, b) => {
      const rank = { owner: 0, admin: 1, member: 2 };
      return rank[a.role] - rank[b.role] || (a.person?.full_name ?? '').localeCompare(b.person?.full_name ?? '');
    });
  return { group, role, members };
}

export async function createGroup(name: string, description: string, visibility: 'public' | 'private', memberIds: string[]): Promise<string> {
  const res = await supabase.rpc('create_group', {
    p_name: name.trim(),
    p_description: description.trim() || null,
    p_visibility: visibility,
    p_member_ids: memberIds,
  });
  return unwrap<string>(res);
}

export async function joinGroup(id: string): Promise<void> {
  const res = await supabase.rpc('join_public_group', { p_group: id });
  unwrap(res as { data: unknown; error: unknown });
}

export async function leaveGroup(id: string): Promise<void> {
  const me = await requireUserId();
  const res = await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', me);
  unwrap(res as { data: unknown; error: unknown });
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  const res = await supabase.rpc('add_group_member', { p_group: groupId, p_user: userId });
  unwrap(res as { data: unknown; error: unknown });
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const res = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  unwrap(res as { data: unknown; error: unknown });
}

export async function setGroupRole(groupId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const res = await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId);
  unwrap(res as { data: unknown; error: unknown });
}

export async function updateGroup(id: string, patch: { name?: string; description?: string | null; avatar_path?: string | null }): Promise<Group> {
  const res = await supabase.from('groups').update(patch).eq('id', id).select('*').single();
  return unwrap<Group>(res);
}

export async function uploadGroupAvatar(file: File): Promise<string> {
  const problem = validateFile('avatars', file);
  if (problem) throw new Error(problem);
  const me = await requireUserId();
  const blob = await compressImage(file, 640, 0.85);
  const path = `${me}/group-${safeFileName(file.name.replace(/\.[^.]+$/, '.jpg'))}`;
  await uploadFile('avatars', path, blob, blob.type || 'image/jpeg');
  return path;
}

export async function listAnnouncements(groupId: string): Promise<AnnouncementWithAuthor[]> {
  const res = await supabase.from('announcements').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
  const rows = unwrap<Announcement[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: people.get(r.author_id) ?? null }));
}

export async function createAnnouncement(groupId: string, title: string, body: string): Promise<void> {
  const res = await supabase.from('announcements').insert({ group_id: groupId, title: title.trim(), body: body.trim() });
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const res = await supabase.from('announcements').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}
