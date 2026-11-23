import { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { useT, useUI, withThinking } from '../lib/ui';
import { activeDays, earn, momentum, newTask, remember, SHOP, timeMirror, learnDialect } from '../lib/engine';
import { makeReport, monthStats, reportPrompt } from '../lib/report';
import { ask, aiErrorKey, aiReady } from '../lib/ai';
import { addDays, dayKey, monthKey, sum, uid } from '../lib/util';
import type { SpaceId } from '../lib/types';
import { Field, Ring, Sparkline, SpeakButton } from '../components/ui';
import { IPlus, ISpark, ITrash } from '../components/Icons';

export function Growth() {
  const t = useT();
  const data = useApp((s) => s.data);
  const mutate = useApp((s) => s.mutate);
  const toast = useUI((s) => s.toast);
  const lang = data.profile.lang;
  const week = Date.now() - 7 * 86400000;
  const focusMin = Math.round(sum(data.sessions.filter((s) => s.start >= week).map((s) => s.actualMin)));
  const doneWeek = data.tasks.filter((x) => x.doneAt && x.doneAt >= week).length;
  const days = activeDays(data, 7);
  const mirror = timeMirror(data);
  const stats = useMemo(() => monthStats(data), [data.sessions, data.tasks]);
  const doneList = data.tasks.filter((x) => x.doneAt).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 12);

  return (
    <div className="stack xl">
      <h1>{t('growth.title')}</h1>

      <section className="stack">
        <h2>{t('growth.week')}</h2>
        <div className="stats3">
          <div className="stat"><b>{focusMin}</b><span>{t('growth.focusMin')}</span></div>
          <div className="stat"><b>{doneWeek}</b><span>{t('growth.done')}</span></div>
          <div className="stat"><b>{days}/7</b><span>{t('growth.days')}</span></div>
        </div>
        <div className="card row nowrap">
          <Ring value={momentum(data)} />
          <div className="stack grow" style={{ gap: 4 }}>
            <h3>{t('growth.mirror')}</h3>
            <p className="small muted">{mirror ? t('growth.mirrorBody', { x: mirror }) : t('growth.mirrorNone')}</p>
            {stats.bestHour !== null && <p className="small muted">{t('growth.bestHour', { h: `${stats.bestHour}:00` })}</p>}
          </div>
        </div>
      </section>

      <Reflection />

      <section className="stack">
        <h2>{t('growth.doneList')}</h2>
        {doneList.length ? (
          <div className="card stack" style={{ gap: 6 }}>
            {doneList.map((x) => (
              <div key={x.id} className="row nowrap small">
                <span style={{ color: 'var(--gold)' }}>✓</span>
                <span className="grow" style={{ overflowWrap: 'anywhere' }}>{x.title}</span>
                <span className="tiny muted">{new Date(x.doneAt!).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        ) : <p className="muted card soft small">{t('growth.doneEmpty')}</p>}
      </section>

      <Trackers />
      <Rewards />
      <Report />

      <p className="small muted card soft">{t('growth.roadmap')}</p>
    </div>
  );
}

function Reflection() {
  const t = useT();
  const mutate = useApp((s) => s.mutate);
  const today = useApp((s) => s.data.reflections.find((r) => r.date === dayKey()));
  const toast = useUI((s) => s.toast);
  const [text, setText] = useState('');
  if (today) return (
    <section className="card soft stack">
      <h3>{t('growth.reflect')}</h3>
      <p>“{today.text}”</p>
    </section>
  );
  const save = () => {
    if (!text.trim()) return;
    learnDialect(text);
    mutate((d) => {
      d.reflections.push({ id: uid(), date: dayKey(), text: text.trim(), win: text.trim() });
    });
    remember(text.trim(), 'reflection');
    const got = earn(3, 'spark.reflect');
    toast(got ? t('toast.done', { n: got }) : t('growth.saved'));
  };
  return (
    <section className="card stack">
      <h3>{t('growth.reflect')}</h3>
      <p className="small muted">{t('growth.reflectQ')}</p>
      <div className="row nowrap">
        <input id="reflect" className="input grow" placeholder={t('growth.reflectPh')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <button className="btn" onClick={save} disabled={!text.trim()}>{t('save')}</button>
      </div>
    </section>
  );
}

function Trackers() {
  const t = useT();
  const trackers = useApp((s) => s.data.trackers);
  const spaces = useApp((s) => s.data.profile.spaces);
  const mutate = useApp((s) => s.mutate);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [higher, setHigher] = useState(true);
  const [space, setSpace] = useState<SpaceId>(spaces[0] || 'study');
  const [vals, setVals] = useState<Record<string, string>>({});

  const create = () => {
    if (!name.trim()) return;
    mutate((d) => {
      d.trackers.push({ id: uid(), name: name.trim(), unit: unit.trim(), space, higherIsBetter: higher, entries: [] });
    });
    setName('');
    setUnit('');
    setAdding(false);
  };
  const log = (id: string) => {
    const v = Number(vals[id]);
    if (!Number.isFinite(v) || vals[id] === '' || vals[id] === undefined) return;
    mutate((d) => {
      d.trackers.find((x) => x.id === id)?.entries.push({ id: uid(), date: dayKey(), value: v, note: '' });
    });
    setVals({ ...vals, [id]: '' });
  };

  return (
    <section className="stack">
      <div className="section-title">
        <h2>{t('growth.trackers')}</h2>
        <button className="btn sm ghost" onClick={() => setAdding(!adding)}><IPlus /> {t('growth.newTracker')}</button>
      </div>
      {adding && (
        <div className="card stack">
          <Field label={t('growth.trackerName')}><input id="tr-name" className="input" placeholder={t('growth.trackerPh')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid2">
            <Field label={t('growth.unit')}><input id="tr-unit" className="input" placeholder="%, km, min" value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
            <Field label={t('task.space')}>
              <select id="tr-space" className="select" value={space} onChange={(e) => setSpace(e.target.value as SpaceId)}>
                {spaces.map((s) => <option key={s} value={s}>{t('space.' + s)}</option>)}
              </select>
            </Field>
          </div>
          <label className="toggle"><span>{t('growth.higher')}</span><input type="checkbox" className="switch" checked={higher} onChange={(e) => setHigher(e.target.checked)} /></label>
          <button className="btn" onClick={create} disabled={!name.trim()}>{t('save')}</button>
        </div>
      )}
      {trackers.map((tr) => {
        const values = tr.entries.map((e) => e.value);
        const last = values[values.length - 1];
        const first = values[0];
        const change = values.length >= 2 && first !== 0 ? Math.round(((last - first) / Math.abs(first)) * 100) : null;
        return (
          <div key={tr.id} className="card stack">
            <div className="row between nowrap">
              <div style={{ minWidth: 0 }}>
                <h3 style={{ overflowWrap: 'anywhere' }}>{tr.name}</h3>
                <p className="small muted num">
                  {last !== undefined ? `${last}${tr.unit ? ' ' + tr.unit : ''}` : t('growth.noEntries')}
                  {change !== null && ` · ${change > 0 ? '+' : ''}${change}%`}
                </p>
              </div>
              <button className="icon-btn" aria-label={t('delete')} onClick={() => mutate((d) => { d.trackers = d.trackers.filter((x) => x.id !== tr.id); })}><ITrash /></button>
            </div>
            <Sparkline values={values.slice(-20)} higherIsBetter={tr.higherIsBetter} />
            <div className="row nowrap">
              <input className="input grow num" type="number" inputMode="decimal" placeholder={t('growth.value')} aria-label={t('growth.value')} value={vals[tr.id] ?? ''} onChange={(e) => setVals({ ...vals, [tr.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && log(tr.id)} />
              <button className="btn" onClick={() => log(tr.id)}>{t('growth.log')}</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Rewards() {
  const t = useT();
  const rewards = useApp((s) => s.data.rewards);
  const lang = useApp((s) => s.data.profile.lang);
  const mutate = useApp((s) => s.mutate);
  const toast = useUI((s) => s.toast);
  const celebrate = useUI((s) => s.celebrate);
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(50);

  const spend = (amount: number, reason: string) =>
    mutate((d) => {
      d.rewards.sparks -= amount;
      d.rewards.ledger.push({ id: uid(), ts: Date.now(), amount: -amount, reason });
    });

  return (
    <section className="stack">
      <h2>{t('growth.rewards')}</h2>
      <div className="card row nowrap">
        <ISpark style={{ width: 30, height: 30, color: 'var(--gold)' }} />
        <div className="grow">
          <div className="spark-big">{rewards.sparks}</div>
          <p className="small muted">{t('growth.earn')}</p>
        </div>
      </div>

      <div className="stack">
        <h3>{t('growth.bank')}</h3>
        <p className="small muted">{t('growth.bankHint')}</p>
        {rewards.bank.map((r) => (
          <div key={r.id} className="card row nowrap" style={{ padding: 12 }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{ overflowWrap: 'anywhere' }}>{r.title}</b>
              <p className="tiny muted num">✦ {r.cost}{r.redeemed ? ` · ×${r.redeemed}` : ''}</p>
            </div>
            <button className="btn sm gold" disabled={rewards.sparks < r.cost} onClick={() => {
              spend(r.cost, `spark.redeem:${r.title}`);
              mutate((d) => { const x = d.rewards.bank.find((y) => y.id === r.id); if (x) x.redeemed++; });
              celebrate();
              toast(t('growth.redeemed'));
            }}>{rewards.sparks < r.cost ? t('growth.need', { n: r.cost - rewards.sparks }) : t('growth.redeem')}</button>
            <button className="icon-btn" aria-label={t('delete')} onClick={() => mutate((d) => { d.rewards.bank = d.rewards.bank.filter((y) => y.id !== r.id); })}><ITrash /></button>
          </div>
        ))}
        <div className="row nowrap">
          <input id="reward-title" className="input grow" placeholder={t('growth.rewardPh')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input id="reward-cost" className="input num" style={{ width: 84 }} type="number" min={5} step={5} aria-label={t('growth.cost')} value={cost} onChange={(e) => setCost(Math.max(5, Number(e.target.value) || 5))} />
          <button className="icon-btn" aria-label={t('add')} disabled={!title.trim()} onClick={() => { mutate((d) => { d.rewards.bank.push({ id: uid(), title: title.trim(), cost, redeemed: 0 }); }); setTitle(''); }}><IPlus /></button>
        </div>
      </div>

      <div className="stack">
        <h3>{t('growth.shop')}</h3>
        <div className="shop">
          {SHOP.map((it) => {
            const owned = rewards.owned.includes(it.id);
            return (
              <div key={it.id} className="item">
                <b className="small">{it.title[lang]}</b>
                <span className="tiny muted num">✦ {it.cost}</span>
                <button className="btn sm" disabled={owned || rewards.sparks < it.cost} onClick={() => {
                  spend(it.cost, `spark.buy:${it.title.en}`);
                  mutate((d) => { d.rewards.owned.push(it.id); });
                  celebrate();
                  toast(t('spark.buy', { t: it.title[lang] }));
                }}>{owned ? t('growth.own') : rewards.sparks < it.cost ? t('growth.need', { n: it.cost - rewards.sparks }) : t('growth.redeem')}</button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Report() {
  const t = useT();
  const data = useApp((s) => s.data);
  const mutate = useApp((s) => s.mutate);
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [live, setLive] = useState('');
  const current = data.reports.find((r) => r.month === monthKey());
  const older = data.reports.filter((r) => r.month !== monthKey()).slice(-3).reverse();

  const make = () => {
    const r = makeReport(data);
    mutate((d) => {
      d.reports = [...d.reports.filter((x) => x.month !== r.month), r];
      if (d.reports.length > 24) d.reports.splice(0, d.reports.length - 24);
    });
  };
  const letter = async () => {
    if (!current) return;
    setErr('');
    setBusy(true);
    try {
      const text = await withThinking(() => ask(reportPrompt(data, current), { onText: setLive }));
      mutate((d) => {
        const r = d.reports.find((x) => x.month === current.month);
        if (r) r.narrative = text;
      });
    } catch (e) {
      setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
      setLive('');
    }
  };
  const addPlan = () => {
    if (!current) return;
    const start = dayKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
    const base = dayKey() > addDays(start, -8) ? start : dayKey();
    mutate((d) => {
      current.areas.forEach((a, i) => d.tasks.push(newTask({ title: a.plan, notes: a.why, space: 'growth', kind: 'habit', estimateMin: 15, scheduledFor: addDays(base, i), importance: 2, difficulty: 1 })));
    });
    toast(t('growth.added'));
  };

  const R = (r: NonNullable<typeof current>) => (
    <div className="stack lg">
      <div className="stats3">
        <div className="stat"><b>{r.stats.focusMin}</b><span>{t('growth.focusMin')}</span></div>
        <div className="stat"><b>{r.stats.tasksDone}</b><span>{t('growth.done')}</span></div>
        <div className="stat"><b>{r.stats.activeDays}</b><span>{t('growth.days')}</span></div>
      </div>
      {r.narrative && (
        <div className="stack">
          <div className="prose out">{r.narrative}</div>
          <SpeakButton text={r.narrative} />
        </div>
      )}
      <h3>{t('growth.areas')}</h3>
      {r.areas.map((a, i) => (
        <div key={i} className="report-area">
          <b>{a.title}</b>
          <span className="small muted">{a.why}</span>
          <span className="small">→ {a.plan}</span>
        </div>
      ))}
    </div>
  );

  const monthName = (m: string) => new Date(m + '-15').toLocaleDateString(data.profile.lang === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' });

  return (
    <section className="stack">
      <h2>{t('growth.report')}</h2>
      <div className="card pad-lg stack lg">
        <div className="row between">
          <span className="eyebrow">{monthName(monthKey())}</span>
          <button className="btn sm ghost" onClick={make}>{current ? t('study.regenerate') : t('growth.reportMake')}</button>
        </div>
        {current ? R(current) : <p className="muted small">{t('growth.reportMake')}</p>}
        {busy && <div className="prose out">{live || t('thinking')}</div>}
        {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
        {current && (
          <div className="row">
            {aiReady() && <button className="btn sm" onClick={letter} disabled={busy}>{t('growth.reportAI')}</button>}
            <button className="btn sm gold" onClick={addPlan}>{t('growth.addPlan')}</button>
          </div>
        )}
      </div>
      {older.map((r) => (
        <details key={r.month} className="card">
          <summary style={{ cursor: 'pointer' }}><b>{monthName(r.month)}</b></summary>
          <div style={{ marginTop: 14 }}>{R(r)}</div>
        </details>
      ))}
    </section>
  );
}
