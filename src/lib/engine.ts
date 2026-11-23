/* The "brain": prioritisation, daily plan, time mirror, momentum, Sparks,
 * Rafiq's mood, reflow, exam plans and templates. Pure functions over AppData,
 * plus a few actions that mutate the store. */
import type { AppData, Energy, Pose, SpaceId, Step, Task, Dialect, Card } from './types';
import { addDays, clamp, dayKey, daysUntil, hash, minutesOfDay, nowMinutes, sum, uid } from './util';
import { useApp } from './store';

/* ---------- energy ---------- */
export const sessionLenFor = (e: Energy) =>
  ({ high: 45, normal: 30, low: 15, overwhelmed: 5, scattered: 10 }[e]);
export const breakLenFor = (focusMin: number) => (focusMin >= 45 ? 10 : focusMin >= 25 ? 5 : 3);

/* ---------- time mirror ---------- */
/** Ratio of real time to estimated time across finished tasks (null until enough data). */
export function timeMirror(d: AppData, space?: SpaceId): number | null {
  const done = d.tasks.filter((t) => t.status === 'done' && t.estimateMin > 0 && t.actualMin > 0 && (!space || t.space === space));
  if (done.length < 3) return space ? timeMirror(d) : null;
  const recent = done.slice(-20);
  const r = sum(recent.map((t) => t.actualMin)) / sum(recent.map((t) => t.estimateMin));
  return Math.round(clamp(r, 0.5, 3) * 10) / 10;
}

export const realisticMin = (d: AppData, t: Task) =>
  Math.round(t.estimateMin * (timeMirror(d, t.space) ?? 1.3));

/* ---------- task helpers ---------- */
export const nextStep = (t: Task): Step | undefined => t.steps.find((s) => !s.done);
export const remainingMin = (t: Task) => {
  const open = t.steps.filter((s) => !s.done);
  return open.length ? sum(open.map((s) => s.minutes)) : Math.max(5, t.estimateMin - t.actualMin);
};

/* ---------- priority ---------- */
export function score(t: Task, energy: Energy, today = dayKey()): number {
  let s = 0;
  if (t.due) {
    const n = daysUntil(t.due, today);
    s += n <= 0 ? 60 : n === 1 ? 45 : n <= 3 ? 32 : n <= 7 ? 18 : 6;
  }
  if (t.scheduledFor && t.scheduledFor <= today) s += 20;
  s += t.importance * 8;
  if (t.kind === 'exam' || t.kind === 'assignment') s += 6;
  const lowEnergy = energy === 'low' || energy === 'overwhelmed' || energy === 'scattered';
  if (lowEnergy) s += (3 - t.difficulty) * 7;
  else if (energy === 'high') s += t.difficulty * 4;
  // repeatedly postponed: nudge it forward slightly so it doesn't vanish, but its step gets smaller
  s += Math.min(t.postponed, 3) * 2;
  if (t.scheduledFor && t.scheduledFor > today) s -= 40;
  return s;
}

export function openTasks(d: AppData) {
  return d.tasks.filter((t) => t.status === 'todo');
}

export function ranked(d: AppData, energy: Energy) {
  const today = dayKey();
  return openTasks(d)
    .filter((t) => !t.scheduledFor || t.scheduledFor <= today)
    .sort((a, b) => score(b, energy, today) - score(a, energy, today));
}

export interface Recommendation {
  task: Task;
  step?: Step;
  minutes: number;
  why: { key: string; vars?: Record<string, string | number> }[];
}

export function recommend(d: AppData, energy: Energy): Recommendation | null {
  const list = ranked(d, energy);
  const task = list[0];
  if (!task) return null;
  const step = nextStep(task);
  let minutes = step?.minutes ?? Math.min(remainingMin(task), sessionLenFor(energy));
  if (energy === 'overwhelmed') minutes = Math.min(minutes, 5);
  else if (energy === 'scattered' || energy === 'low') minutes = Math.min(minutes, 10);
  if (task.postponed >= 2) minutes = Math.min(minutes, 5);
  minutes = Math.max(2, minutes);
  const why: Recommendation['why'] = [];
  if (task.due) {
    const n = daysUntil(task.due);
    why.push(n < 0 ? { key: 'why.late' } : n === 0 ? { key: 'why.dueToday' } : n === 1 ? { key: 'why.dueTomorrow' } : { key: 'why.dueIn', vars: { n } });
  }
  if (task.title.startsWith('↻') || task.parentExamId) why.push({ key: 'why.review' });
  if (task.importance === 3 && why.length < 2) why.push({ key: 'why.important' });
  if (task.estimateMin && timeMirror(d)) why.push({ key: 'why.takes', vars: { n: realisticMin(d, task) } });
  if (task.postponed >= 2) why.push({ key: 'why.smaller', vars: { n: task.postponed } });
  else if (['low', 'overwhelmed', 'scattered'].includes(energy) && task.difficulty === 1) why.push({ key: 'why.light' });
  return { task, step, minutes, why: why.slice(0, 3) };
}

