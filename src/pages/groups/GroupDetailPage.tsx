import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Megaphone, Pin, Plus, Settings, UserMinus, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { Input, Textarea } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { listAccepted } from '@/lib/api/connections';
import { listPinned, unpinMessage } from '@/lib/api/chat';
import {
  addGroupMember, createAnnouncement, deleteAnnouncement, getGroup, joinGroup, leaveGroup,
  listAnnouncements, removeGroupMember, setGroupRole, updateGroup, uploadGroupAvatar,
} from '@/lib/api/groups';
import { formatDateTime, timeAgo } from '@/lib/utils';
import type { GroupRole, MiniProfile } from '@/types/db';

type Tab = 'chat' | 'members' | 'announcements' | 'pinned';

export default function GroupDetailPage() {
  const { id = '' } = useParams();
  const me = useAuth((s) => s.userId) as string;
  const [tab, setTab] = useState<Tab>('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [leavingOpen, setLeavingOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [busyMember, setBusyMember] = useState<string | null>(null);

  const state = useAsync(async () => {
    const data = await getGroup(id);
    if (!data) return null;
    const [announcements, pinned, connections] = await Promise.all([
      listAnnouncements(id),
      listPinned(id),
      listAccepted(),
    ]);
    return { ...data, announcements, pinned, connections };
  }, [id]);

  const group = state.data?.group;
  const role = state.data?.role ?? null;
  const members = state.data?.members ?? [];
  const announcements = state.data?.announcements ?? [];
  const pinned = state.data?.pinned ?? [];
  const canManage = role === 'owner' || role === 'admin';

  const openSettings = () => {
    if (!group) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setAvatarFile(null);
    setSettingsOpen(true);
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setSaving(true);
    try {
      let avatarPath = group.avatar_path;
      if (avatarFile) avatarPath = await uploadGroupAvatar(avatarFile);
      await updateGroup(group.id, { name: name.trim(), description: description.trim() || null, avatar_path: avatarPath });
      toast.success('Group updated.');
      setSettingsOpen(false);
      await state.reload();
    } catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  const join = async () => {
    if (!group) return;
    setJoining(true);
    try { await joinGroup(group.id); toast.success(`Joined ${group.name}.`); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setJoining(false); }
  };

  const leave = async () => {
    if (!group) return;
    setLeaving(true);
    try { await leaveGroup(group.id); toast.success('You left the group.'); setLeavingOpen(false); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setLeaving(false); }
  };

  const addMember = async (person: MiniProfile) => {
    if (!group) return;
    setBusyMember(person.id);
    try { await addGroupMember(group.id, person.id); toast.success(`${person.full_name} added.`); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusyMember(null); }
  };

  const removeMember = async (person: MiniProfile) => {
    if (!group) return;
    setBusyMember(person.id);
    try { await removeGroupMember(group.id, person.id); toast.success('Member removed.'); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusyMember(null); }
  };

  const changeRole = async (person: MiniProfile, next: GroupRole) => {
    if (!group) return;
    setBusyMember(person.id);
    try { await setGroupRole(group.id, person.id, next === 'admin' ? 'admin' : 'member'); toast.success('Role updated.'); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusyMember(null); }
  };

  const postAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setAnnouncementBusy(true);
    try {
      await createAnnouncement(group.id, announcementTitle, announcementBody);
      setAnnouncementTitle('');
      setAnnouncementBody('');
      toast.success('Announcement posted.');
      await state.reload();
    } catch (err) { toast.error(friendlyError(err)); }
    finally { setAnnouncementBusy(false); }
  };

  const removeAnnouncement = async (announcementId: string) => {
    try { await deleteAnnouncement(announcementId); toast.success('Announcement deleted.'); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
  };

  const removePin = async (pinId: string) => {
    try { await unpinMessage(pinId); toast.success('Message unpinned.'); await state.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && !group}
      empty={<EmptyState icon={<Users className="h-6 w-6" />} title="Group not found" text="It may be private, or it may have been removed." action={<Link to="/groups">Back to groups</Link>} />}>
      {group && (
        <div className="space-y-4">
          <Card className="!p-4">
            <div className="flex flex-wrap items-start gap-3">
              <Link to="/groups" aria-label="Back to groups" className="rounded-2xl p-1.5 text-forest hover:bg-mint/60"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
              <Avatar path={group.avatar_path} name={group.name} size={64} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold text-forest sm:text-2xl">{group.name}</h1>
                <p className="text-xs text-muted">{group.member_count} members · {group.visibility === 'public' ? 'Public' : 'Private'}{role ? ` · You are ${role}` : ''}</p>
                {group.description && <p className="mt-1 text-sm text-muted">{group.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage && <Button variant="secondary" size="sm" onClick={openSettings}><Settings className="h-4 w-4" aria-hidden="true" /> Settings</Button>}
                {role && role !== 'owner' && <Button variant="ghost" size="sm" onClick={() => setLeavingOpen(true)}>Leave</Button>}
                {!role && group.visibility === 'public' && <Button size="sm" loading={joining} onClick={() => void join()}>Join group</Button>}
              </div>
            </div>
          </Card>

          {role ? (
            <>
              <Tabs label="Group sections" value={tab} onChange={(t) => setTab(t as Tab)} tabs={[
                { id: 'chat', label: 'Chat' },
                { id: 'members', label: 'Members', badge: members.length },
                { id: 'announcements', label: 'Announcements', badge: announcements.length },
                { id: 'pinned', label: 'Pinned', badge: pinned.length },
              ]} />

              {tab === 'chat' && (
                <ChatRoom
                  conversationId={group.id}
                  canPin={canManage}
                  onPinChanged={() => void state.reload()}
                  className="flex h-[65vh] min-h-[420px] flex-col overflow-hidden !p-0"
                  emptyText="No messages yet. Say hello to the group."
                  header={<div className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm font-semibold text-forest"><Users className="h-4 w-4" aria-hidden="true" /> Group chat</div>}
                />
              )}

              {tab === 'members' && (
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-forest">Members</h2>
                    {canManage && <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Add member</Button>}
                  </div>
                  <ul className="divide-y divide-line/70">
                    {members.map((m) => m.person && (
                      <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2">
                        <Link to={`/u/${m.person.username}`}><Avatar path={m.person.avatar_path} name={m.person.full_name} size={38} /></Link>
                        <div className="min-w-0 flex-1"><Link to={`/u/${m.person.username}`} className="block truncate text-sm font-semibold text-forest">{m.person.full_name}</Link><p className="truncate text-xs text-muted">@{m.person.username} · {m.role}</p></div>
                        {role === 'owner' && m.user_id !== me && m.role !== 'owner' && (
                          <div className="flex flex-wrap gap-1">
                            <Button variant="ghost" size="sm" loading={busyMember === m.user_id} onClick={() => void changeRole(m.person!, m.role === 'admin' ? 'member' : 'admin')}>{m.role === 'admin' ? 'Demote' : 'Make admin'}</Button>
                            <Button variant="ghost" size="sm" loading={busyMember === m.user_id} onClick={() => void removeMember(m.person!)}><UserMinus className="h-4 w-4" aria-hidden="true" /> Remove</Button>
                          </div>
                        )}
                        {role === 'admin' && m.role === 'member' && (
                          <Button variant="ghost" size="sm" loading={busyMember === m.user_id} onClick={() => void removeMember(m.person!)}><UserMinus className="h-4 w-4" aria-hidden="true" /> Remove</Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {tab === 'announcements' && (
                <Card className="space-y-4">
                  {canManage && (
                    <form onSubmit={postAnnouncement} className="space-y-3 rounded-2xl bg-mint/30 p-3">
                      <h2 className="flex items-center gap-1.5 text-base font-semibold text-forest"><Megaphone className="h-4 w-4" aria-hidden="true" /> New announcement</h2>
                      <Input label="Title" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} maxLength={100} required />
                      <Textarea label="Message" value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} maxLength={1000} required hint={`${announcementBody.length}/1000`} />
                      <Button type="submit" size="sm" loading={announcementBusy}>Post announcement</Button>
                    </form>
                  )}
                  {announcements.length === 0 ? <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements" text="Important updates from group admins will appear here." /> : (
                    <ul className="space-y-2">
                      {announcements.map((a) => (
                        <li key={a.id} className="rounded-2xl border border-line bg-surface/70 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div><h3 className="text-sm font-semibold text-forest">{a.title}</h3><p className="text-xs text-muted">{a.author?.full_name ?? 'Admin'} · {timeAgo(a.created_at)}</p></div>
                            {canManage && <Button variant="ghost" size="sm" onClick={() => void removeAnnouncement(a.id)}>Delete</Button>}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{a.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {tab === 'pinned' && (
                <Card className="space-y-3">
                  <h2 className="flex items-center gap-1.5 text-base font-semibold text-forest"><Pin className="h-4 w-4" aria-hidden="true" /> Pinned messages</h2>
                  {pinned.length === 0 ? <EmptyState icon={<Pin className="h-6 w-6" />} title="Nothing pinned" text="Open the group chat and pin an important message." /> : (
                    <ul className="space-y-2">
                      {pinned.map((p) => (
                        <li key={p.pin.id} className="rounded-2xl border border-line bg-surface/70 p-3">
                          <p className="text-xs text-muted">{p.sender?.full_name ?? 'Someone'} · {formatDateTime(p.pin.pinned_at)}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink/90">{p.message?.deleted_at ? 'This message was unsent' : p.message?.body ?? 'Attachment'}</p>
                          {canManage && <Button variant="ghost" size="sm" className="mt-1" onClick={() => void removePin(p.pin.id)}>Unpin</Button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card><EmptyState icon={<Users className="h-6 w-6" />} title="This group is private" text="Ask an admin to add you, or join a public group from the Groups page." action={<Link to="/groups"><Button size="sm">Browse groups</Button></Link>} /></Card>
          )}

          <Modal open={settingsOpen} title="Group settings" onClose={() => setSettingsOpen(false)} footer={<><Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button type="submit" form="group-settings" loading={saving}>Save</Button></>}>
            <form id="group-settings" onSubmit={saveSettings} className="space-y-3">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} hint={`${description.length}/300`} />
              <div><label htmlFor="group-avatar" className="block text-sm font-semibold text-forest">Group photo</label><input id="group-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-muted" /></div>
            </form>
          </Modal>

          <Modal open={addOpen} title="Add a connection" onClose={() => setAddOpen(false)}>
            <ul className="space-y-1">
              {(state.data?.connections ?? []).filter((c) => c.person && !members.some((m) => m.user_id === c.person!.id)).map((c) => c.person && (
                <li key={c.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-mint/40">
                  <Avatar path={c.person.avatar_path} name={c.person.full_name} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.person.full_name}</span><span className="block truncate text-xs text-muted">@{c.person.username}</span></span>
                  <Button size="sm" loading={busyMember === c.person.id} onClick={() => void addMember(c.person!)}>Add</Button>
                </li>
              ))}
            </ul>
            {(state.data?.connections ?? []).filter((c) => c.person && !members.some((m) => m.user_id === c.person!.id)).length === 0 && <p className="py-4 text-center text-sm text-muted">No more connections to add.</p>}
          </Modal>

          <ConfirmDialog open={leavingOpen} title="Leave this group?" text="You will stop receiving its messages. You can join again if it is public." confirmLabel="Leave" danger loading={leaving} onConfirm={() => void leave()} onClose={() => setLeavingOpen(false)} />
        </div>
      )}
    </AsyncView>
  );
}
