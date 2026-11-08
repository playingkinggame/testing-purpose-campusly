import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, MessageCircleQuestion, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { answerSeniorQuestion, askSenior, listIncomingSeniorQuestions, listMySeniorQuestions, listSeniors } from '@/lib/api/campus';
import { timeAgo } from '@/lib/utils';
import type { PublicProfile } from '@/types/db';

type Tab = 'seniors' | 'mine' | 'incoming';

export default function SeniorsPage() {
  const profile = useAuth((s) => s.profile);
  const seniors = useAsync(() => listSeniors(profile?.batch ?? 9999), [profile?.batch]);
  const mine = useAsync(listMySeniorQuestions, []);
  const incoming = useAsync(listIncomingSeniorQuestions, []);
  const [tab, setTab] = useState<Tab>('seniors');
  const [target, setTarget] = useState<PublicProfile | null>(null);
  const [question, setQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try { await askSenior(target.id, question); toast.success('Question sent.'); setTarget(null); setQuestion(''); await mine.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  const answer = async (id: string) => {
    try { await answerSeniorQuestion(id, answers[id] ?? ''); toast.success('Answer sent.'); setAnswers({ ...answers, [id]: '' }); await incoming.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  };

  return (
    <div className="space-y-5">
      <header><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><GraduationCap className="h-7 w-7" aria-hidden="true" /> Senior connect</h1><p className="text-sm text-muted">Ask seniors about courses, clubs and campus life.</p></header>
      <Tabs label="Senior connect" value={tab} onChange={(t) => setTab(t as Tab)} tabs={[{ id: 'seniors', label: 'Seniors' }, { id: 'mine', label: 'My questions', badge: mine.data?.length ?? 0 }, { id: 'incoming', label: 'Asked me', badge: incoming.data?.length ?? 0 }]} />

      {tab === 'seniors' && (
        <AsyncView loading={seniors.loading} error={seniors.error} onRetry={() => void seniors.reload()} hasData={!!seniors.data} isEmpty={(seniors.data ?? []).length === 0}
          empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No seniors found" text="Seniors from earlier batches will appear here once they join." />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(seniors.data ?? []).map((s) => (
              <Card key={s.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-3"><Avatar path={s.avatar_path} name={s.full_name} size={46} /><div className="min-w-0"><Link to={`/u/${s.username}`} className="block truncate font-semibold text-forest">{s.full_name}</Link><p className="truncate text-xs text-muted">{s.branch ?? 'Branch not set'} · Batch {s.batch ?? '—'}</p></div></div>
                {s.bio && <p className="line-clamp-2 text-sm text-muted">{s.bio}</p>}
                <Button size="sm" variant="secondary" className="mt-auto" onClick={() => { setTarget(s); setQuestion(''); }}><MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> Ask a question</Button>
              </Card>
            ))}
          </div>
        </AsyncView>
      )}

      {tab !== 'seniors' && (
        <AsyncView loading={tab === 'mine' ? mine.loading : incoming.loading} error={tab === 'mine' ? mine.error : incoming.error} onRetry={() => void (tab === 'mine' ? mine.reload() : incoming.reload())} hasData={!!(tab === 'mine' ? mine.data : incoming.data)} isEmpty={(tab === 'mine' ? mine.data ?? [] : incoming.data ?? []).length === 0}
          empty={<EmptyState icon={<MessageCircleQuestion className="h-6 w-6" />} title={tab === 'mine' ? 'No questions yet' : 'No questions asked to you'} text={tab === 'mine' ? 'Pick a senior and ask anything.' : 'Questions from juniors will appear here.'} />}>
          <ul className="space-y-3">
            {(tab === 'mine' ? mine.data ?? [] : incoming.data ?? []).map((q) => (
              <li key={q.id}><Card className="space-y-2">
                <div className="flex items-center gap-2"><Avatar path={q.other?.avatar_path} name={q.other?.full_name} size={30} /><p className="text-sm font-semibold text-forest">{q.other?.full_name ?? 'A student'} · {timeAgo(q.created_at)}</p></div>
                <p className="text-sm text-ink/90">{q.question}</p>
                {q.answer ? <p className="rounded-xl bg-mint/50 p-2 text-sm text-forest"><strong>Answer:</strong> {q.answer}</p> : tab === 'incoming' ? (
                  <div className="space-y-2"><Textarea label="Your answer" value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} maxLength={1000} /><Button size="sm" loading={saving} onClick={() => void answer(q.id)}><Send className="h-4 w-4" aria-hidden="true" /> Send answer</Button></div>
                ) : <p className="text-xs text-muted">Waiting for an answer.</p>}
              </Card></li>
            ))}
          </ul>
        </AsyncView>
      )}

      <Modal open={!!target} title={`Ask ${target?.full_name ?? 'a senior'}`} onClose={() => setTarget(null)} footer={<><Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button><Button type="submit" form="senior-form" loading={saving}>Send</Button></>}>
        <form id="senior-form" onSubmit={ask}><Textarea label="Your question" value={question} onChange={(e) => setQuestion(e.target.value)} required maxLength={1000} hint="Be specific and polite." /></form>
      </Modal>
    </div>
  );
}
