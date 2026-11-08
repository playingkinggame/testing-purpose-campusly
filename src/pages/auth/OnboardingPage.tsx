import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '@/components/layout/Brand';
import { Button } from '@/components/ui/Button';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { toast } from '@/store/uiStore';
import { useAuth } from '@/store/authStore';

export default function OnboardingPage() {
  const profile = useAuth((s) => s.profile);
  const email = useAuth((s) => s.email);
  const setProfile = useAuth((s) => s.setProfile);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useNavigate();
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(60%_40%_at_50%_0%,#DAE7C7_0%,#F5F8EF_70%)] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Brand />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut className="h-4 w-4" aria-hidden="true" /> Log out</Button>
        </div>
        <div className="glass space-y-6 p-6 sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-forest">Set up your profile</h1>
            <p className="text-sm text-muted">Signed in as {email}. Fields marked * are required.</p>
          </div>
          <ProfileForm
            mode="onboarding" initial={profile}
            onSaved={(p) => { setProfile(p); toast.success('Welcome to Campusly!'); navigate('/', { replace: true }); void useAuth.getState().reload(); }}
          />
        </div>
      </div>
    </div>
  );
}
