import { useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { deleteAchievement, listAchievements } from '@/lib/api/achievements';
import { AchievementCard } from './AchievementCard';
import { AchievementForm } from './AchievementForm';
import type { Achievement } from '@/types/db';

interface Props {
  userId: string;
  isOwn: boolean;
}

export function AchievementsSection({ userId, isOwn }: Props) {
  const achievements = useAsync(() => listAchievements(userId), [userId]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState<Achievement | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const rows = achievements.data ?? [];

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (achievement: Achievement) => {
    setEditing(achievement);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAchievement(deleting.id);
      toast.success('Achievement removed.');
      setDeleting(null);
      await achievements.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section aria-labelledby="achievements-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="achievements-heading" className="text-lg font-semibold text-forest">Achievements</h2>
          <p className="text-sm text-muted">
            {isOwn ? 'Your certificates, hackathons and campus wins.' : 'Certificates, hackathons and campus wins.'}
          </p>
        </div>
        {isOwn && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add
          </Button>
        )}
      </div>

      <AsyncView
        loading={achievements.loading}
        error={achievements.error}
        onRetry={() => void achievements.reload()}
        hasData={!!achievements.data}
        isEmpty={rows.length === 0}
        empty={
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title={isOwn ? 'Show your wins' : 'No achievements yet'}
            text={
              isOwn
                ? 'Add a certificate, hackathon, fest or club role. A photo or PDF makes it look better.'
                : 'When they add achievements, they will appear here.'
            }
            action={isOwn ? <Button size="sm" onClick={openNew}>Add achievement</Button> : undefined}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              isOwn={isOwn}
              onEdit={() => openEdit(achievement)}
              onDelete={() => setDeleting(achievement)}
            />
          ))}
        </div>
      </AsyncView>

      {isOwn && (
        <AchievementForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          initial={editing}
          userId={userId}
          onSaved={() => {
            setFormOpen(false);
            void achievements.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete achievement?"
        text="This removes it from your profile. The uploaded file is deleted too."
        confirmLabel="Delete"
        danger
        loading={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
