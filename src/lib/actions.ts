import { useApp } from './store';
import { useUI, tNow } from './ui';
import { earn, breakLenFor, newTask, templateSteps, tinyStep, fiveMinStep, remember, guessSpace } from './engine';
import { addDays, dayKey, uid } from './util';
import type { Energy, Task } from './types';
import { chime, playNoise, stopNoise } from './sound';
import { ask, askJSON, aiReady, langLine } from './ai';

const toastSparks = (got: number, fallbackKey = 'toast.saved') => {
  const ui = useUI.getState();
  ui.toast(got > 0 ? tNow('toast.done', { n: got }) : tNow(fallbackKey));
};

export function completeTask(id: string) {
  let wasOpen = false;
  useApp.getState().mutate((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    wasOpen = t.status === 'todo';
    t.status = wasOpen ? 'done' : 'todo';
    t.doneAt = wasOpen ? Date.now() : undefined;
    if (wasOpen) {
      t.steps.forEach((s) => (s.done = true));
      if (!t.actualMin) {
        // fall back to logged focus time for this task, else the estimate
        const logged = d.sessions.filter((s) => s.taskId === id).reduce((a, s) => a + s.actualMin, 0);
        t.actualMin = Math.round(logged) || 0;
      }
    }
  });
  if (wasOpen) {
    const got = earn(10, 'spark.task');
    useUI.getState().celebrate();
    toastSparks(got, 'toast.saved');
  }
}

export function toggleStep(taskId: string, stepId: string) {
  let nowDone = false;
  let allDone = false;
  useApp.getState().mutate((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    const s = t?.steps.find((x) => x.id === stepId);
    if (!t || !s) return;
    s.done = !s.done;
    nowDone = s.done;
    allDone = t.steps.every((x) => x.done);
  });
  if (nowDone) {
    const got = earn(2, 'spark.step');
    if (allDone) completeTask(taskId);
    else if (got) useUI.getState().toast(tNow('toast.done', { n: got }));
  }
}

export function upsertTask(t: Task) {
  useApp.getState().mutate((d) => {
    const i = d.tasks.findIndex((x) => x.id === t.id);
    if (i >= 0) d.tasks[i] = t;
    else d.tasks.push(t);
  });
}

export function deleteTask(id: string) {
  useApp.getState().mutate((d) => {
    d.tasks = d.tasks.filter((t) => t.id !== id);
  });
  useUI.getState().toast(tNow('toast.deleted'));
}

/** "Not now": moves to tomorrow without guilt; after 2 postpones, opens the Postpone Detective. */
export function postpone(id: string) {
  let count = 0;
  useApp.getState().mutate((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    t.postponed += 1;
    count = t.postponed;
    if (count < 2) t.scheduledFor = addDays(dayKey(), 1);
  });
  if (count >= 2) useUI.getState().open({ kind: 'postpone', taskId: id });
  else useUI.getState().toast(tNow('pp.moved'));
}

export type PostponeReason = 'unclear' | 'big' | 'boring' | 'anxious' | 'tired';
export async function resolvePostpone(id: string, reason: PostponeReason) {
  const d = useApp.getState().data;
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return;
  const lang = d.profile.lang;
  remember(`${t.title}: ${tNow('pp.' + reason)}`, 'postpone');
  if (reason === 'unclear') {
    let steps = templateSteps(t.title, lang);
    if (aiReady()) {
      try {
        steps = await aiSteps(t.title, t.notes);
      } catch {}
    }
    useApp.getState().mutate((x) => {
      const tt = x.tasks.find((y) => y.id === id)!;
      tt.steps = [...steps, ...tt.steps.filter((s) => !s.done).slice(0, 0)];
      tt.postponeReasons.push(reason);
      tt.scheduledFor = dayKey();
    });
  } else if (reason === 'big') {
    useApp.getState().mutate((x) => {
      const tt = x.tasks.find((y) => y.id === id)!;
      tt.steps.unshift(fiveMinStep(tt.title, lang));
      tt.postponeReasons.push(reason);
      tt.scheduledFor = dayKey();
    });
  } else if (reason === 'anxious') {
    useApp.getState().mutate((x) => {
      const tt = x.tasks.find((y) => y.id === id)!;
      tt.steps.unshift(tinyStep(tt.title, lang));
      tt.postponeReasons.push(reason);
      tt.scheduledFor = dayKey();
    });
  } else if (reason === 'boring') {
    useApp.getState().mutate((x) => {
      const tt = x.tasks.find((y) => y.id === id)!;
      tt.postponeReasons.push(reason);
      tt.scheduledFor = dayKey();
      if (!tt.steps.length || tt.steps[0].minutes > 10) tt.steps.unshift(fiveMinStep(tt.title, lang));
    });
  } else {
    useApp.getState().mutate((x) => {
      const tt = x.tasks.find((y) => y.id === id)!;
      tt.postponeReasons.push(reason);
      tt.scheduledFor = addDays(dayKey(), 1);
      tt.difficulty = 1;
    });
  }
}

