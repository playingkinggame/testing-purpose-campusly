import { supabase } from '../supabase';
import { unwrap } from '../errors';
import { requireUserId } from './auth';
import { getMiniProfiles } from './profiles';
import type { Connection, MiniProfile, RelationStatus } from '@/types/db';

export interface ConnectionWithPerson extends Connection {
  person: MiniProfile | null; // the OTHER person
}

async function attachPeople(rows: Connection[], me: string): Promise<ConnectionWithPerson[]> {
  const ids = rows.map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id));
  const people = await getMiniProfiles(ids);
  return rows
    .map((r) => ({ ...r, person: people.get(r.requester_id === me ? r.addressee_id : r.requester_id) ?? null }))
    // someone blocked either way is hidden everywhere
    .filter((r) => r.person !== null);
}

export async function sendRequest(toUserId: string): Promise<void> {
  const res = await supabase.from('connections').insert({ addressee_id: toUserId });
  unwrap(res as { data: unknown; error: unknown });
}

export async function listIncoming(): Promise<ConnectionWithPerson[]> {
  const me = await requireUserId();
  const res = await supabase.from('connections').select('*').eq('addressee_id', me).eq('status', 'pending').order('created_at', { ascending: false });
  return attachPeople(unwrap<Connection[]>(res) ?? [], me);
}

export async function listOutgoing(): Promise<ConnectionWithPerson[]> {
  const me = await requireUserId();
  const res = await supabase.from('connections').select('*').eq('requester_id', me).eq('status', 'pending').order('created_at', { ascending: false });
  return attachPeople(unwrap<Connection[]>(res) ?? [], me);
}

export async function listAccepted(): Promise<ConnectionWithPerson[]> {
  const me = await requireUserId();
  const res = await supabase.from('connections').select('*').eq('status', 'accepted').order('responded_at', { ascending: false });
  return attachPeople(unwrap<Connection[]>(res) ?? [], me);
}

export async function respond(connectionId: string, status: 'accepted' | 'declined'): Promise<void> {
  const res = await supabase.from('connections').update({ status }).eq('id', connectionId);
  unwrap(res as { data: unknown; error: unknown });
}

/** Cancel my pending request, or remove an accepted connection. */
export async function removeConnection(connectionId: string): Promise<void> {
  const res = await supabase.from('connections').delete().eq('id', connectionId);
  unwrap(res as { data: unknown; error: unknown });
}

export async function countIncoming(): Promise<number> {
  const me = await requireUserId();
  const { count, error } = await supabase.from('connections').select('id', { count: 'exact', head: true }).eq('addressee_id', me).eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

/** How am I connected to this person? */
export async function getRelation(otherId: string): Promise<{ id: string | null; status: RelationStatus }> {
  const me = await requireUserId();
  const res = await supabase
    .from('connections')
    .select('*')
    .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`)
    .limit(1);
  const row = (unwrap<Connection[]>(res) ?? [])[0];
  if (!row) return { id: null, status: 'none' };
  const mine = row.requester_id === me;
  if (row.status === 'accepted') return { id: row.id, status: 'accepted' };
  if (row.status === 'pending') return { id: row.id, status: mine ? 'pending_out' : 'pending_in' };
  if (row.status === 'declined') return { id: row.id, status: mine ? 'declined_out' : 'declined_in' };
  return { id: row.id, status: 'none' };
}
