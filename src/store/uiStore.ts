import { create } from 'zustand';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string }
interface UiState {
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  push: (kind, text) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (t: string) => useUi.getState().push('success', t),
  error: (t: string) => useUi.getState().push('error', t),
  info: (t: string) => useUi.getState().push('info', t),
};
