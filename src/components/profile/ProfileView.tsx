import type { ReactNode } from 'react';
import { ProfileHeader } from './ProfileHeader';
import { AchievementsSection } from './AchievementsSection';
import type { PublicProfile } from '@/types/db';

interface Props {
  profile: PublicProfile;
  isOwn: boolean;
  actions?: ReactNode;
}

export function ProfileView({ profile, isOwn, actions }: Props) {
  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} isOwn={isOwn} actions={actions} />
      <AchievementsSection userId={profile.id} isOwn={isOwn} />
    </div>
  );
}
