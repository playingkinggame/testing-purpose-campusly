import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { AppError, friendlyError } from '../errors';
import { isVitEmail } from '../utils';
import { VIT_EMAIL_DOMAIN } from '../constants';

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt (used by Supabase) ignores anything past 72 bytes

export function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns the cleaned email, or throws a friendly error if it is not a VIT student email. */
function requireVitEmail(email: string): string {
  const e = cleanEmail(email);
  if (!isVitEmail(e)) throw new AppError(`Use your VIT student email (ends with ${VIT_EMAIL_DOMAIN}).`);
  return e;
}

// ---------------------------------------------------------------------------
// Password rules (one place, used by the forms and re-checked before every call)
// ---------------------------------------------------------------------------
export interface PasswordChecks { length: boolean; letter: boolean; number: boolean }

export function checkPassword(pw: string): PasswordChecks {
  return { length: pw.length >= MIN_PASSWORD_LENGTH, letter: /[A-Za-z]/.test(pw), number: /\d/.test(pw) };
}

/** null when the password is fine, otherwise one short sentence saying what to fix. */
export function passwordProblem(pw: string): string | null {
  const c = checkPassword(pw);
  if (!c.length) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!c.letter) return 'Add at least one letter.';
  if (!c.number) return 'Add at least one number.';
  if (pw.length > MAX_PASSWORD_LENGTH) return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  return null;
}

/** Where links in our emails (confirm email, reset password) bring the user back to. */
function redirectBase(): string {
  return window.location.origin + window.location.pathname;
}

// ---------------------------------------------------------------------------
// Sign up / log in / log out
// ---------------------------------------------------------------------------
export type SignUpResult = 'signed_in' | 'confirm_email';

/**
 * Creates an account with email + password.
 * - "signed_in": email confirmation is OFF in Supabase, so we already have a session.
 * - "confirm_email": Supabase emailed a confirmation link; the user must click it first.
 * Non-VIT emails are also rejected by a database trigger, so this is not only a UI rule.
 */
export async function signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
  const e = requireVitEmail(email);
  const problem = passwordProblem(password);
  if (problem) throw new AppError(problem);

  const { data, error } = await supabase.auth.signUp({
    email: e,
    password,
    options: { emailRedirectTo: redirectBase() },
  });
  if (error) throw new AppError(friendlyError(error), (error as { code?: string }).code);

  // With email confirmation ON, Supabase hides "already registered" by returning a user with no identities.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AppError('An account with this email already exists. Please log in instead.', 'user_already_exists');
  }
  return data.session ? 'signed_in' : 'confirm_email';
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const e = requireVitEmail(email);
  if (!password) throw new AppError('Enter your password.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
  if (error || !data.session) {
    throw new AppError(
      friendlyError(error ?? { message: 'Invalid login credentials' }),
      (error as { code?: string } | null)?.code,
    );
  }
  return data.session;
}

/** Sends the confirmation email again (for people who did not get it). */
export async function resendConfirmation(email: string): Promise<void> {
  const e = requireVitEmail(email);
  const { error } = await supabase.auth.resend({ type: 'signup', email: e, options: { emailRedirectTo: redirectBase() } });
  if (error) throw new AppError(friendlyError(error));
}

/** Emails a reset link. Always resolves the same way so we never reveal who has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  const e = requireVitEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: redirectBase() });
  if (error) throw new AppError(friendlyError(error));
}

/** Sets a new password for the currently signed-in user (used after clicking the reset link). */
export async function updatePassword(password: string): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new AppError(problem);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new AppError(friendlyError(error));
}

/**
 * Makes sure the signed-in user has a profile row (normally a database trigger creates it at sign-up).
 * Safe to call any time; needs supabase/phase4_password_auth.sql to be run once. Errors are ignored.
 */
export async function ensureMyProfile(): Promise<void> {
  await supabase.rpc('ensure_my_profile');
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** The signed-in user's id, or a friendly error. */
export async function requireUserId(): Promise<string> {
  const s = await getSession();
  if (!s) throw new AppError('Your session expired. Please log in again.');
  return s.user.id;
}

// ---------------------------------------------------------------------------
// Links from Supabase emails (confirm email / reset password)
//
// The app uses a HashRouter, so a link like  /app.html#access_token=...&type=recovery
// would be mistaken for a page. We grab the tokens and clean the URL immediately, at
// import time (before React renders), then sign the user in from them a moment later.
// ---------------------------------------------------------------------------
export type AuthRedirect = { kind: 'confirmed' } | { kind: 'recovery' } | { kind: 'error'; message: string } | null;

type PendingRedirect =
  | { kind: 'session'; accessToken: string; refreshToken: string; recovery: boolean }
  | { kind: 'error'; message: string };

let pending: PendingRedirect | null = null;

function captureAuthHash(): void {
  if (typeof window === 'undefined') return;
  const raw = window.location.hash;
  // Normal routes look like "#/chat/123"; Supabase links look like "#access_token=..." or "#error=...".
  if (!/^#(access_token|refresh_token|error|error_code|error_description)=/.test(raw)) return;

  const p = new URLSearchParams(raw.slice(1));
  const failed = p.get('error') || p.get('error_code') || p.get('error_description');
  const accessToken = p.get('access_token');
  const refreshToken = p.get('refresh_token');
  const recovery = p.get('type') === 'recovery';

  const route = failed ? '#/login' : recovery ? '#/reset-password' : '#/login';
  window.history.replaceState(null, '', window.location.pathname + window.location.search + route);

  if (failed) {
    pending = {
      kind: 'error',
      message: p.get('error_code') === 'otp_expired'
        ? 'That link has expired or was already used. Please request a new one.'
        : 'That link is not valid. Please request a new one.',
    };
  } else if (accessToken && refreshToken) {
    pending = { kind: 'session', accessToken, refreshToken, recovery };
  }
}
captureAuthHash();

/** Call once at start-up. Signs the user in from an email link, if the page was opened from one. */
export async function consumeAuthRedirect(): Promise<AuthRedirect> {
  const p = pending;
  pending = null;
  if (!p) return null;
  if (p.kind === 'error') return p;
  const { error } = await supabase.auth.setSession({ access_token: p.accessToken, refresh_token: p.refreshToken });
  if (error) return { kind: 'error', message: 'That link has expired. Please request a new one.' };
  return { kind: p.recovery ? 'recovery' : 'confirmed' };
}
