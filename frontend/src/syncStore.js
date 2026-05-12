import { create } from 'zustand';

export const useSyncStore = create(set => ({
  status: 'idle',   // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  pending: 0,
  setStatus:  s => set({ status: s }),
  setPending: n => set({ pending: n }),
}));
