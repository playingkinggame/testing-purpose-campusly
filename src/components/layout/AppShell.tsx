import { Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/store/authStore';
import { useShellSync } from '@/hooks/useShellSync';
import { usePresenceSync } from '@/hooks/usePresenceSync';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Sidebar } from './Sidebar';
import { BottomTabs } from './BottomTabs';

export function AppShell() {
  const userId = useAuth((s) => s.userId) as string;
  const hideOnline = useAuth((s) => s.profile?.hide_online ?? false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  useShellSync(userId);
  usePresenceSync(userId, hideOnline);

  return (
    <div className="flex min-h-screen bg-cream">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}
        className="sr-only z-[200] rounded-xl bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <Sidebar />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none md:pb-8">
        <div className="sticky top-0 z-30 flex items-center justify-end gap-1 border-b border-line/50 bg-cream/85 px-4 py-2 backdrop-blur md:hidden">
          <ThemeToggle />
          <NotificationBell />
        </div>
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8"
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomTabs />
    </div>
  );
}
