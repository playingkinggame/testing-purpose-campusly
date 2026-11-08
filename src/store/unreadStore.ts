import { create } from 'zustand';

interface UnreadState {
  chat: number;
  requests: number;
  notifications: number;
  set: (p: Partial<Pick<UnreadState, 'chat' | 'requests' | 'notifications'>>) => void;
  reset: () => void;
}

export const useUnread = create<UnreadState>((set) => ({
  chat: 0,
  requests: 0,
  notifications: 0,
  set: (p) => set(p),
  reset: () => set({ chat: 0, requests: 0, notifications: 0 }),
}));