/* ---------- daily plan ---------- */
export interface PlanBlock {
  kind: 'focus' | 'break' | 'anchor';
  start: number; // minutes of day
  minutes: number;
  title: string;
  taskId?: string;
}

export function buildPlan(d: AppData, energy: Energy, availableMin: number): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  const len = sessionLenFor(energy);
  const brk = breakLenFor(len);
  let t = Math.ceil(nowMinutes() / 5) * 5;
  const sleep = minutesOfDay(d.profile.sleep) || 23 * 60 + 30;
  const end = sleep < t ? sleep + 1440 : sleep;
  const anchors = d.profile.anchors
    .map((a) => ({ ...a, s: minutesOfDay(a.time) }))
    .filter((a) => a.s + a.minutes > t)
    .sort((a, b) => a.s - b.s);
  let budget = availableMin;
  const queue = ranked(d, energy).flatMap((task) => {
    const open = task.steps.filter((s) => !s.done);
    if (open.length) return open.slice(0, 3).map((s) => ({ title: `${task.title} · ${s.title}`, min: s.minutes, taskId: task.id }));
    return [{ title: task.title, min: remainingMin(task), taskId: task.id }];
  });
  let guard = 0;
  while (budget >= 5 && queue.length && t < end && guard++ < 60) {
    const anchor = anchors.find((a) => a.s <= t + 5 && a.s + a.minutes > t);
    if (anchor) {
      blocks.push({ kind: 'anchor', start: anchor.s, minutes: anchor.minutes, title: anchor.label });
      t = anchor.s + anchor.minutes;
      anchors.splice(anchors.indexOf(anchor), 1);
      continue;
    }
    const nextAnchor = anchors.find((a) => a.s > t);
    const room = nextAnchor ? nextAnchor.s - t : end - t;
    const item = queue[0];
    let m = Math.min(len, item.min, budget, room);
    if (m < 5) {
      if (nextAnchor) {
        t = nextAnchor.s;
        continue;
      }
      break;
    }
    blocks.push({ kind: 'focus', start: t, minutes: m, title: item.title, taskId: item.taskId });
    item.min -= m;
    if (item.min < 5) queue.shift();
    budget -= m;
    t += m;
    if (budget >= 5 && queue.length) {
      blocks.push({ kind: 'break', start: t, minutes: brk, title: '' });
      t += brk;
    }
  }
  return blocks;
}

/* ---------- reflow (no guilt) ---------- */
export function reflow(): number {
  const today = dayKey();
  let moved = 0;
  useApp.getState().mutate((d) => {
    d.tasks.forEach((t) => {
      if (t.status === 'todo' && t.scheduledFor && t.scheduledFor < today) {
        t.scheduledFor = today;
        moved++;
      }
    });
  });
  return moved;
}

/* ---------- momentum (never resets to zero) ---------- */
export function activeDays(d: AppData, days = 7) {
  const set = new Set<string>();
  const since = Date.now() - days * 86400000;
  d.sessions.forEach((s) => s.start >= since && set.add(dayKey(s.start)));
  d.tasks.forEach((t) => t.doneAt && t.doneAt >= since && set.add(dayKey(t.doneAt)));
  d.checkins.forEach((c) => c.ts >= since && set.add(c.date));
  return set.size;
}

export function momentum(d: AppData) {
  // weighted 7-day activity, recent days count more; 0-100
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(dayKey(), -i);
    const w = 1 - i * 0.1;
    const focus = sum(d.sessions.filter((s) => dayKey(s.start) === day).map((s) => s.actualMin));
    const done = d.tasks.filter((t) => t.doneAt && dayKey(t.doneAt) === day).length;
    const showed = d.checkins.some((c) => c.date === day) ? 1 : 0;
    total += w * Math.min(1, focus / 30 * 0.6 + done * 0.25 + showed * 0.2);
  }
  return Math.round((total / 5.5) * 100);
}

export type ConsistencyLevel = 0 | 1 | 2;
export const consistency = (d: AppData): ConsistencyLevel => {
  const a = activeDays(d, 7);
  return a >= 5 ? 2 : a >= 3 ? 1 : 0;
};

