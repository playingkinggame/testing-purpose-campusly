import { NavLink } from 'react-router-dom';
import { useUnread } from '@/store/unreadStore';
import { CountBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { TAB_ITEMS } from './navItems';

export function BottomTabs() {
  const unread = useUnread();
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-6">
        {TAB_ITEMS.map((i) => {
          const Icon = i.icon;
          const badge = i.badge === 'chat' ? unread.chat : i.badge === 'requests' ? unread.requests : 0;
          return (
            <li key={i.to}>
              <NavLink
                to={i.to} end={i.to === '/'}
                className={({ isActive }) => cn(
                  'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-forest' : 'text-muted',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('relative rounded-full px-4 py-1 transition-colors', isActive && 'bg-mint')}>
                      <Icon className={cn('h-5 w-5 transition-transform duration-200', isActive && 'scale-110')} aria-hidden="true" />
                      {badge > 0 && <CountBadge n={badge} className="absolute -right-1 -top-1 !min-w-4 !px-1 !text-[10px] !leading-4" />}
                    </span>
                    {i.label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
