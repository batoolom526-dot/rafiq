/* The personal Rafiq character: one 4×2 sheet image → 8 mood images.
 * Order in the sheet (matches the prompt): laugh, focus, eat, sleep / cheer, calm, think, wave. */
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Pose } from './types';
import { cap } from './platform';

export const POSE_ORDER: Pose[] = ['laugh', 'focus', 'eat', 'sleep', 'cheer', 'calm', 'think', 'wave'];
export const SAMPLE_SHEET = './sample-sheet.webp';
const LOCAL_KEY = 'rafiq-sheet-local';

export const CHARACTER_PROMPT = `Using my photo as the only reference, create a character sheet of ONE character who clearly looks like me: same face, skin tone, hair (or hijab), eyes and glasses if I wear them. Style: semi-realistic 3D animated film character, soft cinematic lighting. Arrange 8 panels in a 4×2 grid (4 across, 2 rows) on a plain warm-cream background, waist-up, same framing, outfit and lighting in every panel, with a thin gap between panels: 1 laughing, 2 focused reading a book, 3 eating a snack, 4 sleeping peacefully, 5 celebrating with arms raised, 6 calm with eyes closed, 7 thinking with hand on chin, 8 waving hello. No text, no borders, no watermark.`;

let cache: { key: string; poses: Record<Pose, string> } | null = null;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Find the panel grid by looking for light gutter lines; falls back to an even split. */
function cuts(data: Uint8ClampedArray, w: number, h: number, axis: 'x' | 'y', parts: number): number[] {
  const len = axis === 'x' ? w : h;
  const other = axis === 'x' ? h : w;
  const score = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    const step = Math.max(1, Math.floor(other / 120));
    let n = 0;
    for (let j = 0; j < other; j += step) {
      const x = axis === 'x' ? i : j;
      const y = axis === 'x' ? j : i;
      const k = (y * w + x) * 4;
      const v = (data[k] + data[k + 1] + data[k + 2]) / 3;
      s += v;
      n++;
    }
    score[i] = s / n;
  }
  const out: number[] = [0];
  for (let p = 1; p < parts; p++) {
    const guess = Math.round((len * p) / parts);
    const win = Math.round(len / parts / 6);
    let best = guess;
    let bestV = -1;
    for (let i = guess - win; i <= guess + win; i++) {
      if (i > 0 && i < len && score[i] > bestV) {
        bestV = score[i];
        best = i;
      }
    }
    out.push(best);
  }
  out.push(len);
  return out;
}

export async function cropSheet(src: string): Promise<Record<Pose, string>> {
  if (cache?.key === src) return cache.poses;
  const img = await loadImg(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h).data;
  const xs = cuts(data, w, h, 'x', 4);
  const ys = cuts(data, w, h, 'y', 2);
  const poses = {} as Record<Pose, string>;
  const out = document.createElement('canvas');
  const og = out.getContext('2d')!;
  POSE_ORDER.forEach((pose, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const pad = Math.round(w * 0.012);
    const x0 = xs[col] + pad, x1 = xs[col + 1] - pad;
    const y0 = ys[row] + pad, y1 = ys[row + 1] - pad;
    const cw = Math.max(10, x1 - x0), ch = Math.max(10, y1 - y0);
    const scale = Math.min(1, 420 / ch);
    out.width = Math.round(cw * scale);
    out.height = Math.round(ch * scale);
    og.clearRect(0, 0, out.width, out.height);
    og.drawImage(c, x0, y0, cw, ch, 0, 0, out.width, out.height);
    poses[pose] = out.toDataURL('image/webp', 0.86);
  });
  cache = { key: src, poses };
  return poses;
}

/** Store an uploaded sheet. Returns a URL usable as an <img> source. */
export async function storeSheet(file: Blob): Promise<{ url: string; synced: boolean }> {
  const assets = await cap<any>('assets');
  if (assets) {
    try {
      const r = await assets.upload(file);
      return { url: r.url, synced: true };
    } catch {}
  }
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  await idbSet(LOCAL_KEY, dataUrl);
  return { url: 'local', synced: false };
}

export async function resolveSheetUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url === 'local') return (await idbGet(LOCAL_KEY)) || null;
  return url;
}

export async function clearLocalSheet() {
  try {
    await idbDel(LOCAL_KEY);
  } catch {}
  cache = null;
}