/* ---------- Sparks ---------- */
const DAILY_CAP = 60;
export function earn(amount: number, reasonKey: string): number {
  let got = 0;
  useApp.getState().mutate((d) => {
    const today = dayKey();
    const earnedToday = sum(d.rewards.ledger.filter((l) => l.amount > 0 && dayKey(l.ts) === today && !l.reason.startsWith('spark.streak')).map((l) => l.amount));
    got = Math.max(0, Math.min(amount, DAILY_CAP - earnedToday));
    if (got > 0) {
      d.rewards.sparks += got;
      d.rewards.ledger.push({ id: uid(), ts: Date.now(), amount: got, reason: reasonKey });
      if (d.rewards.ledger.length > 500) d.rewards.ledger.splice(0, d.rewards.ledger.length - 500);
    }
    // consistency bonus: 3rd, 5th and 7th active day of the rolling week
    const act = activeDays(d, 7);
    const key = `spark.streak:${act}:${today}`;
    if ([3, 5, 7].includes(act) && !d.rewards.ledger.some((l) => l.reason.startsWith(`spark.streak:${act}`) && Date.now() - l.ts < 6 * 86400000)) {
      d.rewards.sparks += act * 3;
      d.rewards.ledger.push({ id: uid(), ts: Date.now(), amount: act * 3, reason: key });
    }
  });
  return got;
}

export const SHOP = [
  { id: 'sound-rain', cost: 40, kind: 'sound' as const, value: 'rain', title: { en: 'Rain sound', ar: 'صوت المطر' } },
  { id: 'sound-pink', cost: 30, kind: 'sound' as const, value: 'pink', title: { en: 'Soft static sound', ar: 'تشويش هادئ' } },
  { id: 'frame-gold', cost: 80, kind: 'frame' as const, value: 'gold', title: { en: 'Golden frame for Rafiq', ar: 'إطار ذهبي لرفيق' } },
  { id: 'frame-halo', cost: 120, kind: 'frame' as const, value: 'halo', title: { en: 'Glow halo for Rafiq', ar: 'هالة متوهجة لرفيق' } },
];

/* ---------- Rafiq's mood ---------- */
export interface PoseContext {
  focusing: boolean;
  thinking: boolean;
  celebrating: boolean;
  energy?: Energy;
  away: boolean;
}

export function poseFor(d: AppData, ctx: PoseContext): Pose {
  if (ctx.thinking) return 'think';
  if (ctx.celebrating) return 'cheer';
  if (ctx.focusing) return 'focus';
  const now = nowMinutes();
  const sleep = minutesOfDay(d.profile.sleep);
  const wake = minutesOfDay(d.profile.wake);
  const asleep = sleep > wake ? now >= sleep || now < wake : now >= sleep && now < wake;
  if (asleep) return 'sleep';
  const meal = d.profile.anchors.find((a) => a.kind === 'meal' && now >= minutesOfDay(a.time) && now < minutesOfDay(a.time) + a.minutes);
  if (meal) return 'eat';
  if (ctx.away) return 'wave';
  if (ctx.energy === 'overwhelmed' || ctx.energy === 'scattered') return 'calm';
  const doneRecently = d.tasks.some((t) => t.doneAt && Date.now() - t.doneAt < 10 * 60000);
  if (doneRecently) return 'laugh';
  return 'wave';
}

/* ---------- templates (no-AI breakdowns) ---------- */
const T = {
  en: {
    study: ['Open your notes and the slides for {x}', 'Skim the headings and bold words (no reading yet)', 'Read the first section and write 3 key points', 'Close the notes and recall what you remember', 'Check what you missed and add it'],
    write: ['Open a blank document titled “{x}”', 'Write the 3 main points as rough bullets', 'Turn each bullet into one messy paragraph', 'Read it once and fix the obvious things', 'Final check and submit'],
    generic: ['Get what you need for “{x}” in front of you', 'Do the easiest 5-minute part', 'Do the next small part', 'Check it and wrap up'],
    tiny: 'Just open it and look for 2 minutes',
    five: '5-minute version: do any small piece of “{x}”',
  },
  ar: {
    study: ['افتح ملاحظاتك وشرائح {x}', 'تصفّح العناوين والكلمات البارزة (بدون قراءة)', 'اقرأ القسم الأول واكتب ٣ نقاط رئيسية', 'أغلق الملاحظات واسترجع ما تتذكره', 'راجع ما فاتك وأضفه'],
    write: ['افتح مستنداً فارغاً بعنوان «{x}»', 'اكتب النقاط الثلاث الرئيسية بشكل مبدئي', 'حوّل كل نقطة إلى فقرة بسيطة', 'اقرأها مرة وصحّح الواضح', 'مراجعة أخيرة ثم التسليم'],
    generic: ['جهّز ما تحتاجه لـ«{x}» أمامك', 'افعل الجزء الأسهل في ٥ دقائق', 'افعل الجزء الصغير التالي', 'راجعه واختم'],
    tiny: 'افتحها وانظر إليها دقيقتين فقط',
    five: 'نسخة ٥ دقائق: افعل أي جزء صغير من «{x}»',
  },
};

