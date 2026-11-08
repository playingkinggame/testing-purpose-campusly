import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import { ErrorState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-cream p-6">{children}</div>;
}

/** Only for signed-in, finished-onboarding users. */
export function ProtectedRoute() {
  const status = useAuth((s) => s.status);
  const error = useAuth((s) => s.error);
  const reload = useAuth((s) => s.reload);
  const signOut = useAuth((s) => s.signOut);
  const location = useLocation();

  if (status === 'loading') return <FullPage><Spinner label="Loading Campusly" /></FullPage>;
  if (status === 'error') {
    return (
      <FullPage>
        <div className="glass max-w-md p-6">
          <ErrorState message={error ?? 'Could not load your account.'} onRetry={() => void reload()} />
          <div className="text-center"><Button variant="ghost" size="sm" onClick={() => void signOut()}>Log out</Button></div>
        </div>
      </FullPage>
    );
  }
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (status === 'needs_onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Login / signup: bounce away if already signed in. */
export function PublicOnlyRoute() {
  const status = useAuth((s) => s.status);
  const error = useAuth((s) => s.error);
  const reload = useAuth((s) => s.reload);
  const signOut = useAuth((s) => s.signOut);
  if (status === 'loading') return <FullPage><Spinner /></FullPage>;
  // Signed in OK, but loading the account failed: say so instead of leaving the login form spinning.
  if (status === 'error') {
    return (
      <FullPage>
        <div className="glass max-w-md p-6">
          <ErrorState message={error ?? 'You are signed in, but we could not load your account.'} onRetry={() => void reload()} />
          <div className="text-center"><Button variant="ghost" size="sm" onClick={() => void signOut()}>Log out</Button></div>
        </div>
      </FullPage>
    );
  }
  if (status === 'ready') return <Navigate to="/" replace />;
  if (status === 'needs_onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Onboarding: needs a session, but not a finished profile. */
export function OnboardingRoute() {
  const status = useAuth((s) => s.status);
  if (status === 'loading') return <FullPage><Spinner /></FullPage>;
  if (status === 'signed_out' || status === 'error') return <Navigate to="/login" replace />;
  if (status === 'ready') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Admin pages: hidden unless is_admin() said yes. */
export function AdminRoute() {
  const isAdmin = useAuth((s) => s.isAdmin);
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}
