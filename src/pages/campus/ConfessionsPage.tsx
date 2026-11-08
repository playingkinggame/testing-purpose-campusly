import { useState, type FormEvent } from 'react';
import { Ghost, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { PostActions } from '@/components/campus/PostActions';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { createConfession, listConfessions } from '@/lib/api/campus';
import { timeAgo } from '@/lib/utils';

export default function ConfessionsPage() {
  const state = useAsync(listConfessions, []);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await createConfession(body); toast.success('Confession submitted for review.'); setOpen(false); setBody(''); await state.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><Ghost className="h-7 w-7" aria-hidden="true" /> Confessions</h1><p className="text-sm text-muted">Anonymous, kind and moderated. Be nice.</p></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Confess</Button>
      </header>
      <Card className="!bg-mint/40 !p-3 text-xs text-muted">Everything is reviewed before it appears. No names, no harassment, no private details.</Card>
      <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && (state.data ?? []).length === 0}
        empty={<EmptyState icon={<Ghost className="h-6 w-6" />} title="No confessions yet" text="Share something anonymous and wholesome." action={<Button size="sm" onClick={() => setOpen(true)}>Write a confession</Button>} />}>
        <ul className="space-y-3">
          {(state.data ?? []).map((c) => (
            <li key={c.id}><Card className="!bg-surface/70">
              <div className="flex items-start justify-between gap-2"><p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink/90">{c.body}</p><PostActions targetType="confession" targetId={c.id} targetName="Confession" onChanged={() => void state.reload()} /></div>
              <p className="mt-2 text-xs text-muted">Anonymous · {timeAgo(c.created_at)}</p>
            </Card></li>
          ))}
        </ul>
      </AsyncView>
      <Modal open={open} title="Write a confession" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="confession-form" loading={saving}>Submit</Button></>}>
        <form id="confession-form" onSubmit={submit} className="space-y-3">
          <Textarea label="Your confession" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1000} hint={`${body.length}/1000 · posted anonymously`} />
          <p className="text-xs text-muted">Posts go to a moderator first. Do not include names or personal information.</p>
        </form>
      </Modal>
    </div>
  );
}
