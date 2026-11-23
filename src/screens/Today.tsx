import { useEffect, useMemo, useState } from 'react';
import { useApp, todayCheckin } from '../lib/store';
import { useT, useUI, useEnergy, withThinking } from '../lib/ui';
import { buildPlan, earn, momentum, poseFor, recommend } from '../lib/engine';
import { motivationLine, aiLinePrompt } from '../lib/motivation';
import { freshLine, postpone } from '../lib/actions';
import { aiReady } from '../lib/ai';
import { dayKey, fmtClock, nowMinutes, minutesOfDay, isArabicText } from '../lib/util';
import type { Energy } from '../lib/types';
import { Rafiq } from '../components/Rafiq';
import { Ring, SpeakButton } from '../components/ui';
import { IPlay, IWand, IPlus, ISpark, IWave } from '../components/Icons';

const ENERGIES: { e: Energy; icon: string }[] = [
  { e: 'high', icon: '⚡' }, { e: 'normal', icon: '🙂' }, { e: 'low', icon: '🌙' }, { e: 'scattered', icon: '🌀' }, { e: 'overwhelmed', icon: '🌊' },
];
const TIMES = [30, 60, 120, 180, 240];

export function Today({ banner }: { banner: string | null }) {
  const t = useT();
  const data = useApp((s) => s.data);
  const mutate = useApp((s) => s.mutate);
  const { open, setOverwhelm, thinking, celebrateUntil, toast } = useUI();
  const energy = useEnergy();
  const checkin = todayCheckin(data);
  const [nonce, setNonce] = useState(0);
  const [aiLine, setAiLine] = useState<string | null>(null);
  const [lineBusy, setLineBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const rec = useMemo(() => recommend(data, energy), [data, energy]);
  const plan = useMemo(() => buildPlan(data, energy, checkin?.availableMin ?? 120), [data, energy, checkin?.availableMin]);
  const line = useMemo(() => motivationLine(data, energy, nonce), [data.memories.length, data.dialect, energy, nonce, data.profile.lang]);
  const mom = momentum(data);
  const away = Date.now() - data.prevOpen > 3 * 86400000;
  const pose = poseFor(data, { focusing: data.focus.phase === 'focus', thinking: thinking > 0, celebrating: Date.now() < celebrateUntil, energy, away });

  const h = new Date().getHours();
  const greet = h < 5 ? 'greet.night' : h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : h < 22 ? 'greet.evening' : 'greet.night';

  const setEnergy = (e: Energy) => {
    const first = !checkin;
    mutate((d) => {
      const c = d.checkins.find((x) => x.date === dayKey());
      if (c) {
        c.energy = e;
        c.ts = Date.now();
      } else d.checkins.push({ date: dayKey(), energy: e, availableMin: 120, ts: Date.now() });
      if (d.checkins.length > 400) d.checkins.splice(0, d.checkins.length - 400);
    });
    if (first) {
      const got = earn(2, 'spark.checkin');
      if (got) toast(t('toast.done', { n: got }));
    }
    if (e === 'overwhelmed') setOverwhelm(true);
  };
  const setTime = (m: number) =>
    mutate((d) => {
      const c = d.checkins.find((x) => x.date === dayKey());
      if (c) c.availableMin = m;
      else d.checkins.push({ date: dayKey(), energy: 'normal', availableMin: m, ts: Date.now() });
    });

  const newLine = async () => {
    if (!aiReady()) {
      setNonce((n) => n + 1);
      return;
    }
    setLineBusy(true);
    try {
      setAiLine((await withThinking(() => freshLine(aiLinePrompt(data, energy)))).trim());
    } catch {
      setNonce((n) => n + 1);
    } finally {
      setLineBusy(false);
    }
  };

  const shownLine = aiLine ?? line.text;
  const now = nowMinutes();
  const asleep = pose === 'sleep';
  const hasTasks = data.tasks.some((x) => x.status === 'todo');
  const doneToday = data.tasks.filter((x) => x.doneAt && dayKey(x.doneAt) === dayKey()).length;

  return (
    <div className="stack xl">
      <section className="hello">
        <Rafiq pose={pose} size={84} />
        <h1>
          {t(greet)}{data.profile.name ? `, ${data.profile.name}` : ''}
          <small>{asleep ? t('today.sleepy') : pose === 'eat' ? t('today.meal') : t('today.energyQ')}</small>
        </h1>
      </section>

      {banner && <p className="card soft small">{banner}</p>}

      <section className="stack" aria-label={t('today.energyQ')}>
        <div className="chips" role="group" aria-label={t('today.energyQ')}>
          {ENERGIES.map(({ e, icon }) => (
            <button key={e} className="chip" aria-pressed={checkin?.energy === e} onClick={() => setEnergy(e)}>{icon} {t('energy.' + e)}</button>
          ))}
        </div>
        <div className="row">
          <span className="small muted">{t('today.timeQ')}:</span>
          <div className="chips">
            {TIMES.map((m) => (
              <button key={m} className="chip" style={{ padding: '4px 10px', fontSize: '.82rem' }} aria-pressed={(checkin?.availableMin ?? 120) === m} onClick={() => setTime(m)}>
                {m >= 60 ? `${m / 60}h` : `${m}m`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {rec ? (
        <section className="card hero pad-lg one-thing" aria-label={t('today.oneThing')}>
          <span className="eyebrow">{t('today.oneThing')} · {t('space.' + rec.task.space)}</span>
          <div className="title">{rec.task.title}</div>
          {rec.step && <div className="step">→ {rec.step.title}</div>}
          {rec.task.reentry && <p className="small muted">↩ {t('focus.reentryWas')}: {rec.task.reentry}</p>}
          {rec.why.length > 0 && <div className="why">{rec.why.map((w, i) => <span key={i}>{t(w.key, w.vars)}</span>)}</div>}
          <div className="row">
            <button className="btn gold lg grow" onClick={() => open({ kind: 'just', taskId: rec.task.id })}><IPlay /> {t('today.justStart', { n: rec.minutes })}</button>
            <button className="btn ghost" onClick={() => postpone(rec.task.id)}>{t('today.notNow')}</button>
          </div>
        </section>
      ) : (
        <section className="card hero pad-lg stack">
          <span className="eyebrow">{t('today.oneThing')}</span>
          <h2>{hasTasks ? t('today.allDone') : t('today.emptyTitle')}</h2>
          {!hasTasks && <p className="muted">{t('today.emptyBody')}</p>}
          <div className="row">
            <button className="btn gold" onClick={() => open({ kind: 'dump' })}><IWand /> {t('today.brainDump')}</button>
            <button className="btn ghost" onClick={() => open({ kind: 'task' })}><IPlus /> {t('today.addTask')}</button>
          </div>
        </section>
      )}

      <section className="quote" aria-live="polite">
        <span aria-hidden="true" style={{ color: 'var(--gold)', fontSize: '1.4rem', lineHeight: 1 }}>❝</span>
        <p dir={isArabicText(shownLine) ? 'rtl' : 'ltr'}>{lineBusy ? t('thinking') : shownLine}</p>
        <div className="row nowrap" style={{ gap: 4 }}>
          <SpeakButton text={shownLine} label=" " />
          <button className="icon-btn" aria-label={t('next')} onClick={newLine} disabled={lineBusy}><IWave /></button>
        </div>
      </section>

      <section className="stats3">
        <div className="stat row nowrap" style={{ gridTemplateColumns: 'auto 1fr', display: 'flex' }}>
          <Ring value={mom} size={46} label={t('today.momentum')} />
          <span>{t('today.momentum')}</span>
        </div>
        <div className="stat"><b className="num"><ISpark style={{ width: 16, height: 16, color: 'var(--gold)' }} /> {data.rewards.sparks}</b><span>{t('today.sparks')}</span></div>
        <div className="stat"><b className="num">{doneToday}</b><span>{t('growth.done')}</span></div>
      </section>

      <section className="stack">
        <div className="section-title">
          <h2>{t('today.plan')}</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" onClick={() => open({ kind: 'dump' })}><IWand /> {t('today.brainDump')}</button>
            <button className="btn sm ghost" onClick={() => setOverwhelm(true)}>🌊 {t('today.overwhelmed')}</button>
          </div>
        </div>
        {plan.length ? (
          <div className="card timeline">
            {plan.map((b, i) => (
              <div key={i} className={`tl ${b.kind}`}>
                <span className="t">{fmtClock(b.start)}</span>
                <span className="grow" style={{ overflowWrap: 'anywhere' }}>{b.kind === 'break' ? t('plan.break', { n: b.minutes }) : b.title}</span>
                <span className="tiny muted num">{b.kind === 'focus' ? t('plan.focus', { n: b.minutes }) : b.kind === 'anchor' ? `${b.minutes}${t('min')}` : ''}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">{t('today.planEmpty')}</p>
        )}
      </section>
    </div>
  );
}
