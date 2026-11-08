import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'campusly-theme';
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#08482D', dark: '#0D1411' };

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch { /* storage blocked: fall back to system */ }
  return 'system';
}

function systemIsDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemIsDark() ? 'dark' : 'light';
  return preference;
}

/** Paints the theme on the page (data-theme on <html> + browser bar colour). */
function paint(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

type ThemeState = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Flip between light and dark (used by the small sun/moon button). */
  toggle: () => void;
};

const initial = readPreference();

export const useTheme = create<ThemeState>((set, get) => ({
  preference: initial,
  resolved: resolve(initial),
  setPreference: (preference) => {
    try { localStorage.setItem(KEY, preference); } catch { /* ignore */ }
    const resolved = resolve(preference);
    paint(resolved);
    set({ preference, resolved });
  },
  toggle: () => get().setPreference(get().resolved === 'dark' ? 'light' : 'dark'),
}));

/** Call once at start-up. Applies the saved theme and follows the device setting / other tabs. */
export function initTheme() {
  paint(useTheme.getState().resolved);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', () => {
    if (useTheme.getState().preference !== 'system') return;
    const resolved = resolve('system');
    paint(resolved);
    useTheme.setState({ resolved });
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    const preference = readPreference();
    const resolved = resolve(preference);
    paint(resolved);
    useTheme.setState({ preference, resolved });
  });
}
