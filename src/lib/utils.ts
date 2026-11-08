import { VIT_EMAIL_DOMAIN } from './constants';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function isVitEmail(email: string): boolean {
  // escape EVERY dot in the domain (a plain .replace('.', ...) only escapes the first one)
  const domain = VIT_EMAIL_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^[a-z0-9._%+-]+' + domain + '$', 'i').test(email.trim());
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/**
 * Friendly first name for greetings.
 * "A Yathin Kumar" -> "Yathin" (single-letter initials like "A" or "A." are skipped).
 */
export function firstName(name?: string | null): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  const pick = words.find((w) => w.length > 1) ?? words[0] ?? '';
  const tidy = pick.length > 1 && pick === pick.toUpperCase() ? pick.toLowerCase() : pick;
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "23BCE1001" -> 2023 (or null if it does not look right) */
export function batchFromRegNo(reg: string): number | null {
  const m = /^(\d{2})[a-z]{3}\d{4}$/i.exec(reg.trim());
  return m ? 2000 + Number(m[1]) : null;
}

export function isValidUrl(v: string): boolean {
  return /^https?:\/\/[^\s]{3,200}$/i.test(v.trim());
}

export function uniqueTags(list: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Safe file name for storage paths */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > -1 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const base = (dot > -1 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';
  return `${Date.now()}-${base}${ext ? '.' + ext : ''}`;
}

export function fileSizeLabel(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Monday (YYYY-MM-DD) of the current week in India time. Matches current_week_start() in SQL. */
export function currentWeekStartIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const date = new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

/** Privacy-safe label for profiles_public.last_seen_at. */
export function formatLastSeen(iso?: string | null): string {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 120) return 'Active now';
  return `Active ${timeAgo(iso)}`;
}
