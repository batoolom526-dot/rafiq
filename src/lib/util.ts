export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD. */
export const dayKey = (d: Date | number = new Date()) => {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const monthKey = (d: Date | number = new Date()) => dayKey(d).slice(0, 7);

export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number) => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** Whole days from today to the given day (negative = past). */
export const daysUntil = (s: string, from: string = dayKey()) =>
  Math.round((parseDay(s).getTime() - parseDay(from).getTime()) / 86400000);

export const minutesOfDay = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

export const fmtClock = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export const fmtTimer = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const pick = <T,>(xs: T[], seed?: number): T =>
  xs[Math.abs(seed ?? Math.floor(Math.random() * 1e9)) % xs.length];

/** Deterministic small hash, used to vary content per day without flicker. */
export const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const isArabicText = (s: string) => /[؀-ۿ]/.test(s);

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
