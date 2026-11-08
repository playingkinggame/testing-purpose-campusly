import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { AsyncView } from '@/components/ui/Feedback';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { getWeeklyLeaderboard } from '@/lib/api/discover';
import { cn } from '@/lib/utils';

export function Leaderboard() {
  const me = useAuth((s) => s.userId);
  const board = useAsync(() => getWeeklyLeaderboard(20), []);
  const rows = board.data ?? [];

  return (
    <Card className="!p-4">
      <div className="mb-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-forest">
          <Heart className="h-4 w-4" aria-hidden="true" /> Most loved
        </h2>
        <p className="text-xs text-muted">Hearts this week</p>
      </div>
      <AsyncView
        loading={board.loading}
        error={board.error}
        onRetry={() => void board.reload()}
        hasData={!!board.data}
        isEmpty={rows.length === 0}
        empty={<p className="px-2 py-6 text-center text-sm text-muted">No hearts yet this week. Be the first.</p>}
      >
        <ol className="space-y-1">
          {rows.map((row, index) => (
            <li key={row.id}>
              <Link to={`/u/${row.username}`} className={cn('flex items-center gap-2 rounded-2xl p-2 hover:bg-mint/40', row.id === me && 'bg-mint/30')}>
                <span className={cn('w-4 text-center text-xs font-bold', index < 3 ? 'text-forest' : 'text-muted')}>{index + 1}</span>
                <Avatar path={row.avatar_path} name={row.full_name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{row.full_name}</span>
                  <span className="block truncate text-xs text-muted">{row.branch ?? 'Student'}{row.batch ? ` · ${row.batch}` : ''}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-forest">
                  <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {row.hearts_this_week}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-2 px-2 text-[11px] text-muted">Hearts reset every Monday (IST).</p>
      </AsyncView>
    </Card>
  );
}
