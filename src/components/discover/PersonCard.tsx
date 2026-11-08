import { Link } from 'react-router-dom';
import { Sparkles, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Badge';
import { RelationActions } from '@/components/social/RelationActions';
import type { DiscoverPerson } from '@/types/db';

export function PersonCard({ person }: { person: DiscoverPerson }) {
  const details = [
    person.batch ? `Batch ${person.batch}` : null,
    person.branch,
    person.school,
    person.residence === 'hosteller'
      ? `Hosteller${person.hostel_block ? ` · ${person.hostel_block}` : ''}`
      : person.residence === 'day_scholar' ? 'Day scholar' : null,
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <Link to={`/u/${person.username}`} className="shrink-0 rounded-full" aria-label={`Open ${person.full_name}'s profile`}>
          <Avatar path={person.avatar_path} name={person.full_name} size={56} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${person.username}`} className="block truncate font-semibold text-forest hover:underline">
            {person.full_name}
          </Link>
          <p className="truncate text-sm text-muted">@{person.username}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="forest">{person.match_percent}% match</Pill>
            {person.mutual_count > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {person.mutual_count} mutual {person.mutual_count === 1 ? 'friend' : 'friends'}
              </span>
            )}
          </div>
        </div>
      </div>

      {details.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {details.map((detail, index) => <Pill key={`${detail}-${index}`} tone="white">{detail}</Pill>)}
        </div>
      )}

      {person.bio && <p className="line-clamp-2 text-sm text-muted">{person.bio}</p>}

      {person.reasons.length > 0 && (
        <ul className="space-y-1" aria-label="Why you match">
          {person.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-muted">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" aria-hidden="true" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-1">
        <RelationActions person={person} initialRelation={person.connection_status} connectionId={person.connection_id} />
      </div>
    </Card>
  );
}