/* ---------- AI task breakdown ---------- */
export async function aiSteps(title: string, notes = ''): Promise<{ id: string; title: string; minutes: number; done: boolean }[]> {
  const res = await askJSON<{ steps: { title: string; minutes: number }[] }>(
    `Break this task into 4-6 concrete, physical steps for someone with ADHD. The FIRST step must be tiny (1-3 minutes, e.g. "open the file"). Each later step 5-15 minutes. Use the task's language.
Task: ${title}
${notes ? 'Notes: ' + notes : ''}
Reply with only JSON: {"steps":[{"title":"...","minutes":2}]}`,
    { quick: true },
  );
  const steps = Array.isArray(res?.steps) ? res.steps : [];
  if (!steps.length) throw new Error('empty');
  return steps.slice(0, 8).map((s) => ({ id: uid(), title: String(s.title).slice(0, 140), minutes: Math.max(1, Math.min(60, Number(s.minutes) || 10)), done: false }));
}

/* ---------- focus timer ---------- */
export function startFocus(opts: { taskId?: string; title: string; minutes: number; kind?: 'focus' | 'start' }) {
  const d = useApp.getState().data;
  useApp.getState().mutate((x) => {
    x.focus = {
      phase: 'focus',
      taskId: opts.taskId,
      title: opts.title,
      plannedMin: opts.minutes,
      breakMin: breakLenFor(opts.minutes),
      endsAt: Date.now() + opts.minutes * 60000,
      remainingMs: 0,
      startedAt: Date.now(),
      kind: opts.kind ?? 'focus',
    };
  });
  if (d.settings.sound !== 'off') playNoise(d.settings.sound);
  requestWakeLock();
}

let wake: any = null;
async function requestWakeLock() {
  try {
    wake = await (navigator as any).wakeLock?.request('screen');
  } catch {}
}
function releaseWake() {
  try {
    wake?.release();
  } catch {}
  wake = null;
}

/** Log the session that just ran and move to break (or idle). */
export function finishFocus(completed: boolean, energy: Energy) {
  const d = useApp.getState().data;
  const f = d.focus;
  if (f.phase !== 'focus' && f.phase !== 'paused') return;
  const elapsedMs = f.phase === 'paused' ? f.plannedMin * 60000 - f.remainingMs : Date.now() - f.startedAt;
  const actualMin = Math.max(0, Math.min(f.plannedMin + 60, Math.round(elapsedMs / 60000)));
  stopNoise();
  releaseWake();
  useApp.getState().mutate((x) => {
    x.sessions.push({
      id: uid(), taskId: f.taskId, title: f.title, start: f.startedAt, end: Date.now(), plannedMin: f.plannedMin,
      actualMin, kind: f.kind, energy, completed,
    });
    if (x.sessions.length > 2000) x.sessions.splice(0, x.sessions.length - 2000);
    const t = f.taskId ? x.tasks.find((y) => y.id === f.taskId) : undefined;
    if (t) t.actualMin += actualMin;
    x.focus = completed
      ? { ...x.focus, phase: 'break', endsAt: Date.now() + x.focus.breakMin * 60000, startedAt: Date.now() }
      : { ...x.focus, phase: 'idle', endsAt: 0 };
  });
  if (actualMin >= 2) {
    const got = earn(f.kind === 'start' ? 3 : completed ? 8 : 3, f.kind === 'start' ? 'spark.start' : 'spark.focus');
    if (completed) useUI.getState().celebrate();
    if (got) useUI.getState().toast(tNow('toast.done', { n: got }));
  }
  if (completed && d.settings.chime) chime();
}

