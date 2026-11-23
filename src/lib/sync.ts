/* Cross-device sync through the artifact `db` capability.
 * Each top-level area is one private document under data/users/<id>/<key>
 * holding {json, updatedAt}. Last write wins per area. Works offline-first:
 * IndexedDB is always the primary copy. */
import { cap } from './platform';
import { useApp, onLocalChange, SYNC_KEYS, hydrate } from './store';
import type { AppData, Notebook } from './types';

const MAX = 240 * 1024;
let base: any = null;
let pending = new Set<string>();
let timer: number | undefined;
export const syncState = { active: false, lastError: '' };
const subs = new Set<() => void>();
export const onSyncState = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
const emit = () => subs.forEach((f) => f());

function valueFor(key: string, d: AppData): unknown {
  if (key === 'nbIndex') return d.notebooks.map((n) => n.id);
  if (key.startsWith('nb_')) return d.notebooks.find((n) => 'nb_' + n.id === key) ?? null;
  return (d as any)[key];
}

async function push() {
  if (!base) return;
  const keys = [...pending];
  pending = new Set();
  const { data, meta } = useApp.getState();
  for (const key of keys) {
    const ref = base.doc(key);
    const v = valueFor(key, data);
    try {
      if (v === null) {
        await ref.delete();
        continue;
      }
      const json = JSON.stringify(v);
      if (json.length > MAX) continue; // too large to sync; stays on this device
      await ref.set({ json, updatedAt: meta.updated[key] || Date.now() });
    } catch (e: any) {
      syncState.lastError = e?.code || 'error';
      emit();
    }
  }
}

export async function pull() {
  if (!base) return;
  try {
    const snap = await base.get();
    const remote = new Map<string, { json: string; updatedAt: number }>();
    snap.docs.forEach((doc: any) => {
      const v = doc.data();
      if (v && typeof v.json === 'string') remote.set(doc.id, { json: v.json, updatedAt: Number(v.updatedAt) || 0 });
    });
    const { data, meta } = useApp.getState();
    const patch: any = {};
    const upd: Record<string, number> = {};
    const toPush: string[] = [];

    for (const key of SYNC_KEYS) {
      const r = remote.get(key);
      const local = meta.updated[key] || 0;
      if (r && r.updatedAt > local) {
        try {
          patch[key] = JSON.parse(r.json);
          upd[key] = r.updatedAt;
        } catch {}
      } else if (!r || local > r.updatedAt) {
        if (local > 0 || !r) toPush.push(key);
      }
    }

    // notebooks
    const rIdx = remote.get('nbIndex');
    const lIdxTime = meta.updated['nbIndex'] || 0;
    let ids = data.notebooks.map((n) => n.id);
    if (rIdx && rIdx.updatedAt > lIdxTime) {
      try {
        ids = JSON.parse(rIdx.json);
        upd['nbIndex'] = rIdx.updatedAt;
      } catch {}
    } else toPush.push('nbIndex');
    const byId = new Map(data.notebooks.map((n) => [n.id, n]));
    const nbs: Notebook[] = [];
    let nbChanged = upd['nbIndex'] !== undefined;
    for (const id of ids) {
      const key = 'nb_' + id;
      const r = remote.get(key);
      const lt = meta.updated[key] || 0;
      if (r && r.updatedAt > lt) {
        try {
          nbs.push(JSON.parse(r.json));
          upd[key] = r.updatedAt;
          nbChanged = true;
          continue;
        } catch {}
      }
      const local = byId.get(id);
      if (local) {
        nbs.push(local);
        if (!r || lt > r.updatedAt) toPush.push(key);
      }
    }
    if (nbChanged) patch.notebooks = nbs;

    if (Object.keys(patch).length) {
      const merged = hydrate({ ...data, ...patch });
      const clean: any = {};
      for (const k of Object.keys(patch)) clean[k] = (merged as any)[k];
      useApp.getState().applyRemote(clean, upd);
    }
    toPush.forEach((k) => pending.add(k));
    if (pending.size) await push();
    syncState.lastError = '';
  } catch (e: any) {
    syncState.lastError = e?.code || 'error';
  }
  emit();
}

export async function startSync() {
  const db = await cap<any>('db');
  const user = await cap<any>('user');
  if (!db || !user) return;
  let id: string | null = null;
  try {
    id = await user.id();
  } catch {}
  if (!id) return;
  base = db.collection(`data/users/${id}`);
  syncState.active = true;
  emit();
  await pull();
  onLocalChange((keys) => {
    keys.forEach((k) => pending.add(k));
    window.clearTimeout(timer);
    timer = window.setTimeout(push, 1500);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pull();
    else push();
  });
}

export async function wipeRemote() {
  if (!base) return;
  try {
    const snap = await base.get();
    for (const doc of snap.docs) await base.doc(doc.id).delete();
  } catch {}
}
