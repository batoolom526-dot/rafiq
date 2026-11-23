import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IX, IMic, ISpeaker } from './Icons';
import { useT } from '../lib/ui';
import { createDictation, speak, stopSpeaking, onSpeaking, type Dictation } from '../lib/voice';
import { learnDialect } from '../lib/engine';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 680 } : undefined}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}><IX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Ring({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }} aria-label={label}>
      <svg viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="url(#rq-gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value / 100))} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <b>{Math.round(value)}</b>
    </div>
  );
}

/** Microphone button: appends finished phrases through onText. Hidden when no speech input exists. */
export function MicButton({ onText, onPartial }: { onText: (s: string) => void; onPartial?: (s: string) => void }) {
  const t = useT();
  const [dict, setDict] = useState<Dictation | null>(null);
  const [listening, setListening] = useState(false);
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => {
    let live = true;
    createDictation(
      (txt) => {
        learnDialect(txt);
        cb.current(txt);
      },
      (p) => onPartial?.(p),
      (l) => live && setListening(l),
    ).then((d) => live && setDict(d));
    return () => {
      live = false;
    };
  }, []);
  if (!dict) return null;
  return (
    <button type="button" className={`btn sm ${listening ? 'gold' : 'ghost'}`} onClick={() => (listening ? dict.stop() : dict.start())}>
      <IMic /> {listening ? t('dump.listening') : t('dump.speak')}
    </button>
  );
}

export function SpeakButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  useEffect(() => onSpeaking(setOn), []);
  return (
    <button type="button" className="btn sm ghost" onClick={() => (on ? stopSpeaking() : speak(text))} disabled={!text}>
      <ISpeaker /> {on ? t('stop') : label || t('study.listen')}
    </button>
  );
}

export function Sparkline({ values, higherIsBetter = true }: { values: number[]; higherIsBetter?: boolean }) {
  if (values.length < 2) return null;
  const w = 240, h = 48, p = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [p + (i * (w - 2 * p)) / (values.length - 1), h - p - ((v - min) / span) * (h - 2 * p)]);
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`;
  const last = pts[pts.length - 1];
  const up = values[values.length - 1] >= values[0];
  const good = up === higherIsBetter;
  return (
    <svg className="spark-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="var(--gold-2)" opacity=".14" />
      <path d={d} fill="none" stroke={good ? 'var(--gold-2)' : 'var(--muted)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--gold-2)" />
    </svg>
  );
}

export function Thinking() {
  const t = useT();
  return <p className="muted small" aria-live="polite">{t('thinking')}</p>;
}
