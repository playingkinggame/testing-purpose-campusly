import { create } from 'zustand';

interface PresenceState {
  online: string[];
  setOnline: (ids: string[]) => void;
  reset: () => void;
}

export const usePresence = create<PresenceState>((set) => ({
  online: [],
  setOnline: (ids) => set({ online: [...new Set(ids)] }),
  reset: () => set({ online: [] }),
}));
