import { Home, Compass, MessageCircle, Users, CalendarDays, User, UserPlus, Code2, BookOpen, SearchCheck, Car, EyeOff, GraduationCap, Megaphone, ShieldCheck, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: 'chat' | 'requests' }

/** Bottom tab bar on phones */
export const TAB_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass, badge: 'requests' },
  { to: '/chat', label: 'Chat', icon: MessageCircle, badge: 'chat' },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/profile', label: 'Profile', icon: User },
];

/** Desktop sidebar: main */
export const SIDEBAR_MAIN: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/requests', label: 'Requests', icon: UserPlus, badge: 'requests' },
  { to: '/chat', label: 'Chat', icon: MessageCircle, badge: 'chat' },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/events', label: 'Events', icon: CalendarDays },
];

/** Desktop sidebar + Home quick links: campus */
export const CAMPUS_ITEMS: NavItem[] = [
  { to: '/teammates', label: 'Teammates', icon: Code2 },
  { to: '/study', label: 'Study rooms', icon: BookOpen },
  { to: '/lost-found', label: 'Lost & found', icon: SearchCheck },
  { to: '/rides', label: 'Ride sharing', icon: Car },
  { to: '/confessions', label: 'Confessions', icon: EyeOff },
  { to: '/seniors', label: 'Senior connect', icon: GraduationCap },
  { to: '/notices', label: 'Notices', icon: Megaphone },
];

export const ADMIN_ITEM: NavItem = { to: '/admin', label: 'Admin', icon: ShieldCheck };
export const PROFILE_ITEM: NavItem = { to: '/profile', label: 'Profile', icon: User };
