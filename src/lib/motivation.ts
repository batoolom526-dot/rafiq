import type { AppData, Dialect, Energy, Tone } from './types';
import { consistency, preferredDialect } from './engine';
import { dayKey, hash } from './util';

interface Line {
  d: Dialect;
  tone: Tone;
  type: 'line' | 'story' | 'fact' | 'joke';
  t: string;
}

const L: Line[] = [
  // ---------- English ----------
  { d: 'en', tone: 'gentle', type: 'line', t: 'Rough day? One small step still counts.' },
  { d: 'en', tone: 'gentle', type: 'line', t: 'You don’t need motivation to start. You need two minutes.' },
  { d: 'en', tone: 'gentle', type: 'line', t: 'Nothing is lost. We start again from here, together.' },
  { d: 'en', tone: 'gentle', type: 'story', t: 'A calligrapher was asked how he finished such huge works. “I only ever start with one dot,” he said. Start with your dot.' },
  { d: 'en', tone: 'gentle', type: 'fact', t: 'Students who forgave themselves for procrastinating procrastinated less on the next exam. Be kind to yourself; it actually works.' },
  { d: 'en', tone: 'fun', type: 'joke', t: '5 minutes. That’s shorter than your last “quick” scroll.' },
  { d: 'en', tone: 'fun', type: 'joke', t: 'Your procrastination just filed a formal complaint. Keep going.' },
  { d: 'en', tone: 'fun', type: 'fact', t: 'The Wright brothers’ first flight lasted 12 seconds. Your first session can be short too.' },
  { d: 'en', tone: 'fun', type: 'story', t: 'Legend says a student once opened their notes “just to look” and accidentally finished the chapter. Could be you.' },
  { d: 'en', tone: 'serious', type: 'line', t: 'Discipline is choosing what you want most over what you want now.' },
  { d: 'en', tone: 'serious', type: 'fact', t: 'Testing yourself beats rereading. Ten minutes of recall is worth an hour of highlighting.' },
  { d: 'en', tone: 'serious', type: 'line', t: 'Small steps, repeated, become the big result. Today’s step is enough.' },
  { d: 'en', tone: 'tough', type: 'line', t: 'Your deadline isn’t scared of you. Yet.' },
  { d: 'en', tone: 'tough', type: 'line', t: 'You’re on a roll. Bet you can’t keep it going one more day. Prove me wrong.' },
  { d: 'en', tone: 'tough', type: 'joke', t: 'The chapter isn’t going to read itself. I checked.' },
  // ---------- MSA ----------
  { d: 'msa', tone: 'gentle', type: 'line', t: 'لا بأس إن كان اليوم ثقيلاً، خطوة صغيرة تكفي.' },
  { d: 'msa', tone: 'gentle', type: 'story', t: 'يُحكى أن خطاطاً كان يبدأ كل لوحة بنقطة واحدة فقط… ثم تأتي الحروف وحدها. ابدأ بنقطتك.' },
  { d: 'msa', tone: 'gentle', type: 'fact', t: 'الطلاب الذين سامحوا أنفسهم على التسويف، سوّفوا أقل في الامتحان التالي. اللطف مع النفس ينجح فعلاً.' },
  { d: 'msa', tone: 'fun', type: 'joke', t: 'خمس دقائق فقط… حتى القهوة تحتاج وقتاً أطول لتبرد ☕' },
  { d: 'msa', tone: 'fun', type: 'fact', t: 'أول رحلة طيران للأخوين رايت استمرت ١٢ ثانية فقط. جلستك الأولى يمكن أن تكون قصيرة أيضاً.' },
  { d: 'msa', tone: 'serious', type: 'line', t: 'النجاح مجموع خطوات صغيرة تتكرر كل يوم.' },
  { d: 'msa', tone: 'serious', type: 'fact', t: 'اختبار نفسك أنفع من إعادة القراءة. عشر دقائق استرجاع تساوي ساعة تظليل.' },
  { d: 'msa', tone: 'tough', type: 'line', t: 'الموعد النهائي لا يعرف الأعذار. ابدأ الآن.' },
  // ---------- Egyptian ----------
  { d: 'eg', tone: 'gentle', type: 'line', t: 'خد نفس، مفيش حاجة ضاعت. نبدأ من هنا.' },
  { d: 'eg', tone: 'gentle', type: 'line', t: 'النهارده نبدأ بحاجة صغيرة خالص، وأنا معاك.' },
  { d: 'eg', tone: 'fun', type: 'joke', t: 'يلا يا بطل، خمس دقايق بس ومش هتحس بيهم!' },
  { d: 'eg', tone: 'fun', type: 'joke', t: 'التسويف بيشتكي منك النهارده… كمّل!' },
  { d: 'eg', tone: 'serious', type: 'line', t: 'كل يوم بتذاكر فيه ولو شوية بيفرق في الآخر.' },
  { d: 'eg', tone: 'tough', type: 'line', t: 'الكتاب مش هيذاكر نفسه يا باشا، قوم.' },
  // ---------- Gulf ----------
  { d: 'gulf', tone: 'gentle', type: 'line', t: 'عادي لو اليوم صعب، المهم ما توقف.' },
  { d: 'gulf', tone: 'fun', type: 'joke', t: 'يلا عاد! خمس دقايق وبعدها سوّ اللي تبي 😄' },
  { d: 'gulf', tone: 'fun', type: 'line', t: 'كم يوم ورا بعض؟ والله إنك ذيب 🐺' },
  { d: 'gulf', tone: 'serious', type: 'line', t: 'اللي يبي يوصل، يبدأ اليوم مو بكرة.' },
  { d: 'gulf', tone: 'tough', type: 'line', t: 'وش فيك؟ الامتحان ما راح ينتظرك، قوم ذاكر.' },
  // ---------- Levantine ----------
  { d: 'lev', tone: 'gentle', type: 'line', t: 'ولا يهمك، رجعتك هي الإنجاز الحقيقي.' },
  { d: 'lev', tone: 'fun', type: 'joke', t: 'يلا قوم، خمس دقايق وبتحس حالك بطل 💪' },
  { d: 'lev', tone: 'serious', type: 'line', t: 'شوي شوي بتوصل، بس المهم تبلّش.' },
  { d: 'lev', tone: 'tough', type: 'line', t: 'خلص بقى، ما في شي اسمه بكرا. هلق وقتها.' },
  { d: 'lev', tone: 'tough', type: 'line', t: 'شو هالالتزام؟ طيب خلينا نشوف إذا بتكمّلها لبكرا 😏' },
  // ---------- Iraqi ----------
  { d: 'iq', tone: 'gentle', type: 'line', t: 'مو مشكلة اليوم، باچر نكمل سوا.' },
  { d: 'iq', tone: 'fun', type: 'joke', t: 'يلا عيني، خمس دقايق بس، ما راح تخسر شي!' },
  { d: 'iq', tone: 'serious', type: 'line', t: 'خطوة خطوة توصل، بس لا توگف.' },
  { d: 'iq', tone: 'tough', type: 'line', t: 'شبيك؟ الوقت يركض وانت گاعد! گوم.' },
  // ---------- Moroccan ----------
  { d: 'ma', tone: 'gentle', type: 'line', t: 'ماشي مشكل، المهم ترجع وتبدا من جديد.' },
  { d: 'ma', tone: 'fun', type: 'joke', t: 'يالاه، غير خمس دقايق وصافي!' },
  { d: 'ma', tone: 'serious', type: 'line', t: 'شوية بشوية كيوصل الواحد.' },
  { d: 'ma', tone: 'tough', type: 'line', t: 'باراكا من التسويف! نوض دابا.' },
];

