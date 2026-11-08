import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { ProfileView } from '@/components/profile/ProfileView';
import { useAuth } from '@/store/authStore';
import type { MyProfile, PublicProfile } from '@/types/db';

function toPublicProfile(profile: MyProfile): PublicProfile {
  return {
    id: profile.id,
    username: profile.username ?? '',
    full_name: profile.full_name ?? '',
    avatar_path: profile.avatar_path,
    batch: profile.batch,
    branch: profile.branch,
    school: profile.school,
    residence: profile.residence,
    hostel_block: profile.hostel_block,
    clubs: profile.clubs,
    languages: profile.languages,
    interests: profile.interests,
    bio: profile.bio,
    social_link: profile.social_link,
    streak_count: profile.streak_count,
    hearts_total: profile.hearts_total,
    reg_no: profile.reg_no,
    last_seen_at: profile.last_seen_at,
    created_at: profile.created_at,
  };
}

export default function MyProfilePage() {
  const profile = useAuth((s) => s.profile);

  if (!profile) {
    return (
      <EmptyState
        title="Profile not ready"
        text="We could not load your profile. Reload the page and try again."
        action={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    );
  }

  return (
    <ProfileView
      profile={toPublicProfile(profile)}
      isOwn
      actions={
        <Link to="/profile/edit">
          <Button size="sm">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit profile
          </Button>
        </Link>
      }
    />
  );
}
