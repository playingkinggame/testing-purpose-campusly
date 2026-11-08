import type { ReactNode } from 'react';
import { Award, ExternalLink, Flame, GraduationCap, Heart } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Badge';
import { useAsync } from '@/hooks/useAsync';
import { listUserBadges } from '@/lib/api/badges';
import { formatLastSeen, isValidUrl } from '@/lib/utils';
import type { PublicProfile } from '@/types/db';

interface Props {
  profile: PublicProfile;
  isOwn: boolean;
  actions?: ReactNode;
}

export function ProfileHeader({ profile, isOwn, actions }: Props) {
  const badges = useAsync(() => listUserBadges(profile.id), [profile.id]);
  const badgeRows = badges.data ?? [];

  const detailChips = [
    profile.batch ? `Batch ${profile.batch}` : null,
    profile.branch,
    profile.school,
    profile.reg_no ? `Reg ${profile.reg_no}` : null,
    profile.residence === 'hosteller'
      ? `Hosteller${profile.hostel_block ? ` · ${profile.hostel_block}` : ''}`
      : profile.residence === 'day_scholar'
        ? 'Day scholar'
        : null,
  ].filter((chip): chip is string => Boolean(chip));

  const groups = [
    { label: 'Clubs', values: profile.clubs },
    { label: 'Interests', values: profile.interests },
    { label: 'Languages', values: profile.languages },
  ].filter((group) => group.values.length > 0);

  const presenceText = isOwn
    ? 'Active now'
    : profile.last_seen_at
      ? formatLastSeen(profile.last_seen_at)
      : '';

  return (
    <Card className="!p-0">
      <div className="h-24 rounded-t-[16px] bg-brand" aria-hidden="true" />
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
          <Avatar
            path={profile.avatar_path}
            name={profile.full_name}
            size={96}
            className="ring-4 ring-cream"
          />
          {actions && <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div>}
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-forest sm:text-3xl">
              {profile.full_name || 'Campusly student'}
            </h1>
            {isOwn && <Pill tone="mint">You</Pill>}
          </div>
          <p className="text-sm text-muted">@{profile.username || 'student'}</p>
          {presenceText && <p className="mt-1 text-sm text-muted">{presenceText}</p>}
        </div>

        {detailChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Profile details">
            {detailChips.map((chip, index) => (
              <Pill key={`${chip}-${index}`} tone="white">{chip}</Pill>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Profile stats">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/70 px-3 py-1.5 text-sm font-semibold text-forest">
            <Flame className="h-4 w-4" aria-hidden="true" />
            {profile.streak_count} day streak
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/70 px-3 py-1.5 text-sm font-semibold text-forest">
            <Heart className="h-4 w-4" aria-hidden="true" />
            {profile.hearts_total} hearts
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/70 px-3 py-1.5 text-sm font-semibold text-forest">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            {profile.created_at ? `Joined ${new Date(profile.created_at).getFullYear()}` : 'Campusly member'}
          </span>
        </div>

        {profile.bio && (
          <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink/90">
            {profile.bio}
          </p>
        )}

        {profile.social_link && isValidUrl(profile.social_link) && (
          <a
            href={profile.social_link}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-forest underline-offset-4 hover:underline"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{profile.social_link.replace(/^https?:\/\//i, '')}</span>
          </a>
        )}

        {groups.length > 0 && (
          <div className="mt-5 space-y-3">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {group.values.map((value) => (
                    <Pill key={`${group.label}-${value}`} tone="white">{value}</Pill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {badgeRows.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Badges</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {badgeRows.map((earned) => (
                <Pill key={earned.badges.id} tone="mint" className="!bg-mint/80">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  {earned.badges.name}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
