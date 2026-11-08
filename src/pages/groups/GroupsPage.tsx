import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { joinGroup, listMyGroups, listPublicGroups, type GroupWithRole } from '@/lib/api/groups';
import type { Group } from '@/types/db';

type Tab = 'mine' | 'browse';

export default function GroupsPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [joining, setJoining] = useState<string | null>(null);
  const state = useAsync(async () => {
    const [mine, publicGroups] = await Promise.all([listMyGroups(), listPublicGroups()]);
    const mineIds = new Set(mine.map((g) => g.id));
    return { mine, browse: publicGroups.filter((g) => !mineIds.has(g.id)) };
  }, []);

  const join = async (group: Group) => {
    setJoining(group.id);
    try {
      await joinGroup(group.id);
      toast.success(`Joined ${group.name}.`);
      await state.reload();
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setJoining(null); }
  };

  const mine = state.data?.mine ?? [];
  const browse = state.data?.browse ?? [];
  const rows: Array<GroupWithRole | Group> = tab === 'mine' ? mine : browse;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><Users className="h-7 w-7" aria-hidden="true" /> Groups</h1>
          <p className="text-sm text-muted">Club rooms, class groups and project teams.</p>
        </div>
        <Link to="/groups/new"><Button size="sm"><Plus className="h-4 w-4" aria-hidden="true" /> New group</Button></Link>
      </header>

      <Tabs label="Groups" value={tab} onChange={(id) => setTab(id as Tab)} tabs={[
        { id: 'mine', label: 'My groups', badge: mine.length },
        { id: 'browse', label: 'Browse public', badge: browse.length },
      ]} />

      <AsyncView loading={state.loading} error={state.error} onRetry={() => void state.reload()} hasData={!!state.data} isEmpty={!state.loading && !state.error && rows.length === 0}
        empty={<EmptyState icon={<Users className="h-6 w-6" />} title={tab === 'mine' ? 'No groups yet' : 'No public groups yet'} text={tab === 'mine' ? 'Create one with your connections, or join a public group.' : 'Public groups will appear here.'} action={tab === 'mine' ? <Link to="/groups/new"><Button size="sm">Create a group</Button></Link> : undefined} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((group) => (
            <Card key={group.id} className="flex h-full flex-col gap-3">
              <div className="flex items-start gap-3">
                <Link to={`/groups/${group.id}`}><Avatar path={group.avatar_path} name={group.name} size={52} /></Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/groups/${group.id}`} className="block truncate font-semibold text-forest hover:underline">{group.name}</Link>
                  <p className="text-xs text-muted">{group.member_count} {group.member_count === 1 ? 'member' : 'members'} · {group.visibility === 'public' ? 'Public' : 'Private'}</p>
                  {group.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{group.description}</p>}
                </div>
              </div>
              <div className="mt-auto flex items-center gap-2">
                <Link to={`/groups/${group.id}`} className="flex-1"><Button variant="secondary" size="sm" className="w-full">Open group</Button></Link>
                {tab === 'browse' && <Button size="sm" loading={joining === group.id} onClick={() => void join(group)}>Join</Button>}
              </div>
            </Card>
          ))}
        </div>
      </AsyncView>
    </div>
  );
}
