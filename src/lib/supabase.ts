import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false when .env is missing; App.tsx then shows a friendly setup screen. */
export const isConfigured = Boolean(url && anonKey && url.startsWith('http'));

// Only the public "anon" key is ever used here. The service-role key must NEVER be in frontend code.
export const supabase = createClient(
  isConfigured ? (url as string) : 'http://localhost:54321',
  isConfigured ? (anonKey as string) : 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Email links (confirm email / reset password) are handled by consumeAuthRedirect() in
      // lib/api/auth.ts. Supabase's own URL detection stays off so it cannot fight the HashRouter (#/login).
      detectSessionInUrl: false,
      flowType: 'implicit', // links carry tokens in the URL hash, which consumeAuthRedirect() reads
    },
    realtime: { params: { eventsPerSecond: 20 } },
  },
);