export function pauseFocus() {
  useApp.getState().mutate((x) => {
    if (x.focus.phase !== 'focus' && x.focus.phase !== 'break') return;
    x.focus.pausedFrom = x.focus.phase;
    x.focus.remainingMs = Math.max(0, x.focus.endsAt - Date.now());
    x.focus.phase = 'paused';
  });
  stopNoise();
}

export function resumeFocus() {
  const d = useApp.getState().data;
  useApp.getState().mutate((x) => {
    if (x.focus.phase !== 'paused') return;
    x.focus.phase = x.focus.pausedFrom || 'focus';
    x.focus.endsAt = Date.now() + x.focus.remainingMs;
  });
  if (d.settings.sound !== 'off' && (d.focus.pausedFrom || 'focus') === 'focus') playNoise(d.settings.sound);
}

export function extendFocus(min: number) {
  useApp.getState().mutate((x) => {
    if (x.focus.phase === 'focus') {
      x.focus.endsAt += min * 60000;
      x.focus.plannedMin += min;
    } else if (x.focus.phase === 'paused') {
      x.focus.remainingMs += min * 60000;
      x.focus.plannedMin += min;
    }
  });
}

export function endBreak(chimeIt = false) {
  const d = useApp.getState().data;
  useApp.getState().mutate((x) => {
    x.focus = { ...x.focus, phase: 'idle', endsAt: 0 };
  });
  if (chimeIt && d.settings.chime) chime();
}

export function cancelFocus() {
  stopNoise();
  releaseWake();
  useApp.getState().mutate((x) => {
    x.focus = { ...x.focus, phase: 'idle', endsAt: 0 };
  });
}

export function saveReentry(taskId: string | undefined, text: string) {
  if (!taskId || !text.trim()) return;
  useApp.getState().mutate((x) => {
    const t = x.tasks.find((y) => y.id === taskId);
    if (t) t.reentry = text.trim().slice(0, 240);
  });
}

/* ---------- brain dump ---------- */
export interface DumpItem { title: string; space: Task['space']; due?: string; minutes: number; keep: boolean }

export async function sortDump(text: string): Promise<DumpItem[]> {
  const d = useApp.getState().data;
  if (aiReady()) {
    try {
      const res = await askJSON<{ items: { title: string; space: string; due?: string | null; minutes?: number }[] }>(
        `Today is ${dayKey()} (${new Date().toLocaleDateString('en', { weekday: 'long' })}). Split this brain dump into separate actionable tasks. Keep each title short and in the user's language. Pick space from: ${d.profile.spaces.join(', ')}. If a date or weekday is mentioned, convert it to YYYY-MM-DD in "due", else null. Estimate minutes realistically.
Brain dump:
"""${text.slice(0, 6000)}"""
Reply with only JSON: {"items":[{"title":"...","space":"study","due":null,"minutes":30}]}`,
        { quick: true },
      );
      const items = Array.isArray(res?.items) ? res.items : [];
      if (items.length)
        return items.slice(0, 25).map((i) => ({
          title: String(i.title).slice(0, 140),
          space: (d.profile.spaces.includes(i.space as any) ? i.space : guessSpace(String(i.title), d.profile.spaces)) as Task['space'],
          due: i.due && /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? i.due : undefined,
          minutes: Math.max(5, Math.min(240, Number(i.minutes) || 30)),
          keep: true,
        }));
    } catch {}
  }
  return text
    .split(/\n|[,،;؛]|\.\s|\band\b|\sثم\s|\bthen\b/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 25)
    .map((s) => ({ title: s.charAt(0).toUpperCase() + s.slice(1), space: guessSpace(s, d.profile.spaces), minutes: 30, keep: true }));
}

export function addDumpItems(items: DumpItem[]) {
  const lang = useApp.getState().data.profile.lang;
  const tasks = items.filter((i) => i.keep).map((i) =>
    newTask({ title: i.title, space: i.space, due: i.due, estimateMin: i.minutes, steps: templateSteps(i.title, lang).slice(0, 3) }),
  );
  useApp.getState().mutate((d) => {
    d.tasks.push(...tasks);
  });
  return tasks.length;
}

/* ---------- misc ---------- */
export async function freshLine(prompt: string, signal?: AbortSignal) {
  return ask(prompt + '\n' + langLine(), { quick: true, signal });
}
