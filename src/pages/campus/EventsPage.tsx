import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { PostActions } from '@/components/campus/PostActions';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { createEvent, deleteEvent, listEvents, toggleGoing } from '@/lib/api/campus';
import { formatDateTime } from '@/lib/utils';

type Tab = 'upcoming' | 'past';

export default function EventsPage() {
  const me = useAuth((s) => s.userId) as string;
  const state = useAsync(listEvents, []);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', location: '', club: '', starts_at: '', ends_at: '' });

  const events = state.data ?? [];
  const now = Date.now();
  const rows = events.filter((e) => tab === 'upcoming' ? new Date(e.starts_at).getTime() >= now : new Date(e.starts_at).getTime() < now);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await createEvent({ ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : '' }); toast.success('Event posted.'); setOpen(false); setForm({ title: '', description: '', location: '', club: '', starts_at: '', ends_at: '' }); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  const rsvp = async (id: string, going: boolean) => {
    setBusy(id);
    try { await toggleGoing(id, going); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    try { await deleteEvent(id); toast.success('Event deleted.'); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><CalendarDays className="h-7 w-7" aria-hidden="true" /> Events</h1><p className="text-sm text-muted">What is happening around campus.</p></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Post event</Button>
      </header>
      <Tabs label="Events" value={tab} onChange={(t) => setTab(t as Tab)} tabs={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }]} />
      <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && rows.length === 0}
        empty={<EmptyState icon={<CalendarDays className="h-6 w-6" />} title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'} text="Be the first to post something." action={<Button size="sm" onClick={() => setOpen(true)}>Post an event</Button>} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((event) => (
            <Card key={event.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h2 className="font-semibold text-forest">{event.title}</h2>{event.club && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-forest">{event.club}</span>}</div>
                <PostActions targetType="event" targetId={event.id} targetName={event.title} authorId={event.creator_id} authorName={event.creator?.full_name} onDelete={event.creator_id === me ? () => remove(event.id) : undefined} onChanged={() => void state.reload()} />
              </div>
              {event.description && <p className="text-sm text-muted">{event.description}</p>}
              <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {formatDateTime(event.starts_at)}</p>
              {event.location && <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {event.location}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <Link to={event.creator ? `/u/${event.creator.username}` : '/discover'} className="flex min-w-0 items-center gap-1.5 text-xs text-muted"><Avatar path={event.creator?.avatar_path} name={event.creator?.full_name} size={22} /><span className="truncate">{event.creator?.full_name ?? 'A student'}</span></Link>
                <Button size="sm" variant={event.i_going ? 'secondary' : 'primary'} loading={busy === event.id} onClick={() => void rsvp(event.id, event.i_going)}>{event.i_going ? `Going · ${event.going_count}` : `I'm going · ${event.going_count}`}</Button>
              </div>
            </Card>
          ))}
        </div>
      </AsyncView>

      <Modal open={open} title="Post an event" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="event-form" loading={saving}>Post</Button></>}>
        <form id="event-form" onSubmit={submit} className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} /><Input label="Club (optional)" value={form.club} onChange={(e) => setForm({ ...form, club: e.target.value })} maxLength={80} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Starts" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required /><Input label="Ends (optional)" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
        </form>
      </Modal>
    </div>
  );
}
