import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { useT, useUI } from '../lib/ui';
import { ranked } from '../lib/engine';
import { Rafiq } from './Rafiq';

/** Hides everything: 3 slow breaths, then one tiny thing. */
export function Overwhelm() {
  const t = useT();
  const set = useUI((s) => s.setOverwhelm);
  const open = useUI((s) => s.open);
  const data = useApp((s) => s.data);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [rounds, setRounds] = useState(0);

  useEffect(() => {
    const dur = phase === 'in' ? 4000 : phase === 'hold' ? 3000 : 6000;
    const id = setTimeout(() => {
      if (phase === 'in') setPhase('hold');
      else if (phase === 'hold') setPhase('out');
      else {
        setPhase('in');
        setRounds((r) => r + 1);
      }
    }, dur);
    return () => clearTimeout(id);
  }, [phase]);

  const top = ranked(data, 'overwhelmed')[0];
  const tiny = top ? (top.steps.find((s) => !s.done && s.minutes <= 5)?.title ?? `${top.title}: ${t('just.tiny').split('.')[0].toLowerCase()}`) : t('overwhelm.fallback');

  return (
    <div className="calm-screen" role="dialog" aria-modal="true" aria-label={t('overwhelm.title')}>
      <div className="calm-in">
        <h1>{t('overwhelm.title')}</h1>
        <div className={`breath ${phase === 'in' ? 'in' : phase === 'out' ? 'out' : 'in'}`}>
          <Rafiq pose="calm" size={110} />
        </div>
        <p className="muted" aria-live="polite">{t('overwhelm.' + phase)}</p>
        {rounds >= 3 ? (
          <div className="stack lg" style={{ justifyItems: 'center' }}>
            <p>{t('overwhelm.one')}</p>
            <p className="card soft" style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>{top ? (top.steps.find((s) => !s.done)?.title ?? top.title) : tiny}</p>
            <button className="btn gold lg" onClick={() => { set(false); if (top) open({ kind: 'just', taskId: top.id }); }}>{t('overwhelm.ok')}</button>
            <button className="btn link" onClick={() => set(false)}>{t('overwhelm.leave')}</button>
          </div>
        ) : (
          <button className="btn link" onClick={() => setRounds(3)}>{t('skip')}</button>
        )}
      </div>
    </div>
  );
}
