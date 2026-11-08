import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Car, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { PostActions } from '@/components/campus/PostActions';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { createRide, deleteRide, listRides, setRideStatus } from '@/lib/api/campus';
import { formatDateTime } from '@/lib/utils';

export default function RidesPage() {
  const me = useAuth((s) => s.userId) as string;
  const state = useAsync(listRides, []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ origin: '', destination: '', depart_at: '', seats: '3', cost_note: '', notes: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await createRide({ ...form, seats: Number(form.seats), depart_at: new Date(form.depart_at).toISOString() }); toast.success('Ride posted.'); setOpen(false); setForm({ origin: '', destination: '', depart_at: '', seats: '3', cost_note: '', notes: '' }); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };
  const status = async (id: string, next: 'open' | 'full' | 'closed') => { try { await setRideStatus(id, next); await state.reload(); } catch (e) { toast.error(friendlyError(e)); } };
  const remove = async (id: string) => { try { await deleteRide(id); toast.success('Ride removed.'); await state.reload(); } catch (e) { toast.error(friendlyError(e)); } };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><Car className="h-7 w-7" aria-hidden="true" /> Rides</h1><p className="text-sm text-muted">Share a cab or find a seat.</p></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Offer a ride</Button>
      </header>
      <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && (state.data ?? []).length === 0}
        empty={<EmptyState icon={<Car className="h-6 w-6" />} title="No rides posted" text="Offer a seat or ask for one." action={<Button size="sm" onClick={() => setOpen(true)}>Post a ride</Button>} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(state.data ?? []).map((ride) => (
            <Card key={ride.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-semibold text-forest">{ride.origin} → {ride.destination}</h2><p className="text-xs text-muted">{formatDateTime(ride.depart_at)} · {ride.seats} seats · {ride.status}</p></div>
                <PostActions targetType="post" targetId={ride.id} targetName={`${ride.origin} to ${ride.destination}`} authorId={ride.author_id} authorName={ride.author?.full_name} onDelete={ride.author_id === me ? () => remove(ride.id) : undefined} onChanged={() => void state.reload()} />
              </div>
              {ride.cost_note && <p className="text-sm text-muted">Cost: {ride.cost_note}</p>}
              {ride.notes && <p className="text-sm text-muted">{ride.notes}</p>}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                <Link to={ride.author ? `/u/${ride.author.username}` : '/discover'} className="flex items-center gap-1.5 text-xs text-muted"><Avatar path={ride.author?.avatar_path} name={ride.author?.full_name} size={22} /> {ride.author?.full_name ?? 'A student'}</Link>
                {ride.author_id === me ? <div className="flex gap-1">{ride.status !== 'full' && <Button variant="ghost" size="sm" onClick={() => void status(ride.id, 'full')}>Mark full</Button>}{ride.status !== 'closed' && <Button variant="ghost" size="sm" onClick={() => void status(ride.id, 'closed')}>Close</Button>}</div> : ride.author && <Link to={`/u/${ride.author.username}`}><Button size="sm" variant="secondary">Contact</Button></Link>}
              </div>
            </Card>
          ))}
        </div>
      </AsyncView>

      <Modal open={open} title="Offer a ride" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="ride-form" loading={saving}>Post</Button></>}>
        <form id="ride-form" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Input label="From" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required maxLength={100} /><Input label="To" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required maxLength={100} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Leaving at" type="datetime-local" value={form.depart_at} onChange={(e) => setForm({ ...form, depart_at: e.target.value })} required /><Input label="Seats" type="number" min={1} max={8} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
          <Input label="Cost note" value={form.cost_note} onChange={(e) => setForm({ ...form, cost_note: e.target.value })} placeholder="Split fuel, ₹250 each" maxLength={80} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} />
        </form>
      </Modal>
    </div>
  );
}
