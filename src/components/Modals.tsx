import { useState } from 'react';
import { Modal, Field, MicButton } from './ui';
import { useApp } from '../lib/store';
import { useT, useUI, withThinking } from '../lib/ui';
import { addDumpItems, sortDump, resolvePostpone, type DumpItem, type PostponeReason } from '../lib/actions';
import { examPlan, learnDialect, remember } from '../lib/engine';
import { addDays, dayKey } from '../lib/util';
import type { SpaceId } from '../lib/types';
import { translate } from '../lib/i18n';

export function BrainDump() {
  const t = useT();
  const close = useUI((s) => s.close);
  const toast = useUI((s) => s.toast);
  const spaces = useApp((s) => s.data.profile.spaces);
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [items, setItems] = useState<DumpItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const sort = async () => {
    if (!text.trim()) return;
    setBusy(true);
    learnDialect(text);
    remember(text.slice(0, 180), 'dump');
    try {
      setItems(await withThinking(() => sortDump(text)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('dump.title')} onClose={close}>
      {!items ? (
        <div className="stack lg">
          <p className="muted small">{t('dump.hint')}</p>
          <textarea id="dump-text" className="textarea" style={{ minHeight: 160 }} placeholder={t('dump.ph')} value={text + (partial ? ' ' + partial : '')} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="row between">
            <MicButton onText={(s) => { setText((x) => (x ? x + ' ' : '') + s); setPartial(''); }} onPartial={setPartial} />
            <button className="btn" onClick={sort} disabled={busy || !text.trim()}>{busy ? t('thinking') : t('dump.sort')}</button>
          </div>
        </div>
      ) : (
        <div className="stack lg">
          <p className="muted small">{t('dump.found', { n: items.length })}</p>
          <div className="stack">
            {items.map((it, i) => (
              <div key={i} className="row nowrap">
                <input type="checkbox" checked={it.keep} aria-label={it.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} style={{ width: 20, height: 20, accentColor: 'var(--gold-2)' }} />
                <input className="input grow" value={it.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <select className="select" style={{ width: 'auto' }} value={it.space} aria-label={t('task.space')} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, space: e.target.value as SpaceId } : x)))}>
                  {spaces.map((s) => <option key={s} value={s}>{t('space.' + s)}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="row between">
            <button className="btn ghost" onClick={() => setItems(null)}>{t('back')}</button>
            <button className="btn" onClick={() => { const n = addDumpItems(items); if (n) toast(t('growth.added')); close(); }} disabled={!items.some((i) => i.keep)}>{t('dump.addAll')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ExamPlanner() {
  const t = useT();
  const close = useUI((s) => s.close);
  const toast = useUI((s) => s.toast);
  const lang = useApp((s) => s.data.profile.lang);
  const [name, setName] = useState('');
  const [date, setDate] = useState(addDays(dayKey(), 7));
  const [topics, setTopics] = useState('');
  const [daily, setDaily] = useState(90);
  const [err, setErr] = useState('');

  const make = () => {
    const list = topics.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || !list.length) return;
    const tasks = examPlan(name.trim(), date, list, daily, lang, (k, v) => translate(lang, k, v));
    if (!tasks.length) {
      setErr(t('exam.tooLate'));
      return;
    }
    useApp.getState().mutate((d) => {
      d.tasks.push(...tasks);
    });
    toast(t('exam.made', { n: tasks.length - 1 }));
    close();
  };

  return (
    <Modal title={t('exam.title')} onClose={close}>
      <div className="stack lg">
        <Field label={t('exam.name')}><input id="exam-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="grid2">
          <Field label={t('exam.date')}><input id="exam-date" type="date" className="input" value={date} min={addDays(dayKey(), 1)} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t('exam.daily')}><input id="exam-daily" type="number" min={15} step={15} className="input" value={daily} onChange={(e) => setDaily(Math.max(15, Number(e.target.value) || 15))} /></Field>
        </div>
        <Field label={t('exam.topics')}><textarea id="exam-topics" className="textarea" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={'Chapter 1\nChapter 2\nChapter 3'} /></Field>
        {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
        <button className="btn block" onClick={make} disabled={!name.trim() || !topics.trim()}>{t('exam.make')}</button>
      </div>
    </Modal>
  );
}

export function PostponeDetective({ taskId }: { taskId: string }) {
  const t = useT();
  const close = useUI((s) => s.close);
  const task = useApp((s) => s.data.tasks.find((x) => x.id === taskId));
  const [result, setResult] = useState<PostponeReason | null>(null);
  const [busy, setBusy] = useState(false);
  if (!task) return null;
  const reasons: PostponeReason[] = ['unclear', 'big', 'boring', 'anxious', 'tired'];
  const pick = async (r: PostponeReason) => {
    setBusy(true);
    await withThinking(() => resolvePostpone(taskId, r));
    setBusy(false);
    setResult(r);
  };
  return (
    <Modal title={t('pp.title')} onClose={close}>
      <div className="stack lg">
        <p className="card soft"><b>{task.title}</b></p>
        {!result ? (
          <>
            <p className="muted">{t('pp.q')}</p>
            <div className="stack">
              {reasons.map((r) => (
                <button key={r} className="btn ghost block" style={{ justifyContent: 'flex-start' }} disabled={busy} onClick={() => pick(r)}>{t('pp.' + r)}</button>
              ))}
            </div>
            {busy && <p className="muted small">{t('thinking')}</p>}
          </>
        ) : (
          <>
            <p>{t('pp.' + result + 'Do')}</p>
            {task.steps[0] && <p className="card soft small">→ {task.steps.find((s) => !s.done)?.title}</p>}
            <button className="btn block" onClick={close}>{t('done')}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