export function templateSteps(title: string, lang: 'en' | 'ar'): Step[] {
  const L = T[lang];
  const low = title.toLowerCase();
  const kind = /(stud|exam|revis|chapter|lecture|read|learn|quiz|test|ذاكر|مذاكرة|امتحان|فصل|محاضرة|اقرأ|مراجعة|اختبار)/.test(low)
    ? 'study'
    : /(write|essay|report|assignment|paper|draft|اكتب|تقرير|مقال|واجب|بحث)/.test(low)
      ? 'write'
      : 'generic';
  const mins = [2, 5, 10, 10, 10];
  return L[kind].map((s, i) => ({ id: uid(), title: s.replace('{x}', title), minutes: mins[i] ?? 10, done: false }));
}

export const tinyStep = (title: string, lang: 'en' | 'ar'): Step => ({ id: uid(), title: T[lang].tiny, minutes: 2, done: false });
export const fiveMinStep = (title: string, lang: 'en' | 'ar'): Step => ({ id: uid(), title: T[lang].five.replace('{x}', title), minutes: 5, done: false });

export function guessSpace(text: string, spaces: SpaceId[]): SpaceId {
  const s = text.toLowerCase();
  const rules: [SpaceId, RegExp][] = [
    ['study', /(exam|study|chapter|lecture|assignment|quiz|uni|class|course|essay|revis|ذاكر|امتحان|محاضرة|واجب|جامعة|مادة|فصل)/],
    ['health', /(gym|run|walk|workout|doctor|sleep|water|yoga|exercise|نادي|رياضة|مشي|طبيب|تمرين)/],
    ['money', /(bank|pay|bill|budget|rent|invoice|salary|بنك|فاتورة|ميزانية|إيجار|راتب|دفع)/],
    ['work', /(meeting|client|email|project|boss|work|cv|internship|job|اجتماع|عميل|مشروع|عمل|وظيفة|تدريب)/],
    ['home', /(clean|laundry|cook|groceries|call|mom|dad|family|تنظيف|غسيل|طبخ|بقالة|اتصل|أهل)/],
    ['growth', /(learn|book|habit|course|read|skill|تعلم|كتاب|عادة|مهارة)/],
  ];
  const fallback: Record<SpaceId, SpaceId[]> = { money: ['home', 'growth'], home: ['growth'], work: ['growth'], health: ['home', 'growth'], study: ['growth'], growth: ['home'] };
  for (const [sp, re] of rules) {
    if (!re.test(s)) continue;
    if (spaces.includes(sp)) return sp;
    const alt = fallback[sp].find((x) => spaces.includes(x));
    if (alt) return alt;
  }
  return spaces.includes('home') ? 'home' : spaces.includes('growth') ? 'growth' : spaces[0] || 'growth';
}

export function newTask(p: Partial<Task> & { title: string }): Task {
  return {
    id: uid(),
    space: 'study',
    kind: 'task',
    notes: '',
    importance: 2,
    difficulty: 2,
    estimateMin: 30,
    actualMin: 0,
    steps: [],
    status: 'todo',
    postponed: 0,
    postponeReasons: [],
    createdAt: Date.now(),
    ...p,
  };
}

