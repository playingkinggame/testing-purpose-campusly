import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, LogIn, MailCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PasswordField } from '@/components/ui/PasswordField';
import { AppError, friendlyError } from '@/lib/errors';
import {
  MIN_PASSWORD_LENGTH, checkPassword, cleanEmail, passwordProblem,
  resendConfirmation, signInWithPassword, signUpWithPassword,
} from '@/lib/api/auth';
import { isVitEmail } from '@/lib/utils';
import { VIT_EMAIL_DOMAIN } from '@/lib/constants';

function PasswordRules({ password }: { password: string }) {
  const c = checkPassword(password);
  const items: Array<[boolean, string]> = [
    [c.length, `${MIN_PASSWORD_LENGTH}+ characters`],
    [c.letter, 'A letter'],
    [c.number, 'A number'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password rules">
      {items.map(([ok, text]) => (
        <li key={text} className={`inline-flex items-center gap-1 ${ok ? 'font-semibold text-forest' : 'text-muted'}`}>
          {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3 w-3" aria-hidden="true" />}
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Email + password form. Used by Login and Sign up (VIT student emails only). */
export function PasswordForm({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);     // login blocked: email not confirmed yet
  const [sentTo, setSentTo] = useState<string | null>(null);    // signup done: "check your inbox" screen
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const clearErrors = () => { setEmailError(null); setPasswordError(null); setConfirmError(null); setFormError(null); setNotice(null); setNeedsConfirm(false); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    const em = cleanEmail(email);

    let bad = false;
    if (!isVitEmail(em)) { setEmailError(`Use your VIT student email (ends with ${VIT_EMAIL_DOMAIN}).`); bad = true; }
    if (isSignup) {
      const problem = passwordProblem(password);
      if (problem) { setPasswordError(problem); bad = true; }
      else if (password !== confirm) { setConfirmError('The two passwords do not match.'); bad = true; }
    } else if (!password) {
      setPasswordError('Enter your password.'); bad = true;
    }
    if (bad) return;

    setBusy(true);
    try {
      if (isSignup) {
        const result = await signUpWithPassword(em, password);
        if (result === 'confirm_email') { setSentTo(em); setCooldown(30); setBusy(false); }
        // "signed_in": the auth listener in the store takes over and the router moves us on.
      } else {
        await signInWithPassword(em, password);
      }
    } catch (err) {
      if (err instanceof AppError && err.code === 'email_not_confirmed') setNeedsConfirm(true);
      setFormError(friendlyError(err));
      setBusy(false);
    }
  };

  const resend = async (to: string) => {
    setResending(true);
    setFormError(null);
    try {
      await resendConfirmation(to);
      setCooldown(30);
      setNotice('We sent a new confirmation email.');
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setResending(false);
    }
  };

  // ---- Sign up finished, waiting for the email confirmation ----
  if (sentTo) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl bg-mint/60 px-4 py-4 text-sm text-forest">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Check your inbox</p>
            <p>We sent a confirmation link to <strong>{sentTo}</strong>. Click it to activate your account. It may take a minute. Check spam too.</p>
          </div>
        </div>
        {notice && <p role="status" className="text-sm text-forest">{notice}</p>}
        {formError && <p role="alert" className="text-sm text-danger-ink">{formError}</p>}
        <Button variant="secondary" size="lg" className="w-full" loading={resending}
          disabled={cooldown > 0} onClick={() => void resend(sentTo)}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
        </Button>
        <button type="button" onClick={() => { setSentTo(null); setPassword(''); setConfirm(''); setNotice(null); setFormError(null); }}
          className="block w-full text-center text-sm font-semibold text-forest hover:underline">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Input
        label="VIT student email" type="email" required autoComplete="email" inputMode="email"
        value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`yourname${VIT_EMAIL_DOMAIN}`}
        error={emailError} hint={isSignup ? 'Only VIT student emails can join.' : undefined}
      />

      <PasswordField
        label="Password" required value={password} onChange={(e) => setPassword(e.target.value)}
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        placeholder={isSignup ? 'Create a password' : 'Your password'}
        error={passwordError} hint={isSignup ? <PasswordRules password={password} /> : undefined}
      />
      {!isSignup && (
        <div className="-mt-2 flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-forest hover:underline">Forgot password?</Link>
        </div>
      )}

      {isSignup && (
        <PasswordField
          label="Confirm password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password" placeholder="Type it again" error={confirmError}
        />
      )}

      {formError && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger-ink">{formError}</p>}
      {notice && <p role="status" className="rounded-2xl bg-mint/60 px-4 py-3 text-sm text-forest">{notice}</p>}
      {needsConfirm && (
        <Button variant="secondary" size="md" className="w-full" loading={resending} disabled={cooldown > 0}
          onClick={() => void resend(cleanEmail(email))}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend confirmation email'}
        </Button>
      )}

      <Button type="submit" size="lg" loading={busy} className="w-full">
        {isSignup
          ? <><UserPlus className="h-4 w-4" aria-hidden="true" /> Create my account</>
          : <><LogIn className="h-4 w-4" aria-hidden="true" /> Log in</>}
      </Button>
    </form>
  );
}
