import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { Spinner } from '@/components/ui/Feedback';
import { friendlyError } from '@/lib/errors';
import { passwordProblem, updatePassword } from '@/lib/api/auth';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';

/** Opened from the reset link in the email. The link signs the user in; here they pick a new password. */
export default function ResetPasswordPage() {
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmError(null);
    const problem = passwordProblem(password);
    if (problem) { setError(problem); return; }
    if (password !== confirm) { setConfirmError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success('Password updated. You are logged in.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-cream"><Spinner label="Checking your link" /></div>;
  }

  // No session means the link was missing, expired or already used.
  if (status === 'signed_out') {
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is not valid any more.">
        <Link to="/forgot-password" className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-6 font-semibold text-white hover:bg-brand-600">
          Get a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a password you have not used before.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordField
          label="New password" required value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password" placeholder="At least 8 characters, with a letter and a number" error={error}
        />
        <PasswordField
          label="Confirm new password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password" placeholder="Type it again" error={confirmError}
        />
        <Button type="submit" size="lg" loading={busy} className="w-full">
          <KeyRound className="h-4 w-4" aria-hidden="true" /> Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
