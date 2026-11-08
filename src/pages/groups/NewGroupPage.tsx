import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { AsyncView } from '@/components/ui/Feedback';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { listAccepted } from '@/lib/api/connections';
import { createGroup } from '@/lib/api/groups';

export default function NewGroupPage() {
  const navigate = useNavigate();
  const connections = useAsync(listAccepted, []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error('Give the group a name (2+ characters).'); return; }
    setSaving(true);
    try {
      const id = await createGroup(name, description, visibility, selected);
      toast.success('Group created.');
      navigate(`/groups/${id}`);
    } catch (err) { toast.error(friendlyError(err)); }
    finally { setSaving(false); }
  };

  const people = (connections.data ?? []).filter((c) => c.person);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-forest sm:text-3xl">New group</h1>
        <p className="text-sm text-muted">Only your accepted connections can be added.</p>
      </header>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} hint={`${description.length}/300`} />
          <Select label="Who can find it?" value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}>
            <option value="private">Private — members only</option>
            <option value="public">Public — anyone can join</option>
          </Select>

          <div>
            <p className="mb-2 text-sm font-semibold text-forest">Add connections ({selected.length} selected)</p>
            <AsyncView loading={connections.loading} error={connections.error} onRetry={() => void connections.reload()} hasData={!!connections.data} isEmpty={people.length === 0}
              empty={<p className="rounded-2xl bg-mint/40 p-3 text-sm text-muted">No accepted connections yet. You can create the group and add people later.</p>}>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-line p-1">
                {people.map((c) => c.person && (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-mint/40">
                      <input type="checkbox" checked={selected.includes(c.person.id)} onChange={() => toggle(c.person!.id)} className="h-4 w-4 accent-forest" />
                      <Avatar path={c.person.avatar_path} name={c.person.full_name} size={34} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.person.full_name}</span><span className="block truncate text-xs text-muted">@{c.person.username}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </AsyncView>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate('/groups')}>Cancel</Button>
            <Button type="submit" loading={saving}>Create group</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
