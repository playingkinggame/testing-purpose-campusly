import { useState, type FormEvent } from 'react';
import { Megaphone, Pin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { createNotice, deleteNotice, listNotices, setNoticePinned } from '@/lib/api/campus';
import { formatDateTime, timeAgo } from '@/lib/utils';

export default function NoticesPage() {
  const isAdmin = useAuth((s) => s.isAdmin);
  const state = useAsync(listNotices, []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', pinned: false, expires_at: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await createNotice(form.title, form.body, form.pinned, form.expires_at || null); toast.success('Notice published.'); setOpen(false); setForm({ title: '', body: '', pinned: false, expires_at: '' }); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><Megaphone className="h-7 w-7" aria-hidden="true" /> Notices</h1><p className="text-sm text-muted">Official updates from campus admins.</p></div>
        {isAdmin && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Post notice</Button>}
      </header>
      <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && (state.data ?? []).length === 0}
        empty={<EmptyState icon={<Megaphone className="h-6 w-6" />} title="No notices" text="Campus announcements will appear here." />}>
        <ul className="space-y-3">
          {(state.data ?? []).map((n) => (
            <li key={n.id}><Card className={n.pinned ? '!border-forest/30 !bg-mint/30' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="flex items-center gap-1.5 font-semibold text-forest">{n.pinned && <Pin className="h-4 w-4" aria-label="Pinned" />} {n.title}</h2><p className="text-xs text-muted">{timeAgo(n.created_at)}{n.expires_at ? ` · expires ${formatDateTime(n.expires_at)}` : ''}</p></div>
                {isAdmin && <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={async () => { try { await setNoticePinned(n.id, !n.pinned); await state.reload(); } catch (e) { toast.error(friendlyError(e)); } }}>{n.pinned ? 'Unpin' : 'Pin'}</Button><Button variant="ghost" size="sm" onClick={async () => { try { await deleteNotice(n.id); await state.reload(); } catch (e) { toast.error(friendlyError(e)); } }}>Delete</Button></div>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{n.body}</p>
            </Card></li>
          ))}
        </ul>
      </AsyncView>
      <Modal open={open} title="Post a notice" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="notice-form" loading={saving}>Publish</Button></>}>
        <form id="notice-form" onSubmit={submit} className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} />
          <Textarea label="Notice" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={2000} />
          <Input label="Expires (optional)" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="h-4 w-4 accent-forest" /> Pin this notice</label>
        </form>
      </Modal>
    </div>
  );
}
