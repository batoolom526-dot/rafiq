import type { AppData, MonthlyReport, ReportStats, Lang } from './types';
import { activeDays, timeMirror } from './engine';
import { dayKey, monthKey, sum } from './util';

export function monthStats(d: AppData, month = monthKey()): ReportStats {
  const inMonth = (ts: number) => monthKey(ts) === month;
  const sessions = d.sessions.filter((s) => inMonth(s.start));
  const tasks = d.tasks.filter((t) => t.doneAt && inMonth(t.doneAt));
  const bySpace: Record<string, number> = {};
  tasks.forEach((t) => (bySpace[t.space] = (bySpace[t.space] || 0) + 1));
  const hours = new Array(24).fill(0);
  sessions.filter((s) => s.completed).forEach((s) => (hours[new Date(s.start).getHours()] += s.actualMin));
  const bestHourMin = Math.max(...hours);
  const days = new Set<string>();
  sessions.forEach((s) => days.add(dayKey(s.start)));
  tasks.forEach((t) => days.add(dayKey(t.doneAt!)));
  d.checkins.filter((c) => c.date.startsWith(month)).forEach((c) => days.add(c.date));
  const postponed = d.tasks.filter((t) => t.postponed >= 2 && (monthKey(t.createdAt) === month || t.status === 'todo')).sort((a, b) => b.postponed - a.postponed)[0];
  return {
    focusMin: Math.round(sum(sessions.map((s) => s.actualMin))),
    sessions: sessions.filter((s) => s.kind === 'focus').length,
    starts: sessions.filter((s) => s.kind === 'start').length,
    tasksDone: tasks.length,
    activeDays: days.size,
    bySpace,
    bestHour: bestHourMin > 0 ? hours.indexOf(bestHourMin) : null,
    mirror: timeMirror(d),
    mostPostponed: postponed ? postponed.title : null,
    sparks: sum(d.rewards.ledger.filter((l) => l.amount > 0 && inMonth(l.ts)).map((l) => l.amount)),
  };
}

/** Rule-based "where to grow" so the report works without AI. Max 3 areas. */
export function growthAreas(d: AppData, s: ReportStats, lang: Lang): MonthlyReport['areas'] {
  const A: MonthlyReport['areas'] = [];
  const ar = lang === 'ar';
  const daysInMonth = new Date().getDate();
  if (s.activeDays < Math.max(4, daysInMonth * 0.4)) {
    A.push(ar
      ? { title: 'الاستمرارية قبل الكثافة', why: `كنت نشطاً ${s.activeDays} أيام هذا الشهر. الأيام القصيرة المنتظمة تبني أكثر من الأيام الطويلة المتفرقة.`, plan: 'جلسة ١٠ دقائق كل يوم في نفس الوقت' }
      : { title: 'Consistency before intensity', why: `You were active on ${s.activeDays} days this month. Short, regular days build more than rare long ones.`, plan: 'One 10-minute session every day at the same time' });
  }
  if (s.mirror && s.mirror >= 1.4) {
    A.push(ar
      ? { title: 'تقدير الوقت', why: `المهام تأخذ منك ${s.mirror}× من تقديرك. هذا طبيعي جداً، والتخطيط الواقعي يخفف الضغط.`, plan: 'اضرب كل تقدير في ' + s.mirror + ' واترك يوماً احتياطياً قبل كل موعد' }
      : { title: 'Planning with real time', why: `Tasks take you about ${s.mirror}× your first guess. That’s very normal, and planning for it removes pressure.`, plan: `Multiply guesses by ${s.mirror} and keep a buffer day before each deadline` });
  }
  if (s.mostPostponed) {
    A.push(ar
      ? { title: 'المهمة التي تتهرب منها', why: `«${s.mostPostponed}» تأجّلت أكثر من مرة. غالباً لأنها غير واضحة أو كبيرة.`, plan: `خطوة دقيقتين لـ«${s.mostPostponed}» صباح الاثنين` }
      : { title: 'The task you keep avoiding', why: `“${s.mostPostponed}” was postponed several times, usually a sign it’s unclear or too big.`, plan: `A 2-minute first step on “${s.mostPostponed}” Monday morning` });
  }
  const studyDone = s.bySpace.study || 0;
  const reviews = d.notebooks.reduce((n, nb) => n + nb.cards.filter((c) => c.reps > 0).length, 0);
  if (d.profile.spaces.includes('study') && studyDone > 0 && reviews < 10 && A.length < 3) {
    A.push(ar
      ? { title: 'تذكّر ما تذاكره', why: 'المذاكرة موجودة، لكن الاسترجاع قليل. الاختبار الذاتي يثبت المعلومة أكثر من إعادة القراءة.', plan: '١٠ دقائق بطاقات مراجعة ٣ مرات أسبوعياً' }
      : { title: 'Make studying stick', why: 'You’re studying, but doing little recall. Testing yourself locks it in far better than rereading.', plan: '10 minutes of flashcards 3 times a week' });
  }
  if (s.focusMin < 300 && A.length < 3) {
    A.push(ar
      ? { title: 'وقت تركيز محمي', why: `مجموع تركيزك ${s.focusMin} دقيقة هذا الشهر. حماية وقت ثابت يجعل البدء أسهل.`, plan: s.bestHour !== null ? `جلسة يومية حوالي الساعة ${s.bestHour}:00، حين تركيزك أفضل` : 'جلستان قصيرتان يومياً' }
      : { title: 'Protected focus time', why: `You logged ${s.focusMin} focus minutes this month. A fixed slot makes starting easier.`, plan: s.bestHour !== null ? `A daily session around ${s.bestHour}:00, when you focus best` : 'Two short sessions a day' });
  }
  if (!A.length) {
    A.push(ar
      ? { title: 'ارفع السقف قليلاً', why: 'شهر قوي. الخطوة التالية هي تحدٍّ صغير جديد.', plan: 'أضف جلسة أسبوعية لمهارة جديدة تحبها' }
      : { title: 'Raise the bar a little', why: 'A strong month. The next step is a small new challenge.', plan: 'Add one weekly session for a new skill you enjoy' });
  }
  return A.slice(0, 3);
}

export function makeReportFor(d: AppData, month: string): MonthlyReport {
  const stats = monthStats(d, month);
  return { month, createdAt: Date.now(), stats, areas: growthAreas(d, stats, d.profile.lang) };
}

export const makeReport = (d: AppData) => makeReportFor(d, monthKey());

export function reportPrompt(d: AppData, r: MonthlyReport) {
  return `You are Rafiq, a warm, ADHD-informed companion. Write a short monthly letter (120-180 words) to ${d.profile.name || 'the user'} in ${d.profile.lang === 'ar' ? 'Arabic' : 'English'}.
Stats this month: ${JSON.stringify(r.stats)}.
Areas to grow (already chosen): ${r.areas.map((a) => a.title).join('; ')}.
Recent things they wrote: ${d.memories.slice(-5).map((m) => m.text).join(' | ') || 'none'}.
Open with a specific win from the numbers. Explain one pattern you notice. End with encouragement for next month. No shame, no lists, plain text.`;
}

export { activeDays };
