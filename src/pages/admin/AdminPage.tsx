import { useState } from 'react';
import { Flag, Ghost, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { listPendingConfessions, listReports, resolveReport, reviewConfession } from '@/lib/api/admin';
import { timeAgo } from '@/lib/utils';
import type { AdminReport } from '@/types/db';

type Tab = 'reports' | 'confessions';
type Status = 'open' | 'reviewing' | 'actioned' | 'dismissed' | 'all';

export default function AdminPage() {
  const reports = useAsync(() => listReports('open'), []);
  const pending = useAsync(listPendingConfessions, []);
  const [tab, setTab] = useState<Tab>('reports');
  const [statusFilter, setStatusFilter] = useState<Status>('open');
  const [filtered, setFiltered] = useState<AdminReport[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const changeFilter = async (status: Status) => {
    setStatusFilter(status);
    try { setFiltered(await listReports(status)); }
    catch (e) { toast.error(friendlyError(e)); }
  };

  const act = async (report: AdminReport, action: 'actioned' | 'dismissed' | 'reviewing') => {
    setBusy(report.id);
    try { await resolveReport(report.id, action); toast.success('Report updated.'); await reports.reload(); setFiltered(await listReports(statusFilter)); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    try { await reviewConfession(id, approve); toast.success(approve ? 'Confession approved.' : 'Confession rejected.'); await pending.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const reportRows = filtered ?? reports.data ?? [];

  return (
    <div className="space-y-5">
      <header><h1 className="flex items-center gap-2 text-2xl font-bold text-forest sm:text-3xl"><ShieldCheck className="h-7 w-7" aria-hidden="true" /> Admin</h1><p className="text-sm text-muted">Moderation queue for reports and confessions.</p></header>
      <Tabs label="Admin sections" value={tab} onChange={(t) => setTab(t as Tab)} tabs={[{ id: 'reports', label: 'Reports', badge: (reports.data ?? []).length }, { id: 'confessions', label: 'Confessions', badge: (pending.data ?? []).length }]} />

      {tab === 'reports' ? (
        <AsyncView loading={reports.loading} error={reports.error} onRetry={() => void reports.reload()} hasData={!!reports.data} isEmpty={reportRows.length === 0}
          empty={<EmptyState icon={<Flag className="h-6 w-6" />} title="Queue is clear" text="No reports in this status." />}>
          <div className="mb-3 flex flex-wrap gap-1">
            {(['open', 'reviewing', 'actioned', 'dismissed', 'all'] as Status[]).map((s) => <Button key={s} size="sm" variant={statusFilter === s ? 'primary' : 'ghost'} onClick={() => void changeFilter(s)}>{s}</Button>)}
          </div>
          <ul className="space-y-2">
            {reportRows.map((r) => (
              <li key={r.id}><Card className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-forest">{r.target_type} report · {r.reason}</p><p className="text-xs text-muted">{timeAgo(r.created_at)} · status {r.status}</p></div><div className="flex flex-wrap gap-1"><Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => void act(r, 'reviewing')}>Reviewing</Button><Button size="sm" loading={busy === r.id} onClick={() => void act(r, 'actioned')}>Action</Button><Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => void act(r, 'dismissed')}>Dismiss</Button></div></div>
                {r.details && <p className="text-sm text-muted">{r.details}</p>}
                {r.target_preview && <p className="rounded-xl bg-mint/30 p-2 text-xs text-forest">“{r.target_preview}”</p>}
              </Card></li>
            ))}
          </ul>
        </AsyncView>
      ) : (
        <AsyncView loading={pending.loading} error={pending.error} onRetry={() => void pending.reload()} hasData={!!pending.data} isEmpty={(pending.data ?? []).length === 0}
          empty={<EmptyState icon={<Ghost className="h-6 w-6" />} title="No pending confessions" text="New anonymous posts will wait here for review." />}>
          <ul className="space-y-2">
            {(pending.data ?? []).map((c) => (
              <li key={c.id}><Card className="space-y-2"><p className="whitespace-pre-wrap text-sm text-ink/90">{c.body}</p><p className="text-xs text-muted">{timeAgo(c.created_at)}</p><div className="flex gap-1"><Button size="sm" loading={busy === c.id} onClick={() => void review(c.id, true)}>Approve</Button><Button size="sm" variant="ghost" loading={busy === c.id} onClick={() => void review(c.id, false)}>Reject</Button></div></Card></li>
            ))}
          </ul>
        </AsyncView>
      )}
    </div>
  );
}
