import { useState } from 'react';
import { Modal, Field, Seg } from './ui';
import { useApp } from '../lib/store';
import { useT, useUI, withThinking } from '../lib/ui';
import { newTask, realisticMin, timeMirror, templateSteps } from '../lib/engine';
import { upsertTask, deleteTask, aiSteps } from '../lib/actions';
import { aiErrorKey, aiReady } from '../lib/ai';
import type { SpaceId, Task, TaskKind } from '../lib/types';
import { uid } from '../lib/util';
import { IPlus, ITrash, IWand, IX } from './Icons';

export function TaskEditor({ taskId, preset }: { taskId?: string; preset?: Partial<Task> }) {
  const t = useT();
  const close = useUI((s) => s.close);
  const toast = useUI((s) => s.toast);
  const data = useApp((s) => s.data);
  const existing = taskId ? data.tasks.find((x) => x.id === taskId) : undefined;
  const [task, setTask] = useState<Task>(() => existing ?? newTask({ title: '', space: data.profile.spaces[0] || 'study', ...(preset || {}) }));
  const [stepText, setStepText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (p: Partial<Task>) => setTask((x) => ({ ...x, ...p }));
  const mirror = timeMirror(data, task.space);

  const save = () => {
    if (!task.title.trim()) return;
    upsertTask({ ...task, title: task.title.trim() });
    toast(t('toast.saved'));
    close();
  };

  const breakdown = async () => {
    if (!task.title.trim()) return;
    setErr('');
    if (!aiReady()) {
      set({ steps: templateSteps(task.title, data.profile.lang) });
      return;
    }
    setBusy(true);
    try {
      const steps = await withThinking(() => aiSteps(task.title, task.notes));
      set({ steps });
    } catch (e) {
      setErr(t(aiErrorKey(e)));
      set({ steps: templateSteps(task.title, data.profile.lang) });
    } finally {
      setBusy(false);
    }
  };

  const addStep = () => {
    if (!stepText.trim()) return;
    set({ steps: [...task.steps, { id: uid(), title: stepText.trim(), minutes: 10, done: false }] });
    setStepText('');
  };

  return (
    <Modal title={existing ? t('edit') : t('plan.new')} onClose={close}>
      <div className="stack lg">
        <Field label={t('task.title')}>
          <input id="task-title" className="input" autoFocus value={task.title} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <div className="grid2">
          <Field label={t('task.space')}>
            <select id="task-space" className="select" value={task.space} onChange={(e) => set({ space: e.target.value as SpaceId })}>
              {(['study', 'work', 'health', 'home', 'money', 'growth'] as SpaceId[]).map((s) => <option key={s} value={s}>{t('space.' + s)}</option>)}
            </select>
          </Field>
          <Field label={t('task.kind')}>
            <select id="task-kind" className="select" value={task.kind} onChange={(e) => set({ kind: e.target.value as TaskKind })}>
              {(['task', 'assignment', 'exam', 'habit'] as TaskKind[]).map((k) => <option key={k} value={k}>{t('kind.' + k)}</option>)}
            </select>
          </Field>
          <Field label={t('task.due')}>
            <input id="task-due" type="date" className="input" value={task.due || ''} onChange={(e) => set({ due: e.target.value || undefined })} />
          </Field>
          <Field label={t('task.estimate')}>
            <input id="task-est" type="number" min={5} step={5} className="input" value={task.estimateMin} onChange={(e) => set({ estimateMin: Math.max(1, Number(e.target.value) || 0) })} />
          </Field>
        </div>
        {mirror && mirror !== 1 && task.estimateMin > 0 && <p className="small muted">⏱ {t('task.mirror', { n: realisticMin(data, task) })}</p>}
        <div className="grid2">
          <Field label={t('task.importance')}>
            <Seg value={String(task.importance)} onChange={(v) => set({ importance: Number(v) as 1 | 2 | 3 })} options={[{ v: '1', l: t('task.low') }, { v: '2', l: t('task.mid') }, { v: '3', l: t('task.high') }]} />
          </Field>
          <Field label={t('task.difficulty')}>
            <Seg value={String(task.difficulty)} onChange={(v) => set({ difficulty: Number(v) as 1 | 2 | 3 })} options={[{ v: '1', l: t('task.easy') }, { v: '2', l: t('task.mid') }, { v: '3', l: t('task.hard') }]} />
          </Field>
        </div>

        <div className="stack">
          <div className="section-title">
            <h3>{t('task.steps')}</h3>
            <button type="button" className="btn sm soft" onClick={breakdown} disabled={busy || !task.title.trim()}>
              <IWand /> {busy ? t('thinking') : t('task.ai')}
            </button>
          </div>
          {err && <p className="small muted">{err}</p>}
          {task.steps.map((s, i) => (
            <div key={s.id} className="row nowrap">
              <input className="input grow" value={s.title} aria-label={`${t('task.steps')} ${i + 1}`} onChange={(e) => set({ steps: task.steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })} />
              <input className="input num" style={{ width: 70 }} type="number" min={1} value={s.minutes} aria-label={t('min')} onChange={(e) => set({ steps: task.steps.map((x) => (x.id === s.id ? { ...x, minutes: Math.max(1, Number(e.target.value) || 1) } : x)) })} />
              <button type="button" className="icon-btn" aria-label={t('delete')} onClick={() => set({ steps: task.steps.filter((x) => x.id !== s.id) })}><IX /></button>
            </div>
          ))}
          <div className="row nowrap">
            <input className="input grow" placeholder={t('task.stepPh')} value={stepText} onChange={(e) => setStepText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())} />
            <button type="button" className="icon-btn" aria-label={t('task.addStep')} onClick={addStep}><IPlus /></button>
          </div>
        </div>

        <Field label={t('task.notes')}>
          <textarea id="task-notes" className="textarea" value={task.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        <div className="row between">
          {existing ? (
            confirmDel ? (
              <div className="row">
                <span className="small">{t('confirmDelete')}</span>
                <button className="btn sm danger" onClick={() => { deleteTask(existing.id); close(); }}>{t('delete')}</button>
                <button className="btn sm ghost" onClick={() => setConfirmDel(false)}>{t('cancel')}</button>
              </div>
            ) : (
              <button className="btn sm danger" onClick={() => setConfirmDel(true)}><ITrash /> {t('delete')}</button>
            )
          ) : <span />}
          <button className="btn" onClick={save} disabled={!task.title.trim()}>{t('save')}</button>
        </div>
      </div>
    </Modal>
  );
}
