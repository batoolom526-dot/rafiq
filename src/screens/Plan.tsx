import { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { useT, useUI, useEnergy } from '../lib/ui';
import { score } from '../lib/engine';
import { completeTask, toggleStep, postpone } from '../lib/actions';
import { dayKey, daysUntil } from '../lib/util';
import type { SpaceId, Task } from '../lib/types';
import { ICal, ICheck, IPlay, IPlus, IWand } from '../components/Icons';
import { Seg } from '../components/ui';

type View = 'today' | 'upcoming' | 'all' | 'done';

export function Plan() {
  const t = useT();
  const data = useApp((s) => s.data);
  const open = useUI((s) => s.open);
  const energy = useEnergy();
  const [view, setView] = useState<View>('today');
  const [space, setSpace] = useState<SpaceId | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const today = dayKey();

  const list = useMemo(() => {
    let xs = data.tasks.filter((x) => space === 'all' || x.space === space);
    if (view === 'done') return xs.filter((x) => x.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 100);
    xs = xs.filter((x) => x.status === 'todo');
    if (view === 'today') xs = xs.filter((x) => (!x.scheduledFor || x.scheduledFor <= today) && (!x.due || daysUntil(x.due) <= 7 || !x.scheduledFor));
    if (view === 'upcoming') xs = xs.filter((x) => x.scheduledFor && x.scheduledFor > today);
    return xs.sort((a, b) =>
      view === 'upcoming' ? (a.scheduledFor || '').localeCompare(b.scheduledFor || '') : score(b, energy) - score(a, energy),
    );
  }, [data.tasks, view, space, energy]);

  const dueLabel = (x: Task) => {
    if (!x.due) return null;
    const n = daysUntil(x.due);
    return n < 0 ? t('why.late').split(',')[0] : n === 0 ? t('why.dueToday') : n === 1 ? t('why.dueTomorrow') : t('why.dueIn', { n });
  };

  const fmtDay = (d: string) => new Date(d + 'T12:00').toLocaleDateString(data.profile.lang === 'ar' ? 'ar' : 'en', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="stack xl">
      <div className="row between">
        <h1>{t('plan.title')}</h1>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm ghost" onClick={() => open({ kind: 'exam' })}><ICal /> {t('plan.exam')}</button>
          <button className="btn sm ghost" onClick={() => open({ kind: 'dump' })}><IWand /> {t('today.brainDump')}</button>
          <button className="btn sm" onClick={() => open({ kind: 'task' })}><IPlus /> {t('plan.new')}</button>
        </div>
      </div>

      <div className="stack">
        <Seg value={view} onChange={setView} options={[{ v: 'today', l: t('plan.todayTab') }, { v: 'upcoming', l: t('plan.upcoming') }, { v: 'all', l: t('plan.all') }, { v: 'done', l: t('plan.doneTab') }]} />
        <div className="tabs">
          <button className="chip" aria-pressed={space === 'all'} onClick={() => setSpace('all')}>{t('plan.all')}</button>
          {data.profile.spaces.map((s) => <button key={s} className="chip" aria-pressed={space === s} onClick={() => setSpace(s)}>{t('space.' + s)}</button>)}
        </div>
      </div>

      <section>
        {list.length === 0 && <p className="muted card soft">{t('plan.empty')}</p>}
        {list.map((x) => {
          const doneSteps = x.steps.filter((s) => s.done).length;
          const isOpen = expanded === x.id;
          return (
            <article key={x.id} className={`task ${x.status === 'done' ? 'done' : ''}`}>
              <button className={`check ${x.status === 'done' ? 'on' : ''}`} aria-label={x.status === 'done' ? t('task.reopen') : t('task.complete')} onClick={() => completeTask(x.id)}><ICheck /></button>
              <div style={{ minWidth: 0 }}>
                <div className="t" role="button" tabIndex={0} onClick={() => setExpanded(isOpen ? null : x.id)} onKeyDown={(e) => e.key === 'Enter' && setExpanded(isOpen ? null : x.id)}>{x.title}</div>
                <div className="meta">
                  <span className="tag">{t('space.' + x.space)}</span>
                  {x.kind !== 'task' && <span className="tag gold">{t('kind.' + x.kind)}</span>}
                  {dueLabel(x) && <span className="tag">{dueLabel(x)}</span>}
                  {view === 'upcoming' && x.scheduledFor && <span className="tag">{fmtDay(x.scheduledFor)}</span>}
                  {x.steps.length > 0 && <span className="tag num">{doneSteps}/{x.steps.length}</span>}
                  {x.postponed >= 2 && <span className="tag">↻ {x.postponed}</span>}
                </div>
                {isOpen && (
                  <div className="stack" style={{ marginTop: 10, gap: 2 }}>
                    {x.steps.map((s) => (
                      <div key={s.id} className={`step-row ${s.done ? 'done' : ''}`}>
                        <button className={`check ${s.done ? 'on' : ''}`} aria-label={s.title} onClick={() => toggleStep(x.id, s.id)}><ICheck /></button>
                        <span className="grow small">{s.title}</span>
                        <span className="tiny muted num">{s.minutes} {t('min')}</span>
                      </div>
                    ))}
                    {x.notes && <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{x.notes}</p>}
                    {x.reentry && <p className="small muted">↩ {x.reentry}</p>}
                    <div className="row" style={{ marginTop: 8 }}>
                      {x.status === 'todo' && <button className="btn sm gold" onClick={() => open({ kind: 'just', taskId: x.id })}><IPlay /> {t('just.title')}</button>}
                      <button className="btn sm ghost" onClick={() => open({ kind: 'task', taskId: x.id })}>{t('edit')}</button>
                      {x.status === 'todo' && <button className="btn sm ghost" onClick={() => postpone(x.id)}>{t('today.notNow')}</button>}
                    </div>
                  </div>
                )}
              </div>
              {x.status === 'todo' && !isOpen && (
                <button className="icon-btn" aria-label={t('just.title')} onClick={() => open({ kind: 'just', taskId: x.id })}><IPlay /></button>
              )}
              {(x.status === 'done' || isOpen) && <span />}
            </article>
          );
        })}
      </section>
    </div>
  );
}
