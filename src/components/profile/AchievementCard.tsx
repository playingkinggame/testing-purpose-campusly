import { useEffect, useState } from 'react';
import {
  Award,
  ExternalLink,
  FileText,
  PartyPopper,
  Pencil,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Badge';
import { achievementFileUrl, isPdfPath } from '@/lib/api/achievements';
import type { Achievement, AchievementKind } from '@/types/db';

const KIND_META: Record<AchievementKind, { label: string; icon: LucideIcon }> = {
  certificate: { label: 'Certificate', icon: Award },
  hackathon: { label: 'Hackathon', icon: Trophy },
  fest: { label: 'Fest', icon: PartyPopper },
  club_role: { label: 'Club role', icon: Users },
  other: { label: 'Other', icon: Sparkles },
};

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  achievement: Achievement;
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AchievementCard({ achievement, isOwn, onEdit, onDelete }: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState(false);
  const meta = KIND_META[achievement.kind];
  const Icon = meta.icon;
  const isPdf = isPdfPath(achievement.file_path);

  useEffect(() => {
    let alive = true;
    setFileUrl(null);
    setFileError(false);
    if (!achievement.file_path) return;
    achievementFileUrl(achievement.file_path)
      .then((url) => { if (alive) setFileUrl(url); })
      .catch(() => { if (alive) setFileError(true); });
    return () => { alive = false; };
  }, [achievement.file_path]);

  return (
    <Card className="flex h-full flex-col gap-3 !p-4">
      <div className="flex items-start justify-between gap-2">
        <Pill tone="mint">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
        </Pill>
        {isOwn && onEdit && onDelete && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${achievement.title}`}
              className="rounded-full p-1.5 text-muted hover:bg-mint hover:text-forest"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${achievement.title}`}
              className="rounded-full p-1.5 text-muted hover:bg-danger-soft hover:text-danger-ink"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-forest">{achievement.title}</h3>
        {achievement.issuer && <p className="text-sm text-muted">{achievement.issuer}</p>}
        {achievement.achieved_on && <p className="text-xs text-muted">{dateLabel(achievement.achieved_on)}</p>}
      </div>

      {achievement.description && (
        <p className="text-sm leading-relaxed text-ink/80">{achievement.description}</p>
      )}

      <div className="mt-auto">
        {!achievement.file_path && <p className="text-xs text-muted">No file attached.</p>}
        {achievement.file_path && fileError && <p className="text-xs text-muted">File unavailable.</p>}
        {achievement.file_path && !fileUrl && !fileError && (
          <div className="h-24 animate-pulse rounded-xl bg-mint/50" aria-hidden="true" />
        )}
        {achievement.file_path && fileUrl && (
          isPdf ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"
            >
              <FileText className="h-4 w-4" aria-hidden="true" /> Open PDF
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="block overflow-hidden rounded-xl border border-line"
            >
              <img
                src={fileUrl}
                alt={`${achievement.title} certificate`}
                loading="lazy"
                className="h-36 w-full object-cover"
              />
            </a>
          )
        )}
      </div>
    </Card>
  );
}
