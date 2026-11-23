import { create } from 'zustand';
import { produce } from 'immer';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { AppData } from './types';
import { dayKey } from './util';

const KEY = 'rafiq-data-v1';
const META = 'rafiq-meta-v1';

export const defaultData = (): AppData => ({
  profile: {
    name: '',
    lang: navigator.language?.startsWith('ar') ? 'ar' : 'en',
    palette: 'muse',
    mode: 'system',
    spaces: ['study', 'work', 'health', 'home', 'growth'],
    sleep: '23:30',
    wake: '07:30',
    anchors: [
      { id: 'a1', label: 'Lunch', time: '13:30', minutes: 45, kind: 'meal' },
      { id: 'a2', label: 'Dinner', time: '19:30', minutes: 45, kind: 'meal' },
    ],
    interests: [],
    toughLove: true,
    onboarded: false,
    createdAt: Date.now(),
  },
  settings: {
    aiProvider: 'auto',
    geminiKey: '',
    geminiModel: 'gemini-2.5-flash',
    voice: 'airy',
    voiceRate: 1,
    sound: 'off',
    chime: true,
  },
  tasks: [],
  sessions: [],
  focus: { phase: 'idle', title: '', plannedMin: 25, breakMin: 5, endsAt: 0, remainingMs: 0, startedAt: 0, kind: 'focus' },
  park: [],
  checkins: [],
  trackers: [],
  notebooks: [],
  rewards: {
    sparks: 0,
    ledger: [],
    bank: [
      { id: 'r1', title: 'Coffee from my favorite café', cost: 60, redeemed: 0 },
      { id: 'r2', title: 'Movie night, guilt-free', cost: 150, redeemed: 0 },
    ],
    owned: [],
  },
  memories: [],
  reflections: [],
  reports: [],
  character: { source: 'none', updatedAt: 0 },
  dialect: { counts: {} },
  lastOpen: Date.now(),
  prevOpen: Date.now(),
});

/** Top-level keys that sync as their own document. Notebooks sync one doc each. */
export const SYNC_KEYS = [
  'profile', 'settings', 'tasks', 'sessions', 'focus', 'park', 'checkins', 'trackers',
  'rewards', 'memories', 'reflections', 'reports', 'character', 'dialect',
] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];

export interface Meta {
  updated: Record<string, number>; // per sync doc key -> last local change
}

interface Store {
  data: AppData;
  meta: Meta;
  ready: boolean;
  mutate: (fn: (d: AppData) => void) => void;
  replaceAll: (d: AppData) => void;
  applyRemote: (patch: Partial<AppData>, updated: Record<string, number>) => void;
}

const changedKeys = (a: AppData, b: AppData) => {
  const out: string[] = [];
  for (const k of SYNC_KEYS) if (a[k] !== b[k]) out.push(k);
  const an = new Map(a.notebooks.map((n) => [n.id, n]));
  const bn = new Map(b.notebooks.map((n) => [n.id, n]));
  for (const [id, n] of bn) if (an.get(id) !== n) out.push('nb_' + id);
  for (const id of an.keys()) if (!bn.has(id)) out.push('nb_' + id);
  if (a.notebooks.length !== b.notebooks.length || an.size !== bn.size || [...an.keys()].some((k) => !bn.has(k))) out.push('nbIndex');
  return out;
};

type Listener = (keys: string[]) => void;
const listeners = new Set<Listener>();
export const onLocalChange = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

let saveTimer: number | undefined;
const scheduleSave = () => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { data, meta } = useApp.getState();
    idbSet(KEY, data).catch(() => {});
    idbSet(META, meta).catch(() => {});
  }, 300);
};

export const useApp = create<Store>((set, get) => ({
  data: defaultData(),
  meta: { updated: {} },
  ready: false,
  mutate: (fn) => {
    const prev = get().data;
    const next = produce(prev, fn);
    if (next === prev) return;
    const keys = changedKeys(prev, next);
    const now = Date.now();
    const updated = { ...get().meta.updated };
    keys.forEach((k) => (updated[k] = now));
    set({ data: next, meta: { updated } });
    scheduleSave();
    if (keys.length) listeners.forEach((l) => l(keys));
  },
  replaceAll: (d) => {
    const now = Date.now();
    const updated: Record<string, number> = {};
    [...SYNC_KEYS, 'nbIndex', ...d.notebooks.map((n) => 'nb_' + n.id)].forEach((k) => (updated[k] = now));
    set({ data: d, meta: { updated } });
    scheduleSave();
    listeners.forEach((l) => l(Object.keys(updated)));
  },
  applyRemote: (patch, upd) => {
    set((s) => ({ data: { ...s.data, ...patch }, meta: { updated: { ...s.meta.updated, ...upd } } }));
    scheduleSave();
  },
}));

/** Merge a stored object over defaults so new fields added in later versions exist. */
export const hydrate = (raw: any): AppData => {
  const d = defaultData();
  if (!raw || typeof raw !== 'object') return d;
  return {
    ...d,
    ...raw,
    profile: { ...d.profile, ...(raw.profile || {}) },
    settings: { ...d.settings, ...(raw.settings || {}) },
    focus: { ...d.focus, ...(raw.focus || {}) },
    rewards: { ...d.rewards, ...(raw.rewards || {}) },
    character: { ...d.character, ...(raw.character || {}) },
    dialect: { counts: { ...(raw.dialect?.counts || {}) } },
  };
};

export async function loadLocal() {
  let raw: any, meta: any;
  try {
    raw = await idbGet(KEY);
    meta = await idbGet(META);
  } catch {
    try {
      raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {}
  }
  const data = hydrate(raw);
  data.prevOpen = data.lastOpen || Date.now();
  data.lastOpen = Date.now();
  useApp.setState({ data, meta: meta?.updated ? meta : { updated: {} }, ready: true });
  scheduleSave();
}

export async function wipeLocal() {
  try {
    await idbDel(KEY);
    await idbDel(META);
    await idbDel('rafiq-sheet-local');
  } catch {}
}

export const todayCheckin = (d: AppData) => d.checkins.find((c) => c.date === dayKey());
