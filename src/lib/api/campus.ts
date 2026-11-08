import { supabase } from '../supabase';
import { unwrap } from '../errors';
import { requireUserId } from './auth';
import { getMiniProfiles, PUBLIC_COLUMNS } from './profiles';
import { compressImage, signedUrl, uploadFile, validateFile } from './storage';
import { safeFileName } from '../utils';
import type {
  EventRow, LostFound, MiniProfile, Notice, PublicProfile, Ride, SeniorQuestion, StudyNote, StudyRoom,
  TeammateInvite, TeammateMatch, TeammatePost, ConfessionFeedRow,
} from '@/types/db';

/* ---------------- Events ---------------- */
export interface EventWithCreator extends EventRow { creator: MiniProfile | null }

export async function listEvents(): Promise<EventWithCreator[]> {
  const res = await supabase.from('events_board').select('*').order('starts_at', { ascending: true }).limit(200);
  const rows = unwrap<EventRow[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.creator_id));
  return rows.map((r) => ({ ...r, creator: people.get(r.creator_id) ?? null }));
}

export interface EventInput {
  title: string; description: string; location: string; club: string; starts_at: string; ends_at: string;
}

export async function createEvent(input: EventInput): Promise<void> {
  const res = await supabase.from('events').insert({
    title: input.title.trim(),
    description: input.description.trim() || null,
    location: input.location.trim() || null,
    club: input.club.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at || null,
  });
  unwrap(res as { data: unknown; error: unknown });
}

export async function toggleGoing(eventId: string, going: boolean): Promise<void> {
  if (going) {
    const res = await supabase.from('event_going').delete().eq('event_id', eventId);
    unwrap(res as { data: unknown; error: unknown });
  } else {
    const res = await supabase.from('event_going').insert({ event_id: eventId });
    unwrap(res as { data: unknown; error: unknown });
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await supabase.from('events').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

/* ---------------- Teammates ---------------- */
export interface TeammatePostWithAuthor extends TeammatePost { author: MiniProfile | null }

export async function listTeammatePosts(): Promise<TeammatePostWithAuthor[]> {
  const res = await supabase.from('teammate_posts').select('*').order('created_at', { ascending: false }).limit(100);
  const rows = unwrap<TeammatePost[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: people.get(r.author_id) ?? null }));
}

export async function createTeammatePost(input: {
  title: string; description: string; event_name: string; skills_needed: string[]; team_size: number | null;
}): Promise<void> {
  const res = await supabase.from('teammate_posts').insert({
    title: input.title.trim(),
    description: input.description.trim() || null,
    event_name: input.event_name.trim() || null,
    skills_needed: input.skills_needed,
    team_size: input.team_size,
  });
  unwrap(res as { data: unknown; error: unknown });
}

