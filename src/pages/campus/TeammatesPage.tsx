import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Plus, Sparkles, Users } from 'lucide-react';
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
import {
  createTeammatePost, deleteTeammatePost, inviteTeammate, listTeammateInvites, listTeammatePosts,
  matchTeammates, respondTeammateInvite, setTeammatePostStatus, type TeammatePostWithAuthor,
} from '@/lib/api/campus';
import type { TeammateMatch } from '@/types/db';
import { timeAgo } from '@/lib/utils';

type Tab = 'board' | 'invites';
type InviteTab = 'incoming' | 'outgoing';

export default function TeammatesPage() {
  const me = useAuth((s) => s.userId) as string;
  const board = useAsync(listTeammatePosts, []);
  const incoming = useAsync(() => listTeammateInvites('incoming'), []);
  const outgoing = useAsync(() => listTeammateInvites('outgoing'), []);
  const [tab, setTab] = useState<Tab>('board');
  const [inviteTab, setInviteTab] = useState<InviteTab>('incoming');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_name: '', skills: '', team_size: '' });
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState<TeammatePostWithAuthor | null>(null);
  const [matches, setMatches] = useState<TeammateMatch[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const posts = board.data ?? [];
  const invites = inviteTab === 'incoming' ? incoming.data ?? [] : outgoing.data ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTeammatePost({ ...form, skills_needed: form.skills.split(',').map((s) => s.trim()).filter(Boolean), team_size: form.team_size ? Number(form.team_size) : null });
      toast.success('Teammate post published.'); setOpen(false); setForm({ title: '', description: '', event_name: '', skills: '', team_size: '' }); await board.reload();
    } catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  const findMatches = async (post: TeammatePostWithAuthor) => {
    setMatching(post); setMatches(null); setMatchLoading(true);
    try { setMatches(await matchTeammates(post.id)); }
    catch (err) { toast.error(friendlyError(err)); setMatches([]); }
    finally { setMatchLoading(false); }
  };

  const invite = async (postId: string, toUser: string) => {
    setBusy(toUser);
    try { await inviteTeammate(postId, toUser, 'Want to team up for this?'); toast.success('Invite sent.'); await outgoing.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setBusy(null); }
  };

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    setBusy(id);
    try { await respondTeammateInvite(id, status); toast.success(status === 'accepted' ? 'Invite accepted.' : 'Invite declined.'); await Promise.all([incoming.reload(), outgoing.reload()]); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setBusy(null); }
  };

  const closePost = async (post: TeammatePostWithAuthor) => {
    try { await setTeammatePostStatus(post.id, post.status === 'open' ? 'closed' : 'open'); await board.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  };

  const removePost = async (id: string) => {
    try { await deleteTeammatePost(id); toast.success('Post deleted.'); await board.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><Users className="h-7 w-7" aria-hidden="true" /> Find teammates</h1><p className="text-sm text-muted">Hackathons, projects and clubs.</p></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Post</Button>
      </header>
      <Tabs label="Teammates" value={tab} onChange={(t) => setTab(t as Tab)} tabs={[{ id: 'board', label: 'Board' }, { id: 'invites', label: 'Invites', badge: (incoming.data?.length ?? 0) + (outgoing.data?.length ?? 0) }]} />

      {tab === 'board' ? (
        <AsyncView loading={board.loading} error={board.error} onRetry={() => void board.reload()} hasData={!!board.data} isEmpty={!board.loading && !board.error && posts.length === 0}
          empty={<EmptyState icon={<Lightbulb className="h-6 w-6" />} title="No teammate posts" text="Post what you are building and who you need." action={<Button size="sm" onClick={() => setOpen(true)}>Create a post</Button>} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <Card key={post.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h2 className="font-semibold text-forest">{post.title}</h2>{post.event_name && <p className="text-xs text-muted">{post.event_name}</p>}</div>
                  <PostActions targetType="post" targetId={post.id} targetName={post.title} authorId={post.author_id} authorName={post.author?.full_name} onDelete={post.author_id === me ? () => removePost(post.id) : undefined} onChanged={() => void board.reload()} />
                </div>
                {post.description && <p className="line-clamp-3 text-sm text-muted">{post.description}</p>}
                {post.skills_needed?.length > 0 && <div className="flex flex-wrap gap-1">{post.skills_needed.map((s) => <span key={s} className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-forest">{s}</span>)}</div>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Link to={post.author ? `/u/${post.author.username}` : '/discover'} className="flex items-center gap-1.5 text-xs text-muted"><Avatar path={post.author?.avatar_path} name={post.author?.full_name} size={22} /> {post.author?.full_name ?? 'A student'} · {timeAgo(post.created_at)}</Link>
                  <div className="flex gap-1">
                    {post.author_id === me ? <Button variant="ghost" size="sm" onClick={() => void closePost(post)}>{post.status === 'open' ? 'Close' : 'Reopen'}</Button> : post.status === 'open' && <Button size="sm" onClick={() => void findMatches(post)}><Sparkles className="h-4 w-4" aria-hidden="true" /> Match</Button>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </AsyncView>
      ) : (
        <>
          <Tabs label="Invite direction" value={inviteTab} onChange={(t) => setInviteTab(t as InviteTab)} tabs={[{ id: 'incoming', label: 'Received' }, { id: 'outgoing', label: 'Sent' }]} />
          <AsyncView loading={incoming.loading || outgoing.loading} error={incoming.error || outgoing.error} onRetry={() => void Promise.all([incoming.reload(), outgoing.reload()])} hasData={!!(incoming.data && outgoing.data)} isEmpty={invites.length === 0}
            empty={<EmptyState icon={<Users className="h-6 w-6" />} title={inviteTab === 'incoming' ? 'No invites received' : 'No invites sent'} text="Team invites will appear here." />}>
            <ul className="space-y-2">
              {invites.map(({ invite, post, other }) => (
                <li key={invite.id}><Card className="flex flex-wrap items-center gap-3">
                  <Avatar path={other?.avatar_path} name={other?.full_name} size={40} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-forest">{other?.full_name ?? 'A student'} · {post?.title ?? 'Team post'}</p><p className="text-xs text-muted">{invite.message ?? 'No message'} · {timeAgo(invite.created_at)}</p><p className="text-xs font-semibold text-forest">Status: {invite.status}</p></div>
                  {inviteTab === 'incoming' && invite.status === 'pending' && <div className="flex gap-1"><Button size="sm" loading={busy === invite.id} onClick={() => void respond(invite.id, 'accepted')}>Accept</Button><Button variant="ghost" size="sm" loading={busy === invite.id} onClick={() => void respond(invite.id, 'declined')}>Decline</Button></div>}
                </Card></li>
              ))}
            </ul>
          </AsyncView>
        </>
      )}

      <Modal open={open} title="Find teammates" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="teammate-form" loading={saving}>Post</Button></>}>
        <form id="teammate-form" onSubmit={submit} className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={100} />
          <Textarea label="What are you building?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Event / project" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} maxLength={100} /><Input label="Team size" type="number" min={1} max={20} value={form.team_size} onChange={(e) => setForm({ ...form, team_size: e.target.value })} /></div>
          <Input label="Skills needed (comma separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, design, marketing" />
        </form>
      </Modal>

      <Modal open={!!matching} title="Suggested teammates" onClose={() => { setMatching(null); setMatches(null); }}>
        {matchLoading ? <p className="py-6 text-center text-sm text-muted">Finding the best matches…</p> : !matches?.length ? <p className="py-6 text-center text-sm text-muted">No matches yet. Try adding more skills.</p> : (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line p-2">
                <Avatar path={m.avatar_path} name={m.full_name} size={38} />
                <div className="min-w-0 flex-1"><Link to={`/u/${m.username}`} className="block truncate text-sm font-semibold text-forest">{m.full_name}</Link><p className="truncate text-xs text-muted">{m.matched_skills.join(', ') || m.interests.join(', ') || 'No skills listed'}</p></div>
                {matching && <Button size="sm" loading={busy === m.id} onClick={() => void invite(matching.id, m.id)}>Invite</Button>}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
