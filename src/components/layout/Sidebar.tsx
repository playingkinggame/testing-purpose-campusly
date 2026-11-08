import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/store/authStore';
import { useUnread } from '@/store/unreadStore';
import { Avatar } from '@/components/ui/Avatar';
import { CountBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { ADMIN_ITEM, CAMPUS_ITEMS, PROFILE_ITEM, SIDEBAR_MAIN, type NavItem } from './navItems';
import { Brand } from './Brand';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function Item({ item, badge }: { item: NavItem; badge: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to} end={item.to === '/'}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors',
        isActive ? 'bg-brand text-white' : 'text-forest/80 hover:bg-mint/70',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      <CountBadge n={badge} />
    </NavLink>
  );
}

export function Sidebar() {
  const profile = useAuth((s) => s.profile);
  const isAdmin = useAuth((s) => s.isAdmin);
  const signOut = useAuth((s) => s.signOut);
  const unread = useUnread();
  const badgeOf = (i: NavItem) => (i.badge === 'chat' ? unread.chat : i.badge === 'requests' ? unread.requests : 0);

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col gap-4 border-r border-line bg-surface/50 p-4 md:flex">
      <div className="px-2 pt-1"><Brand /></div>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {SIDEBAR_MAIN.map((i) => <Item key={i.to} item={i} badge={badgeOf(i)} />)}
      </nav>
      <nav aria-label="Campus" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Campus</p>
        {CAMPUS_ITEMS.map((i) => <Item key={i.to} item={i} badge={0} />)}
        {isAdmin && <Item item={ADMIN_ITEM} badge={0} />}
      </nav>
      <div className="space-y-1 border-t border-line pt-3">
        <NavLink to={PROFILE_ITEM.to} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-mint/70">
          <Avatar path={profile?.avatar_path} name={profile?.full_name} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{profile?.full_name}</span>
            <span className="block truncate text-xs text-muted">@{profile?.username}</span>
          </span>
        </NavLink>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void signOut()}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-mint/70">
            <LogOut className="h-5 w-5" aria-hidden="true" /> Log out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