export async function setTeammatePostStatus(id: string, status: 'open' | 'closed'): Promise<void> {
  const res = await supabase.from('teammate_posts').update({ status }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteTeammatePost(id: string): Promise<void> {
  const res = await supabase.from('teammate_posts').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function matchTeammates(postId: string): Promise<TeammateMatch[]> {
  const res = await supabase.rpc('match_teammate_profiles', { p_post: postId });
  return unwrap<TeammateMatch[]>(res) ?? [];
}

export async function inviteTeammate(postId: string, toUser: string, message: string): Promise<void> {
  const res = await supabase.from('teammate_invites').insert({ post_id: postId, to_user: toUser, message: message.trim() || null });
  unwrap(res as { data: unknown; error: unknown });
}

export interface InviteWithDetails {
  invite: TeammateInvite; post: TeammatePost | null; other: MiniProfile | null;
}

export async function listTeammateInvites(direction: 'incoming' | 'outgoing'): Promise<InviteWithDetails[]> {
  const me = await requireUserId();
  const column = direction === 'incoming' ? 'to_user' : 'from_user';
  const res = await supabase.from('teammate_invites').select('*').eq(column, me).order('created_at', { ascending: false });
  const invites = unwrap<TeammateInvite[]>(res) ?? [];
  if (!invites.length) return [];
  const postIds = [...new Set(invites.map((i) => i.post_id))];
  const postsRes = await supabase.from('teammate_posts').select('*').in('id', postIds);
  const posts = unwrap<TeammatePost[]>(postsRes) ?? [];
  const people = await getMiniProfiles(invites.map((i) => direction === 'incoming' ? i.from_user : i.to_user));
  const postMap = new Map(posts.map((p) => [p.id, p]));
  return invites.map((invite) => ({
    invite,
    post: postMap.get(invite.post_id) ?? null,
    other: people.get(direction === 'incoming' ? invite.from_user : invite.to_user) ?? null,
  }));
}

export async function respondTeammateInvite(id: string, status: 'accepted' | 'declined'): Promise<void> {
  const res = await supabase.from('teammate_invites').update({ status }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

/* ---------------- Study rooms ---------------- */
export interface StudyRoomWithCreator extends StudyRoom { creator: MiniProfile | null }
export interface StudyNoteWithUploader extends StudyNote { uploader: MiniProfile | null }

export async function listStudyRooms(): Promise<StudyRoomWithCreator[]> {
  const res = await supabase.from('study_rooms').select('*').order('created_at', { ascending: false }).limit(100);
  const rows = unwrap<StudyRoom[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.creator_id));
  return rows.map((r) => ({ ...r, creator: people.get(r.creator_id) ?? null }));
}

export async function createStudyRoom(name: string, subject: string, description: string): Promise<void> {
  const res = await supabase.from('study_rooms').insert({ name: name.trim(), subject: subject.trim() || null, description: description.trim() || null });
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteStudyRoom(id: string): Promise<void> {
  const res = await supabase.from('study_rooms').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function listStudyNotes(roomId: string): Promise<StudyNoteWithUploader[]> {
  const res = await supabase.from('study_notes').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
  const rows = unwrap<StudyNote[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.uploader_id));
  return rows.map((r) => ({ ...r, uploader: people.get(r.uploader_id) ?? null }));
}

export async function uploadStudyNote(roomId: string, title: string, file: File): Promise<void> {
  const problem = validateFile('notes', file);
  if (problem) throw new Error(problem);
  const me = await requireUserId();
  const path = `${roomId}/${me}/${safeFileName(file.name)}`;
  await uploadFile('notes', path, file, file.type);
  const res = await supabase.from('study_notes').insert({
    room_id: roomId, title: title.trim(), file_path: path, file_name: file.name,
    mime_type: file.type, size_bytes: file.size,
  });
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteStudyNote(id: string): Promise<void> {
  const res = await supabase.from('study_notes').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export function studyNoteUrl(path: string, name: string | null): Promise<string> {
  return signedUrl('notes', path, name ?? true);
}

/* ---------------- Lost & found ---------------- */
export interface LostFoundWithAuthor extends LostFound { author: MiniProfile | null }

export async function listLostFound(): Promise<LostFoundWithAuthor[]> {
  const res = await supabase.from('lost_found').select('*').order('created_at', { ascending: false }).limit(100);
  const rows = unwrap<LostFound[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: people.get(r.author_id) ?? null }));
}

export async function createLostFound(input: { kind: 'lost' | 'found'; title: string; description: string; location: string }, file: File | null): Promise<void> {
  let imagePath: string | null = null;
  if (file) {
    const problem = validateFile('campus-photos', file);
    if (problem) throw new Error(problem);
    const me = await requireUserId();
    const blob = await compressImage(file, 1280, 0.82);
    imagePath = `${me}/${safeFileName(file.name.replace(/\.[^.]+$/, '.jpg'))}`;
    await uploadFile('campus-photos', imagePath, blob, blob.type || 'image/jpeg');
  }
  const res = await supabase.from('lost_found').insert({
    kind: input.kind, title: input.title.trim(), description: input.description.trim() || null,
    location: input.location.trim() || null, image_path: imagePath,
  });
  unwrap(res as { data: unknown; error: unknown });
}

export async function resolveLostFound(id: string): Promise<void> {
  const res = await supabase.from('lost_found').update({ status: 'resolved' }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteLostFound(id: string): Promise<void> {
  const res = await supabase.from('lost_found').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export function lostFoundImageUrl(path: string): Promise<string> {
  return signedUrl('campus-photos', path);
}

/* ---------------- Rides ---------------- */
export interface RideWithAuthor extends Ride { author: MiniProfile | null }

export async function listRides(): Promise<RideWithAuthor[]> {
  const res = await supabase.from('rides').select('*').order('depart_at', { ascending: true }).limit(100);
  const rows = unwrap<Ride[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: people.get(r.author_id) ?? null }));
}

export async function createRide(input: {
  origin: string; destination: string; depart_at: string; seats: number; cost_note: string; notes: string;
}): Promise<void> {
  const res = await supabase.from('rides').insert({
    origin: input.origin.trim(), destination: input.destination.trim(), depart_at: input.depart_at,
    seats: input.seats, cost_note: input.cost_note.trim() || null, notes: input.notes.trim() || null,
  });
  unwrap(res as { data: unknown; error: unknown });
}

export async function setRideStatus(id: string, status: 'open' | 'full' | 'closed'): Promise<void> {
  const res = await supabase.from('rides').update({ status }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteRide(id: string): Promise<void> {
  const res = await supabase.from('rides').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

/* ---------------- Confessions ---------------- */
export async function listConfessions(): Promise<ConfessionFeedRow[]> {
  const res = await supabase.from('confessions_feed').select('*').order('created_at', { ascending: false }).limit(100);
  return unwrap<ConfessionFeedRow[]>(res) ?? [];
}

export async function createConfession(body: string): Promise<void> {
  const res = await supabase.from('confessions').insert({ body: body.trim() });
  unwrap(res as { data: unknown; error: unknown });
}

/* ---------------- Seniors ---------------- */
export async function listSeniors(myBatch: number): Promise<PublicProfile[]> {
  const me = await requireUserId();
  const res = await supabase.from('profiles_public').select(PUBLIC_COLUMNS).lt('batch', myBatch).neq('id', me).order('batch', { ascending: true }).limit(50);
  return unwrap<PublicProfile[]>(res) ?? [];
}

export interface SeniorQuestionWithPerson extends SeniorQuestion { other: MiniProfile | null }

export async function listMySeniorQuestions(): Promise<SeniorQuestionWithPerson[]> {
  const me = await requireUserId();
  const res = await supabase.from('senior_questions').select('*').eq('asker_id', me).order('created_at', { ascending: false });
  const rows = unwrap<SeniorQuestion[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.senior_id));
  return rows.map((r) => ({ ...r, other: people.get(r.senior_id) ?? null }));
}

export async function listIncomingSeniorQuestions(): Promise<SeniorQuestionWithPerson[]> {
  const me = await requireUserId();
  const res = await supabase.from('senior_questions').select('*').eq('senior_id', me).order('created_at', { ascending: false });
  const rows = unwrap<SeniorQuestion[]>(res) ?? [];
  const people = await getMiniProfiles(rows.map((r) => r.asker_id));
  return rows.map((r) => ({ ...r, other: people.get(r.asker_id) ?? null }));
}

export async function askSenior(seniorId: string, question: string): Promise<void> {
  const res = await supabase.from('senior_questions').insert({ senior_id: seniorId, question: question.trim() });
  unwrap(res as { data: unknown; error: unknown });
}

export async function answerSeniorQuestion(id: string, answer: string): Promise<void> {
  const res = await supabase.from('senior_questions').update({ answer: answer.trim() }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

/* ---------------- Notices ---------------- */
export async function listNotices(): Promise<Notice[]> {
  const res = await supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  return unwrap<Notice[]>(res) ?? [];
}

export async function createNotice(title: string, body: string, pinned: boolean, expiresAt: string | null): Promise<void> {
  const res = await supabase.from('notices').insert({ title: title.trim(), body: body.trim(), pinned, expires_at: expiresAt || null });
  unwrap(res as { data: unknown; error: unknown });
}

export async function setNoticePinned(id: string, pinned: boolean): Promise<void> {
  const res = await supabase.from('notices').update({ pinned }).eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}

export async function deleteNotice(id: string): Promise<void> {
  const res = await supabase.from('notices').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
}
