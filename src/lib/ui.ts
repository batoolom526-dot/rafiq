import { create } from 'zustand';
import { useApp, todayCheckin } from './store';
import { translate } from './i18n';
import type { Energy } from './types';
import { uid } from './util';

export type Tab = 'today' | 'plan' | 'focus' | 'study' | 'growth' | 'you';
export type ModalSpec =
  | { kind: 'task'; taskId?: string; preset?: Record<string, unknown> }
  | { kind: 'dump' }
  | { kind: 'exam' }
  | { kind: 'postpone'; taskId: string }
  | { kind: 'just'; taskId?: string; text?: string }
  | { kind: 'reentry'; taskId?: string };

interface UI {
  tab: Tab;
  modal: ModalSpec | null;
  toasts: { id: string; text: string }[];
  thinking: number;
  celebrateUntil: number;
  overwhelm: boolean;
  setTab: (t: Tab) => void;
  open: (m: ModalSpec) => void;
  close: () => void;
  toast: (text: string) => void;
  think: (delta: 1 | -1) => void;
  celebrate: () => void;
  setOverwhelm: (v: boolean) => void;
}

const TABS: Tab[] = ['today', 'plan', 'focus', 'study', 'growth', 'you'];
const initialTab = (): Tab => {
  const h = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Tab;
  return TABS.includes(h) ? h : 'today';
};

export const useUI = create<UI>((set) => ({
  tab: initialTab(),
  modal: null,
  toasts: [],
  thinking: 0,
  celebrateUntil: 0,
  overwhelm: false,
  setTab: (tab) => {
    set({ tab });
    try {
      if (location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab);
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
  toast: (text) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3200);
  },
  think: (d) => set((s) => ({ thinking: Math.max(0, s.thinking + d) })),
  celebrate: () => set({ celebrateUntil: Date.now() + 6000 }),
  setOverwhelm: (overwhelm) => set({ overwhelm }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1) as Tab;
    if (TABS.includes(h) && useUI.getState().tab !== h) useUI.setState({ tab: h });
  });
}

/** Translation hook bound to the user's language. */
export function useT() {
  const lang = useApp((s) => s.data.profile.lang);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
export const tNow = (key: string, vars?: Record<string, string | number>) =>
  translate(useApp.getState().data.profile.lang, key, vars);

export function useEnergy(): Energy {
  return useApp((s) => todayCheckin(s.data)?.energy ?? 'normal');
}

/** Run an AI call with the "thinking" pose shown. */
export async function withThinking<T>(fn: () => Promise<T>): Promise<T> {
  useUI.getState().think(1);
  try {
    return await fn();
  } finally {
    useUI.getState().think(-1);
  }
}
