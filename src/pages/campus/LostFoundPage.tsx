import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, PackageSearch, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { PostActions } from '@/components/campus/PostActions';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { createLostFound, deleteLostFound, listLostFound, lostFoundImageUrl, resolveLostFound } from '@/lib/api/campus';
import { timeAgo } from '@/lib/utils';

type Tab = 'all' | 'lost' | 'found';

function Photo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; lostFoundImageUrl(path).then((u) => { if (alive) setUrl(u); }).catch(() => {}); return () => { alive = false; }; }, [path]);
  if (!url) return <div className="h-40 w-full animate-pulse rounded-xl bg-mint/50" aria-label="Loading photo" />;
  return <img src={url} alt="Item photo" loading="lazy" className="h-40 w-full rounded-xl object-cover" />;
}

export default function LostFoundPage() {
  const me = useAuth((s) => s.userId) as string;
  const state = useAsync(listLostFound, []);
  const [tab, setTab] = useState<Tab>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'lost' as 'lost' | 'found', title: '', description: '', location: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = (state.data ?? []).filter((r) => tab === 'all' || r.kind === tab);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await createLostFound(form, file); toast.success('Post published.'); setOpen(false); setForm({ kind: 'lost', title: '', description: '', location: '' }); setFile(null); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => { try { await deleteLostFound(id); toast.success('Post deleted.'); await state.reload(); } catch (e) { toast.error(friendlyError(e)); } };
  const resolve = async (id: string) => { try { await resolveLostFound(id); toast.success('Marked as resolved.'); await state.reload(); } catch (e) { toast.error(friendlyError(e)); } };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><PackageSearch className="h-7 w-7" aria-hidden="true" /> Lost & found</h1><p className="text-sm text-muted">Help get things back to their owners.</p></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Post item</Button>
      </header>
      <Tabs label="Lost and found" value={tab} onChange={(t) => setTab(t as Tab)} tabs={[{ id: 'all', label: 'All' }, { id: 'lost', label: 'Lost' }, { id: 'found', label: 'Found' }]} />
      <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && rows.length === 0}
        empty={<EmptyState icon={<PackageSearch className="h-6 w-6" />} title="Nothing here yet" text="Post a lost or found item." action={<Button size="sm" onClick={() => setOpen(true)}>Post an item</Button>} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((item) => (
            <Card key={item.id} className="flex flex-col gap-2">
              {item.image_path && <Photo path={item.image_path} />}
              <div className="flex items-start justify-between gap-2">
                <div><span className={item.kind === 'lost' ? 'rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-semibold text-warn-ink' : 'rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-forest'}>{item.kind === 'lost' ? 'LOST' : 'FOUND'}</span><h2 className="mt-1 font-semibold text-forest">{item.title}</h2></div>
                <PostActions targetType="post" targetId={item.id} targetName={item.title} authorId={item.author_id} authorName={item.author?.full_name} onDelete={item.author_id === me ? () => remove(item.id) : undefined} onChanged={() => void state.reload()} />
              </div>
              {item.description && <p className="text-sm text-muted">{item.description}</p>}
              {item.location && <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {item.location}</p>}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <Link to={item.author ? `/u/${item.author.username}` : '/discover'} className="flex items-center gap-1.5"><Avatar path={item.author?.avatar_path} name={item.author?.full_name} size={22} /> {item.author?.full_name ?? 'A student'} · {timeAgo(item.created_at)}</Link>
                {item.author_id === me && item.status === 'open' && <Button variant="ghost" size="sm" onClick={() => void resolve(item.id)}>Mark resolved</Button>}
                {item.status === 'resolved' && <span className="font-semibold text-forest">Resolved</span>}
              </div>
            </Card>
          ))}
        </div>
      </AsyncView>

      <Modal open={open} title="Post a lost or found item" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="lost-form" loading={saving}>Post</Button></>}>
        <form id="lost-form" onSubmit={submit} className="space-y-3">
          <Select label="Type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'lost' | 'found' })}><option value="lost">I lost something</option><option value="found">I found something</option></Select>
          <Input label="Item" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={100} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={600} />
          <Input label="Where?" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} />
          <div><label htmlFor="lost-photo" className="block text-sm font-semibold text-forest">Photo (optional)</label><input id="lost-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-muted" /></div>
        </form>
      </Modal>
    </div>
  );
}
