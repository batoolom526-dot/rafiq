import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { useT, useUI, useEnergy } from '../lib/ui';
import { openTasks, ranked, sessionLenFor, nextStep } from '../lib/engine';
import { cancelFocus, completeTask, endBreak, extendFocus, finishFocus, pauseFocus, resumeFocus, saveReentry, startFocus } from '../lib/actions';
import { dayKey, fmtTimer, uid } from '../lib/util';
import { playNoise, stopNoise } from '../lib/sound';
import { speak } from '../lib/voice';
import { Rafiq } from '../components/Rafiq';
import { Seg } from '../components/ui';
import { IPause, IPlay, IPlus, IX, ICheck } from '../components/Icons';

const LENGTHS = [5, 10, 15, 25, 30, 45, 50];

export function Focus() {
  const t = useT();
  const data = useApp((s) => s.data);
  const mutate = useApp((s) => s.mutate);
  const energy = useEnergy();
  const f = data.focus;
  const suggested = sessionLenFor(energy);
  const tasks = useMemo(() => ranked(data, energy).slice(0, 8), [data.tasks, energy]);
  const [taskId, setTaskId] = useState<string>(f.taskId || tasks[0]?.id || 'free');
  const [free, setFree] = useState('');
  const [len, setLen] = useState(suggested);
  const [now, setNow] = useState(Date.now());
  const [park, setPark] = useState('');
  const [reentry, setReentry] = useState('');
  const owned = data.rewards.owned;

  // display tick only; completion is detected globally in <FocusWatcher/>
  useEffect(() => {
    if (f.phase !== 'focus' && f.phase !== 'break') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [f.phase]);

  // timer in the tab title
  useEffect(() => {
    const base = 'Rafiq';
    if (f.phase === 'focus' || f.phase === 'break') document.title = `${fmtTimer(f.endsAt - now)} · ${base}`;
    else document.title = base;
    return () => {
      document.title = base;
    };
  }, [now, f.phase]);

  useEffect(() => {
    document.documentElement.classList.toggle('focus-zen', f.phase === 'focus');
    return () => document.documentElement.classList.remove('focus-zen');
  }, [f.phase]);


  const task = data.tasks.find((x) => x.id === (f.phase === 'idle' ? taskId : f.taskId));
  const sessionsToday = data.sessions.filter((s) => dayKey(s.start) === dayKey());
  const minsToday = sessionsToday.reduce((a, s) => a + s.actualMin, 0);
  const parked = data.park.filter((p) => !p.done);
  const last = data.sessions[data.sessions.length - 1];
  const lastDone = !!last && last.completed && last.kind === 'focus' && Date.now() - last.end < 15 * 60000;

  const begin = () => {
    const tk = data.tasks.find((x) => x.id === taskId);
    const title = tk ? (nextStep(tk)?.title ? `${tk.title} · ${nextStep(tk)!.title}` : tk.title) : free.trim() || t('focus.title');
    startFocus({ taskId: tk?.id, title, minutes: len });
  };

  const addPark = () => {
    if (!park.trim()) return;
    mutate((d) => {
      d.park.push({ id: uid(), text: park.trim(), createdAt: Date.now(), done: false });
    });
    setPark('');
  };

  const total = f.phase === 'break' ? f.breakMin * 60000 : f.plannedMin * 60000;
  const remaining = f.phase === 'paused' ? f.remainingMs : Math.max(0, f.endsAt - now);
  const progress = f.phase === 'idle' ? 0 : 1 - remaining / Math.max(1, total);
  const R = 120;
  const C = 2 * Math.PI * R;

  const soundOptions = (['off', 'brown', 'pink', 'rain'] as const).filter((s) => s === 'off' || s === 'brown' || owned.includes('sound-' + s));

  return (
    <div className="stack xl">
      <div className="row between">
        <h1>{t('focus.title')}</h1>
        <span className="small muted num">{t('focus.todayCount', { n: sessionsToday.length, m: Math.round(minsToday) })}</span>
      </div>

      {f.phase === 'idle' && (
        <section className="stack lg">
          {lastDone && (
            <div className="card soft row nowrap">
              <Rafiq pose="cheer" size={64} />
              <div className="stack grow" style={{ gap: 4 }}>
                <h3>{t('focus.doneTitle')}</h3>
                <p className="small muted">{t('focus.doneBody')}</p>
              </div>
            </div>
          )}
          <div className="stack">
            <h3>{t('focus.what')}</h3>
            <div className="stack" style={{ gap: 6 }}>
              {tasks.map((tk) => (
                <label key={tk.id} className="card row nowrap" style={{ padding: '12px 14px', cursor: 'pointer', borderColor: taskId === tk.id ? 'var(--gold-2)' : undefined }}>
                  <input type="radio" name="focus-task" checked={taskId === tk.id} onChange={() => setTaskId(tk.id)} style={{ accentColor: 'var(--gold-2)' }} />
                  <span className="grow" style={{ overflowWrap: 'anywhere' }}>{tk.title}{nextStep(tk) && <span className="small muted"> · {nextStep(tk)!.title}</span>}</span>
                </label>
              ))}
              <label className="card row nowrap" style={{ padding: '12px 14px', cursor: 'pointer', borderColor: taskId === 'free' ? 'var(--gold-2)' : undefined }}>
                <input type="radio" name="focus-task" checked={taskId === 'free'} onChange={() => setTaskId('free')} style={{ accentColor: 'var(--gold-2)' }} />
                <span>{t('focus.free')}</span>
              </label>
              {taskId === 'free' && <input id="focus-free" className="input" placeholder={t('focus.freePh')} value={free} onChange={(e) => setFree(e.target.value)} />}
            </div>
          </div>
          {task?.reentry && <p className="card soft small">↩ {t('focus.reentryWas')}: <b>{task.reentry}</b></p>}
          <div className="stack">
            <div className="row between"><h3>{t('focus.len')}</h3><span className="small muted">{t('focus.lenHint', { n: suggested })}</span></div>
            <div className="chips">
              {LENGTHS.map((m) => <button key={m} className="chip" aria-pressed={len === m} onClick={() => setLen(m)}>{m} {t('min')}</button>)}
            </div>
          </div>
          <div className="stack">
            <h3>{t('focus.sound')}</h3>
            <Seg value={data.settings.sound} onChange={(v) => mutate((d) => { d.settings.sound = v; })} options={soundOptions.map((s) => ({ v: s, l: t('sound.' + s) }))} />
          </div>
          <button className="btn gold lg block" onClick={begin}><IPlay /> {t('focus.start')} · {len} {t('min')}</button>
        </section>
      )}

      {f.phase !== 'idle' && (
        <section className="stack lg">
          <div className="disc-wrap">
            <div className="disc">
              <svg viewBox="0 0 280 280">
                <circle cx="140" cy="140" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
                <circle cx="140" cy="140" r={R} fill="none" stroke={f.phase === 'break' || f.pausedFrom === 'break' ? 'var(--accent)' : 'url(#rq-gold)'} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * progress} transform="rotate(-90 140 140)" style={{ transition: 'stroke-dashoffset .3s linear' }} />
              </svg>
              <div className="center">
                <Rafiq pose={f.phase === 'break' ? 'eat' : f.phase === 'paused' ? 'calm' : 'focus'} size={70} />
                <div className="time">{fmtTimer(remaining)}</div>
                <span className="small muted">{f.phase === 'break' ? t('focus.breakTitle') : f.phase === 'paused' ? t('focus.pause') : t('focus.title')}</span>
              </div>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.1rem', overflowWrap: 'anywhere' }}>{f.title}</p>
          {f.phase === 'break' && <p className="card soft small" style={{ textAlign: 'center' }}>{t('focus.breakIdeas')}</p>}
          <div className="row" style={{ justifyContent: 'center' }}>
            {f.phase === 'paused' ? (
              <button className="btn gold" onClick={resumeFocus}><IPlay /> {t('focus.resume')}</button>
            ) : (
              <button className="btn ghost" onClick={pauseFocus}><IPause /> {t('focus.pause')}</button>
            )}
            {(f.phase === 'focus' || f.pausedFrom === 'focus') && <button className="btn ghost" onClick={() => extendFocus(5)}><IPlus /> {t('focus.plus5')}</button>}
            {(f.phase === 'focus' || (f.phase === 'paused' && f.pausedFrom === 'focus')) && (
              <button className="btn ghost" onClick={() => { finishFocus(remaining < 60000, energy); if (remaining >= 60000) cancelFocus(); }}><IX /> {t('focus.end')}</button>
            )}
            {(f.phase === 'break' || f.pausedFrom === 'break') && <button className="btn ghost" onClick={() => endBreak(false)}>{t('focus.skipBreak')}</button>}
          </div>

          {(f.phase === 'break' || f.pausedFrom === 'break') && f.taskId && (
            <div className="card stack">
              <h3>{t('focus.reentryQ')}</h3>
              <div className="row nowrap">
                <input id="reentry" className="input grow" placeholder={t('focus.reentryPh')} value={reentry} onChange={(e) => setReentry(e.target.value)} />
                <button className="btn sm" onClick={() => { saveReentry(f.taskId, reentry); setReentry(''); useUI.getState().toast(t('toast.saved')); }} disabled={!reentry.trim()}>{t('save')}</button>
              </div>
              {data.tasks.find((x) => x.id === f.taskId)?.status === 'todo' && (
                <button className="btn sm soft" onClick={() => completeTask(f.taskId!)}><ICheck /> {t('focus.markDone')}</button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="card stack">
        <h3>{t('focus.park')}</h3>
        <div className="row nowrap">
          <input id="park" className="input grow" placeholder={t('focus.parkPh')} value={park} onChange={(e) => setPark(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPark()} />
          <button className="icon-btn" aria-label={t('add')} onClick={addPark}><IPlus /></button>
        </div>
        {parked.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            {parked.map((p) => (
              <div key={p.id} className="step-row">
                <button className="check" aria-label={t('done')} onClick={() => mutate((d) => { const x = d.park.find((y) => y.id === p.id); if (x) x.done = true; })}><ICheck /></button>
                <span className="grow small">{p.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