export function toneFor(d: AppData, energy?: Energy): Tone[] {
  if (energy === 'overwhelmed' || energy === 'scattered' || energy === 'low') return ['gentle'];
  const c = consistency(d);
  if (c === 0) return ['gentle', 'serious'];
  if (c === 1) return ['fun', 'serious'];
  return d.profile.toughLove ? ['tough', 'fun'] : ['fun', 'serious'];
}

const fmtDate = (ts: number, lang: 'en' | 'ar') =>
  new Date(ts).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { weekday: 'long' });

/** One line for now. Varies by day + nonce, adapts to dialect, tone, and memories. */
export function motivationLine(d: AppData, energy?: Energy, nonce = 0): { text: string; kind: string; rtl: boolean } {
  const dialect = preferredDialect(d);
  const tones = toneFor(d, energy);
  const seed = hash(dayKey() + ':' + nonce);
  // every few lines, bring back something the user said (a callback)
  const mems = d.memories.filter((m) => m.source === 'reflection' || m.source === 'goal');
  if (mems.length && seed % 4 === 0) {
    const m = mems[seed % mems.length];
    const lang = d.profile.lang;
    const text = lang === 'ar'
      ? `يوم ${fmtDate(m.ts, 'ar')} كتبتَ: «${m.text}». تذكّر هذا الشعور، وابدأ بخطوة صغيرة.`
      : `On ${fmtDate(m.ts, 'en')} you wrote: “${m.text}”. Hold on to that and take one small step.`;
    return { text, kind: 'callback', rtl: lang === 'ar' };
  }
  let pool = L.filter((l) => l.d === dialect && tones.includes(l.tone));
  if (pool.length < 2) pool = L.filter((l) => l.d === (dialect === 'en' ? 'en' : 'msa') && tones.includes(l.tone));
  if (!pool.length) pool = L.filter((l) => l.d === 'en');
  // mix in some MSA stories/facts for Arabic users so content stays varied
  if (dialect !== 'en' && dialect !== 'msa') pool = pool.concat(L.filter((l) => l.d === 'msa' && l.type !== 'line' && tones.includes(l.tone)));
  const line = pool[seed % pool.length];
  return { text: line.t, kind: line.type, rtl: line.d !== 'en' };
}

export function aiLinePrompt(d: AppData, energy?: Energy) {
  const dialect = preferredDialect(d);
  const tones = toneFor(d, energy);
  const mems = d.memories.slice(-6).map((m) => `- ${m.text}`).join('\n');
  const names: Record<string, string> = { en: 'English', msa: 'Modern Standard Arabic', eg: 'Egyptian Arabic', gulf: 'Gulf Arabic', lev: 'Levantine Arabic', iq: 'Iraqi Arabic', ma: 'Moroccan Darija' };
  return `You are Rafiq, a warm companion in an ADHD-friendly productivity app. Write ONE short motivational message (max 45 words) for ${d.profile.name || 'the user'}.
Language/dialect: ${names[dialect]}. Tone: ${tones.join(' or ')} (tough love means playful challenge about the task, never insulting the person).
Pick one format at random: a 2-3 sentence micro-story, a surprising true fact, a light joke, or a callback to something they said.
Things they told me recently:
${mems || '- (nothing yet)'}
Their interests: ${d.profile.interests.join(', ') || 'unknown'}.
Never shame, never mention guilt. Reply with only the message.`;
}
