import { useState } from 'react';
import { useApp } from '../lib/store';
import { useT } from '../lib/ui';
import type { SpaceId } from '../lib/types';
import { Logo } from '../components/Logo';
import { Field, Seg } from '../components/ui';
import { CharacterSetup, PalettePicker } from './You';

const ALL: SpaceId[] = ['study', 'work', 'health', 'home', 'money', 'growth'];

export function Onboarding() {
  const t = useT();
  const p = useApp((s) => s.data.profile);
  const mutate = useApp((s) => s.mutate);
  const [step, setStep] = useState(0);
  const setP = (fn: (x: typeof p) => void) => mutate((d) => fn(d.profile));
  const steps = 5;
  const finish = () => setP((x) => { x.onboarded = true; });

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="row between">
          <div className="dots" aria-hidden="true">{Array.from({ length: steps }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
          <Seg value={p.lang} onChange={(v) => setP((x) => { x.lang = v; })} options={[{ v: 'en', l: 'EN' }, { v: 'ar', l: 'ع' }]} label={t('onb.lang')} />
        </div>

        {step === 0 && (
          <div className="stack xl" style={{ justifyItems: 'start' }}>
            <div className="onb-mark"><Logo size={96} /></div>
            <div className="stack">
              <h1>{t('onb.welcome')}</h1>
              <p style={{ fontFamily: 'var(--font-brand)', fontSize: '1.4rem', color: 'var(--gold)' }}>{t('motto')}</p>
              <p className="muted">{t('onb.intro')}</p>
            </div>
            <Field label={t('onb.name')}>
              <input id="onb-name" className="input" autoFocus value={p.name} onChange={(e) => setP((x) => { x.name = e.target.value; })} onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="stack lg">
            <h1>{t('onb.look')}</h1>
            <PalettePicker value={p.palette} onChange={(v) => setP((x) => { x.palette = v; })} />
            <Seg value={p.mode} onChange={(v) => setP((x) => { x.mode = v; })} options={[{ v: 'light', l: t('you.light') }, { v: 'dark', l: t('you.dark') }, { v: 'system', l: t('you.system') }]} />
          </div>
        )}

        {step === 2 && (
          <div className="stack lg">
            <h1>{t('onb.spaces')}</h1>
            <div className="chips">
              {ALL.map((sp) => (
                <button key={sp} className="chip" aria-pressed={p.spaces.includes(sp)} onClick={() => setP((x) => { x.spaces = x.spaces.includes(sp) ? (x.spaces.length > 1 ? x.spaces.filter((y) => y !== sp) : x.spaces) : [...x.spaces, sp]; })}>{t('space.' + sp)}</button>
              ))}
            </div>
            <Field label={t('you.interests')}>
              <input id="onb-interests" className="input" placeholder={t('you.interestsPh')} defaultValue={p.interests.join(', ')} onBlur={(e) => setP((x) => { x.interests = e.target.value.split(/[,،]/).map((y) => y.trim()).filter(Boolean).slice(0, 20); })} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="stack lg">
            <h1>{t('onb.rhythm')}</h1>
            <div className="grid2">
              <Field label={t('you.wake')}><input id="onb-wake" type="time" className="input" value={p.wake} onChange={(e) => setP((x) => { x.wake = e.target.value; })} /></Field>
              <Field label={t('you.sleep')}><input id="onb-sleep" type="time" className="input" value={p.sleep} onChange={(e) => setP((x) => { x.sleep = e.target.value; })} /></Field>
            </div>
            <p className="small muted">{t('you.anchorsHint')}</p>
          </div>
        )}

        {step === 4 && (
          <div className="stack lg">
            <h1>{t('onb.character')}</h1>
            <CharacterSetup />
            <p className="small muted">{t('onb.charSkip')}</p>
          </div>
        )}

        <div className="row between">
          {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>{t('back')}</button> : <span />}
          {step < steps - 1 ? (
            <button className="btn" onClick={() => setStep(step + 1)}>{t('next')}</button>
          ) : (
            <button className="btn gold lg" onClick={finish}>{t('onb.finish')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
