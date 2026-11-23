import { useEffect, useMemo, useState } from 'react';
import { Modal, MicButton } from './ui';
import { useApp } from '../lib/store';
import { useT, useUI, useEnergy, withThinking } from '../lib/ui';
import { aiSteps, toggleStep, upsertTask } from '../lib/actions';
import { aiReady } from '../lib/ai';
import { earn, newTask, templateSteps, tinyStep, guessSpace, learnDialect } from '../lib/engine';
import { fmtTimer, uid } from '../lib/util';
import { chime } from '../lib/sound';
import type { Step } from '../lib/types';
import { Rafiq } from './Rafiq';

type Phase = 'ask' | 'step' | 'running' | 'after' | 'finished';

export function JustStart({ taskId, text }: { taskId?: string; text?: string }) {
  const t = useT();
  const close = useUI((s) => s.close);
  const toast = useUI((s) => s.toast);
  const energy = useEnergy();
  const data = useApp((s) => s.data);
  const task = taskId ? data.tasks.find((x) => x.id === taskId) : undefined;
  const [what, setWhat] = useState(text || task?.title || '');
  const [steps, setSteps] = useState<Step[]>(() => task?.steps.filter((s) => !s.done) ?? []);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>(task && steps.length ? 'step' : 'ask');
  const [busy, setBusy] = useState(false);
  const [endsAt, setEndsAt] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [savedId, setSavedId] = useState<string | undefined>(taskId);

  const step = steps[idx];
  // first challenge is 2-5 minutes; each next one grows a little
  const challenge = useMemo(() => {
    if (!step) return 5;
    const cap = energy === 'overwhelmed' ? 3 : energy === 'low' || energy === 'scattered' ? 5 : 8;
    return Math.max(2, Math.min(step.minutes, idx === 0 ? Math.min(5, cap) : cap + idx * 2));
  }, [step, idx, energy]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= endsAt) {
        clearInterval(id);
        if (data.settings.chime) chime();
        setPhase('after');
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, endsAt]);

  const makeSteps = async () => {
    if (!what.trim()) return;
    learnDialect(what);
    setBusy(true);
    let s = templateSteps(what, data.profile.lang);
    if (aiReady()) {
      try {
        s = await withThinking(() => aiSteps(what));
      } catch {}
    }
    setBusy(false);
    setSteps(s);
    setIdx(0);
    setPhase('step');
  };

  const go = () => {
    setStartedAt(Date.now());
    setEndsAt(Date.now() + challenge * 60000);
    setNow(Date.now());
    setPhase('running');
  };

  const logSession = () => {
    const mins = Math.max(1, Math.round((Math.min(Date.now(), endsAt) - startedAt) / 60000));
    useApp.getState().mutate((d) => {
      d.sessions.push({ id: uid(), taskId: savedId, title: step?.title || what, start: startedAt, end: Date.now(), plannedMin: challenge, actualMin: mins, kind: 'start', energy, completed: true });
      const tt = savedId ? d.tasks.find((x) => x.id === savedId) : undefined;
      if (tt) tt.actualMin += mins;
    });
  };

  const did = () => {
    logSession();
    if (savedId && step && data.tasks.find((x) => x.id === savedId)?.steps.some((s) => s.id === step.id)) toggleStep(savedId, step.id);
    const got = earn(3, 'spark.start');
    if (got) toast(t('toast.done', { n: got }));
    useUI.getState().celebrate();
    if (idx + 1 >= steps.length) setPhase('finished');
    else {
      setIdx(idx + 1);
      setPhase('step');
    }
  };

  const stopHere = () => {
    if (phase === 'after') logSession();
    close();
  };

  const stuck = () => {
    const tiny = tinyStep(step?.title || what, data.profile.lang);
    setSteps([...steps.slice(0, idx), tiny, ...steps.slice(idx)]);
    if (savedId) {
      useApp.getState().mutate((d) => {
        const tt = d.tasks.find((x) => x.id === savedId);
        if (tt) {
          const at = tt.steps.findIndex((s) => s.id === step?.id);
          tt.steps.splice(at < 0 ? 0 : at, 0, tiny);
        }
      });
    }
    toast(t('just.stuckHelp'));
  };

  const saveTask = () => {
    const nt = newTask({ title: what.trim(), space: guessSpace(what, data.profile.spaces), steps: steps.map((s, i) => ({ ...s, done: i < idx })), estimateMin: steps.reduce((a, s) => a + s.minutes, 0) || 30 });
    upsertTask(nt);
    setSavedId(nt.id);
    toast(t('just.saved'));
  };

  const remaining = Math.max(0, endsAt - now);
  const pct = phase === 'running' ? 1 - remaining / (challenge * 60000) : 0;

  return (
    <Modal title={t('just.title')} onClose={close}>
      <div className="stack lg">
        {phase === 'ask' && (
          <>
            <p>{t('just.q')}</p>
            <textarea id="just-what" className="textarea" style={{ minHeight: 80 }} placeholder={t('just.ph')} value={what} onChange={(e) => setWhat(e.target.value)} autoFocus />
            <div className="row between">
              <MicButton onText={(s) => setWhat((x) => (x ? x + ' ' : '') + s)} />
              <button className="btn gold" onClick={makeSteps} disabled={busy || !what.trim()}>{busy ? t('thinking') : t('just.break')}</button>
            </div>
          </>
        )}

        {(phase === 'step' || phase === 'running') && step && (
          <>
            <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
              <Rafiq pose={phase === 'running' ? 'focus' : 'wave'} size={60} />
              <div className="stack grow" style={{ gap: 6 }}>
                <span className="eyebrow">{t('just.challenge', { n: challenge })}</span>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', lineHeight: 1.3 }}>{step.title}</p>
                {idx === 0 && phase === 'step' && <p className="small muted">{t('just.tiny')}</p>}
              </div>
            </div>
            {phase === 'step' ? (
              <>
                <button className="btn gold lg block" onClick={go}>{t('just.go', { n: challenge })}</button>
                <p className="small muted" style={{ textAlign: 'center' }}>{t('just.allowed')}</p>
                <div className="row between">
                  <button className="btn link" onClick={stuck}>{t('just.stuck')}</button>
                  <button className="btn link" onClick={did}>{t('just.did')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="stack" style={{ justifyItems: 'center', gap: 8 }}>
                  <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: '3rem' }}>{fmtTimer(remaining)}</div>
                  <div style={{ width: '100%', height: 6, borderRadius: 6, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: 'var(--gold-2)', transition: 'width .25s linear' }} />
                  </div>
                </div>
                <button className="btn block" onClick={() => { setEndsAt(Date.now()); }}>{t('just.did')}</button>
              </>
            )}
          </>
        )}

        {phase === 'after' && step && (
          <>
            <div className="row nowrap">
              <Rafiq pose="laugh" size={64} />
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>{t('focus.timeUp')}</p>
            </div>
            <button className="btn gold lg block" onClick={did}>
              {idx + 1 < steps.length ? t('just.next', { n: Math.min(steps[idx + 1].minutes, challenge + 2) }) : t('just.did')}
            </button>
            <button className="btn ghost block" onClick={stopHere}>{t('just.stopHere')}</button>
          </>
        )}

        {phase === 'finished' && (
          <div className="stack lg" style={{ justifyItems: 'center', textAlign: 'center' }}>
            <Rafiq pose="cheer" size={120} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>{t('just.finishedAll')}</p>
            <button className="btn block" onClick={close}>{t('done')}</button>
          </div>
        )}

        {steps.length > 0 && phase !== 'ask' && phase !== 'finished' && (
          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>{t('just.allSteps')} ({idx + 1}/{steps.length})</summary>
            <ol className="small" style={{ paddingInlineStart: 20, marginTop: 8 }}>
              {steps.map((s, i) => <li key={s.id} style={{ opacity: i < idx ? 0.5 : 1, textDecoration: i < idx ? 'line-through' : 'none' }}>{s.title} · {s.minutes} {t('min')}</li>)}
            </ol>
          </details>
        )}
        {!savedId && phase !== 'ask' && what.trim() && <button className="btn link" onClick={saveTask}>{t('plan.new')}: “{what.slice(0, 40)}”</button>}
      </div>
    </Modal>
  );
}
