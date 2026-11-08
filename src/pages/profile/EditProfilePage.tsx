import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { PrivacyPanel } from '@/components/profile/PrivacyPanel';
import { AppearancePanel } from '@/components/theme/AppearancePanel';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';

export default function EditProfilePage() {
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const navigate = useNavigate();

  if (!profile) return <Spinner label="Loading your profile" />;

  return (
    <div className="space-y-6">
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to profile
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-forest sm:text-3xl">Edit profile</h1>
        <p className="text-sm text-muted">Update your details, photo and what others can see.</p>
      </div>

      <Card>
        <ProfileForm
          mode="edit"
          initial={profile}
          onSaved={(saved) => {
            setProfile(saved);
            toast.success('Profile updated.');
            navigate('/profile');
          }}
          onCancel={() => navigate('/profile')}
        />
      </Card>

      <AppearancePanel />

      <PrivacyPanel />
    </div>
  );
}