/* ---------- exam planner ---------- */
export function examPlan(name: string, examDate: string, topics: string[], dailyMin: number, lang: 'en' | 'ar', label: (k: string, v: Record<string, string>) => string): Task[] {
  const today = dayKey();
  const days = daysUntil(examDate, today);
  if (days < 1 || !topics.length) return [];
  const studyDays = Math.max(1, days - 1); // keep the day before as buffer/mixed review
  const examId = uid();
  const out: Task[] = [];
  const perSession = clamp(Math.round(dailyMin / 2), 20, 50);
  topics.forEach((topic, i) => {
    const day = addDays(today, Math.min(studyDays - 1, Math.floor((i * studyDays) / topics.length)));
    out.push(newTask({
      title: label('exam.learn', { t: topic }),
      space: 'study', kind: 'task', due: examDate, scheduledFor: day, importance: 3, difficulty: 2,
      estimateMin: perSession, steps: templateSteps(topic, lang).slice(0, 4), parentExamId: examId,
      notes: name,
    }));
    const r1 = addDays(day, 1);
    if (daysUntil(r1, today) < days) {
      out.push(newTask({
        title: '↻ ' + label('exam.recall', { t: topic }),
        space: 'study', kind: 'task', due: examDate, scheduledFor: r1, importance: 3, difficulty: 1,
        estimateMin: 10, parentExamId: examId, notes: name,
      }));
    }
    const r3 = addDays(day, 3);
    if (daysUntil(r3, today) < days - 1) {
      out.push(newTask({
        title: '↻ ' + label('exam.recall', { t: topic }),
        space: 'study', kind: 'task', due: examDate, scheduledFor: r3, importance: 2, difficulty: 1,
        estimateMin: 10, parentExamId: examId, notes: name,
      }));
    }
  });
  out.push(newTask({
    title: label('exam.mixed', {}),
    space: 'study', kind: 'task', due: examDate, scheduledFor: addDays(examDate, -1), importance: 3, difficulty: 1,
    estimateMin: Math.min(60, dailyMin), parentExamId: examId, notes: name,
  }));
  out.push(newTask({ title: name, space: 'study', kind: 'exam', due: examDate, scheduledFor: examDate, importance: 3, difficulty: 3, estimateMin: 120, id: examId }));
  return out;
}

/* ---------- spaced repetition (SM-2 variant) ---------- */
export function reviewCard(c: Card, grade: 0 | 1 | 2 | 3): Card {
  // 0 again, 1 hard, 2 good, 3 easy
  let { ease, interval, reps, lapses } = c;
  if (grade === 0) {
    lapses++;
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps++;
    ease = Math.max(1.3, ease + [0, -0.15, 0, 0.15][grade]);
    interval = reps === 1 ? (grade === 3 ? 3 : 1) : reps === 2 ? (grade === 1 ? 3 : 6) : Math.round(interval * ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1));
  }
  return { ...c, ease, interval, reps, lapses, due: addDays(dayKey(), interval) };
}

export const newCard = (front: string, back: string): Card => ({ id: uid(), front, back, due: dayKey(), interval: 0, ease: 2.5, reps: 0, lapses: 0 });

/* ---------- dialect detection (learns how the user writes) ---------- */
const DIALECT_HINTS: [Dialect, RegExp][] = [
  ['eg', /(عايز|عاوز|ازاي|إزاي|كده|مش |بتاع|دلوقتي|خالص|اوي|أوي|ليه)/g],
  ['gulf', /(وش |ابي |أبي |ابغى|أبغى|زين|حيل|وايد|الحين|شلون|يبي)/g],
  ['lev', /(هلق|هلأ|شو |بدي|كتير|منيح|هيك|ليش|كمان|بكرا)/g],
  ['iq', /(شكو|اكو|ماكو|هواية|چ|گ|شلونك|باچر|هسه)/g],
  ['ma', /(بزاف|واش|دابا|ديال|غادي|بغيت|مزيان|كيفاش)/g],
];
export function detectDialect(text: string): Dialect | null {
  if (!/[؀-ۿ]/.test(text)) return /[a-z]/i.test(text) ? 'en' : null;
  let best: Dialect = 'msa';
  let n = 0;
  for (const [d, re] of DIALECT_HINTS) {
    const m = text.match(re)?.length || 0;
    if (m > n) {
      n = m;
      best = d;
    }
  }
  return best;
}
export function learnDialect(text: string) {
  const dl = detectDialect(text);
  if (!dl) return;
  useApp.getState().mutate((d) => {
    d.dialect.counts[dl] = (d.dialect.counts[dl] || 0) + 1;
  });
}
export function preferredDialect(d: AppData): Dialect {
  const entries = Object.entries(d.dialect.counts) as [Dialect, number][];
  const arabic = entries.filter(([k]) => k !== 'en').sort((a, b) => b[1] - a[1]);
  if (d.profile.lang === 'ar') return arabic[0]?.[0] || 'msa';
  return 'en';
}

export const remember = (text: string, source: 'reflection' | 'postpone' | 'goal' | 'dump') =>
  useApp.getState().mutate((d) => {
    d.memories.push({ id: uid(), text: text.slice(0, 200), ts: Date.now(), source });
    if (d.memories.length > 200) d.memories.splice(0, d.memories.length - 200);
  });

export const dailySeed = () => hash(dayKey());
