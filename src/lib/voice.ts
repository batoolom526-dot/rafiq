/* Voice out (read aloud) and voice in (dictation).
 * Inside Claude: Claude voices + dictation capabilities.
 * Elsewhere: the browser's built-in speechSynthesis / SpeechRecognition (free). */
import { cap } from './platform';
import { useApp } from './store';
import { isArabicText } from './util';

type Listener = (speaking: boolean) => void;
const listeners = new Set<Listener>();
let speakingNow = false;
const setSpeaking = (v: boolean) => {
  speakingNow = v;
  listeners.forEach((l) => l(v));
};
export const onSpeaking = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const isSpeaking = () => speakingNow;

let ttsHooked = false;

const chunk = (text: string, size = 1800) => {
  const parts: string[] = [];
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?؟。\n]+[.!?؟。]?\s*/g) || [text];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > size && cur) {
      parts.push(cur);
      cur = '';
    }
    cur += s;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
};

export async function speak(text: string) {
  const clean = text.replace(/[#*_`>\[\]]/g, '').trim();
  if (!clean) return;
  const s = useApp.getState().data.settings;
  const lang = isArabicText(clean) ? 'ar' : 'en';
  const tts = await cap<any>('tts');
  if (tts) {
    if (!ttsHooked) {
      ttsHooked = true;
      tts.onState(({ state }: { state: string }) => setSpeaking(state === 'speaking' || state === 'starting'));
    }
    try {
      setSpeaking(true);
      const lines = chunk(clean).map((t) => ({ text: t, voice: s.voice, language: lang, rate: s.voiceRate }));
      await tts.speak(lines);
      return;
    } catch (e: any) {
      if (e?.code === 'stopped' || e?.code === 'busy') return;
      // fall through to the browser voice
    }
  }
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const parts = chunk(clean, 220);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang));
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    if (voice) u.voice = voice;
    u.rate = s.voiceRate;
    if (i === 0) u.onstart = () => setSpeaking(true);
    if (i === parts.length - 1) {
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
    }
    window.speechSynthesis.speak(u);
  });
}

export async function stopSpeaking() {
  const tts = await cap<any>('tts');
  try {
    await tts?.stop();
  } catch {}
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  setSpeaking(false);
}

/* ---------- dictation ---------- */

export interface Dictation {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/** Returns null when no speech input is available on this device. */
export async function createDictation(
  onText: (finalText: string) => void,
  onPartial: (t: string) => void,
  onState: (listening: boolean) => void,
): Promise<Dictation | null> {
  const d = await cap<any>('dictation');
  if (d) {
    d.onFinal(({ text }: { text: string }) => onText(text));
    d.onPartial(({ text }: { text: string }) => onPartial(text));
    d.onState(({ state }: { state: string }) => onState(state === 'listening' || state === 'starting'));
    return {
      start: () => d.start().catch(() => onState(false)),
      stop: () => d.stop().catch(() => {}),
    };
  }
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  let rec: any = null;
  return {
    start: async () => {
      rec = new SR();
      rec.lang = useApp.getState().data.profile.lang === 'ar' ? 'ar-SA' : 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (ev: any) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) onText(r[0].transcript);
          else interim += r[0].transcript;
        }
        onPartial(interim);
      };
      rec.onend = () => onState(false);
      rec.onerror = () => onState(false);
      try {
        rec.start();
        onState(true);
      } catch {
        onState(false);
      }
    },
    stop: async () => {
      try {
        rec?.stop();
      } catch {}
    },
  };
}
