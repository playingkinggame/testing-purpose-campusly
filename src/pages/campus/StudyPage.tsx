import { useState, type FormEvent } from 'react';
import { BookOpen, Download, FileText, Plus, Upload } from 'lucide-react';
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
import { createStudyRoom, deleteStudyNote, deleteStudyRoom, listStudyNotes, listStudyRooms, studyNoteUrl, uploadStudyNote, type StudyRoomWithCreator } from '@/lib/api/campus';
import { formatDateTime, timeAgo } from '@/lib/utils';

export default function StudyPage() {
  const me = useAuth((s) => s.userId) as string;
  const rooms = useAsync(listStudyRooms, []);
  const [openRoom, setOpenRoom] = useState<StudyRoomWithCreator | null>(null);
  const notes = useAsync(() => openRoom ? listStudyNotes(openRoom.id) : Promise.resolve([]), [openRoom?.id]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await createStudyRoom(form.name, form.subject, form.description); toast.success('Study room created.'); setCreateOpen(false); setForm({ name: '', subject: '', description: '' }); await rooms.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!openRoom || !noteFile) { toast.error('Choose a file to upload.'); return; }
    setUploading(true);
    try { await uploadStudyNote(openRoom.id, noteTitle, noteFile); toast.success('Note shared.'); setNoteTitle(''); setNoteFile(null); await notes.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
    finally { setUploading(false); }
  };

  const download = async (path: string, name: string) => {
    try { const url = await studyNoteUrl(path, name); window.open(url, '_blank', 'noopener'); }
    catch (err) { toast.error(friendlyError(err)); }
  };

  const removeRoom = async (id: string) => {
    try { await deleteStudyRoom(id); toast.success('Room deleted.'); await rooms.reload(); }
    catch (err) { toast.error(friendlyError(err)); }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><BookOpen className="h-7 w-7" aria-hidden="true" /> Study rooms</h1><p className="text-sm text-muted">Subject rooms with shared notes.</p></div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New room</Button>
      </header>
      <AsyncView loading={rooms.loading} error={rooms.error} onRetry={() => void rooms.reload()} hasData={!!rooms.data} isEmpty={!rooms.loading && !rooms.error && (rooms.data ?? []).length === 0}
        empty={<EmptyState icon={<BookOpen className="h-6 w-6" />} title="No study rooms" text="Create a room for your subject and share notes." action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create a room</Button>} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(rooms.data ?? []).map((room) => (
            <Card key={room.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-semibold text-forest">{room.name}</h2>{room.subject && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-forest">{room.subject}</span>}</div>
                <PostActions targetType="post" targetId={room.id} targetName={room.name} authorId={room.creator_id} authorName={room.creator?.full_name} onDelete={room.creator_id === me ? () => removeRoom(room.id) : undefined} onChanged={() => void rooms.reload()} />
              </div>
              {room.description && <p className="line-clamp-2 text-sm text-muted">{room.description}</p>}
              <p className="flex items-center gap-1.5 text-xs text-muted"><Avatar path={room.creator?.avatar_path} name={room.creator?.full_name} size={20} /> {room.creator?.full_name ?? 'A student'} · {timeAgo(room.created_at)}</p>
              <Button variant="secondary" size="sm" className="mt-auto" onClick={() => setOpenRoom(room)}>Open notes</Button>
            </Card>
          ))}
        </div>
      </AsyncView>

      <Modal open={!!openRoom} title={openRoom?.name ?? 'Study room'} onClose={() => setOpenRoom(null)}>
        {openRoom && (
          <div className="space-y-4">
            {openRoom.description && <p className="text-sm text-muted">{openRoom.description}</p>}
            <form onSubmit={upload} className="space-y-2 rounded-2xl bg-mint/30 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-forest"><Upload className="h-4 w-4" aria-hidden="true" /> Share a note</p>
              <Input label="Note title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} required maxLength={100} />
              <input aria-label="Note file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,image/*" onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted" />
              <Button type="submit" size="sm" loading={uploading}>Upload</Button>
            </form>
            <AsyncView loading={notes.loading} error={notes.error} onRetry={() => void notes.reload()} hasData={!!notes.data} isEmpty={(notes.data ?? []).length === 0} empty={<p className="py-3 text-center text-sm text-muted">No notes shared yet.</p>}>
              <ul className="space-y-2">
                {(notes.data ?? []).map((note) => (
                  <li key={note.id} className="flex items-center gap-2 rounded-2xl border border-line p-2">
                    <FileText className="h-5 w-5 shrink-0 text-forest" aria-hidden="true" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-forest">{note.title}</p><p className="truncate text-xs text-muted">{note.uploader?.full_name ?? 'Someone'} · {formatDateTime(note.created_at)}</p></div>
                    <Button variant="ghost" size="sm" onClick={() => void download(note.file_path, note.file_name ?? note.title)} aria-label={`Download ${note.title}`}><Download className="h-4 w-4" aria-hidden="true" /></Button>
                    {note.uploader_id === me && <Button variant="ghost" size="sm" onClick={async () => { try { await deleteStudyNote(note.id); await notes.reload(); } catch (e) { toast.error(friendlyError(e)); } }}>Delete</Button>}
                  </li>
                ))}
              </ul>
            </AsyncView>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} title="New study room" onClose={() => setCreateOpen(false)} footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" form="study-room-form" loading={saving}>Create</Button></>}>
        <form id="study-room-form" onSubmit={create} className="space-y-3">
          <Input label="Room name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={60} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={400} />
        </form>
      </Modal>
    </div>
  );
}
