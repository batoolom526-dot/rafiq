import { useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { useT, useUI, withThinking } from '../lib/ui';
import { ask, askJSON, aiErrorKey, aiReady, langLine } from '../lib/ai';
import { earn, newCard, newTask, reviewCard } from '../lib/engine';
import { readFileText } from '../lib/files';
import { addDays, dayKey, uid } from '../lib/util';
import type { Notebook } from '../lib/types';
import { Field, MicButton, SpeakButton } from '../components/ui';
import { IBook, IChevron, IPlus, ITrash, IUpload, IWand } from '../components/Icons';

type NbTab = 'sources' | 'summary' | 'guide' | 'cards' | 'quiz' | 'ask' | 'explain';
const MAX_CTX = 60000;

const sourcesText = (nb: Notebook) =>
  nb.sources.map((s, i) => `[S${i + 1}] ${s.name}\n${s.text}`).join('\n\n').slice(0, MAX_CTX);

export function Study() {
  const t = useT();
  const notebooks = useApp((s) => s.data.notebooks);
  const mutate = useApp((s) => s.mutate);
  const spaces = useApp((s) => s.data.profile.spaces);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const nb = notebooks.find((n) => n.id === openId);

  if (nb) return <NotebookView nb={nb} onBack={() => setOpenId(null)} />;

  const create = () => {
    if (!name.trim()) return;
    const id = uid();
    mutate((d) => {
      d.notebooks.push({ id, title: name.trim(), space: spaces.includes('study') ? 'study' : spaces[0], sources: [], cards: [], chat: [], quizzes: [], weakTopics: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    setName('');
    setOpenId(id);
  };

  const today = dayKey();
  return (
    <div className="stack xl">
      <h1>{t('study.title')}</h1>
      <div className="card stack">
        <div className="row nowrap">
          <input id="nb-name" className="input grow" placeholder={t('study.namePh')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="btn" onClick={create} disabled={!name.trim()}><IPlus /> {t('study.new')}</button>
        </div>
        {!notebooks.length && <p className="muted small">{t('study.empty')}</p>}
      </div>
      <div className="stack">
        {notebooks.map((n) => {
          const due = n.cards.filter((c) => c.due <= today).length;
          return (
            <button key={n.id} className="task" style={{ textAlign: 'start', width: '100%', gridTemplateColumns: 'auto 1fr auto' }} onClick={() => setOpenId(n.id)}>
              <span className="icon-btn" aria-hidden="true"><IBook /></span>
              <span style={{ minWidth: 0 }}>
                <span className="t" style={{ display: 'block' }}>{n.title}</span>
                <span className="meta">
                  <span className="tag">{n.sources.length} {t('study.sources').toLowerCase()}</span>
                  <span className="tag">{n.cards.length} {t('study.cards').toLowerCase()}</span>
                  {due > 0 && <span className="tag gold">{t('study.due', { n: due })}</span>}
                </span>
              </span>
              <IChevron style={{ width: 18, height: 18, color: 'var(--muted)', transform: document.dir === 'rtl' ? 'scaleX(-1)' : undefined }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NotebookView({ nb, onBack }: { nb: Notebook; onBack: () => void }) {
  const t = useT();
  const mutate = useApp((s) => s.mutate);
  const [tab, setTab] = useState<NbTab>(nb.sources.length ? 'summary' : 'sources');
  const [confirmDel, setConfirmDel] = useState(false);
  const upd = (fn: (n: Notebook) => void) =>
    mutate((d) => {
      const x = d.notebooks.find((y) => y.id === nb.id);
      if (x) {
        fn(x);
        x.updatedAt = Date.now();
      }
    });
  const tabs: NbTab[] = ['sources', 'summary', 'guide', 'cards', 'quiz', 'ask', 'explain'];
  const labels: Record<NbTab, string> = { sources: t('study.sources'), summary: t('study.summary'), guide: t('study.guide'), cards: t('study.cards'), quiz: t('study.quiz'), ask: t('study.ask'), explain: t('study.explain') };

  return (
    <div className="stack xl">
      <div className="row between nowrap">
        <button className="btn sm ghost" onClick={onBack}>← {t('back')}</button>
        {confirmDel ? (
          <div className="row">
            <button className="btn sm danger" onClick={() => { mutate((d) => { d.notebooks = d.notebooks.filter((x) => x.id !== nb.id); }); onBack(); }}>{t('delete')}</button>
            <button className="btn sm ghost" onClick={() => setConfirmDel(false)}>{t('cancel')}</button>
          </div>
        ) : (
          <button className="icon-btn" aria-label={t('delete')} onClick={() => setConfirmDel(true)}><ITrash /></button>
        )}
      </div>
      <h1>{nb.title}</h1>
      <div className="tabs" role="tablist">
        {tabs.map((x) => <button key={x} role="tab" className="chip" aria-pressed={tab === x} aria-selected={tab === x} onClick={() => setTab(x)}>{labels[x]}</button>)}
      </div>
      {tab === 'sources' && <Sources nb={nb} upd={upd} />}
      {tab !== 'sources' && !nb.sources.length && tab !== 'cards' && <p className="card soft">{t('study.noSources')}</p>}
      {tab === 'summary' && nb.sources.length > 0 && <Generated nb={nb} upd={upd} field="summary" prompt={summaryPrompt} />}
      {tab === 'guide' && nb.sources.length > 0 && <Generated nb={nb} upd={upd} field="guide" prompt={guidePrompt} extra />}
      {tab === 'cards' && <Cards nb={nb} upd={upd} />}
      {tab === 'quiz' && nb.sources.length > 0 && <Quiz nb={nb} upd={upd} />}
      {tab === 'ask' && nb.sources.length > 0 && <Ask nb={nb} upd={upd} />}
      {tab === 'explain' && nb.sources.length > 0 && <Explain nb={nb} />}
    </div>
  );
}

type Upd = (fn: (n: Notebook) => void) => void;

function Sources({ nb, upd }: { nb: Notebook; upd: Upd }) {
  const t = useT();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const add = (n: string, body: string) => {
    if (!body.trim()) return;
    upd((x) => {
      x.sources.push({ id: uid(), name: n.trim() || `Source ${x.sources.length + 1}`, text: body.trim().slice(0, 400000), addedAt: Date.now() });
    });
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr('');
    setBusy(true);
    try {
      const body = await readFileText(f);
      if (!body) throw new Error('empty');
      add(f.name.replace(/\.[^.]+$/, ''), body);
    } catch {
      setErr(t('study.pdfFail'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="stack lg">
      {nb.sources.map((s) => (
        <div key={s.id} className="card row nowrap">
          <div className="grow" style={{ minWidth: 0 }}>
            <b style={{ overflowWrap: 'anywhere' }}>{s.name}</b>
            <p className="tiny muted">{t('study.chars', { n: s.text.length.toLocaleString() })}</p>
          </div>
          <SpeakButton text={s.text.slice(0, 6000)} />
          <button className="icon-btn" aria-label={t('delete')} onClick={() => upd((x) => { x.sources = x.sources.filter((y) => y.id !== s.id); })}><ITrash /></button>
        </div>
      ))}
      <div className="card stack">
        <h3>{t('study.addSource')}</h3>
        <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}><IUpload /> {busy ? t('thinking') : t('study.upload')}</button>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
        <hr className="divider" />
        <Field label={t('study.sourceName')}><input id="src-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <textarea id="src-text" className="textarea" style={{ minHeight: 140 }} placeholder={t('study.pastePh')} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" onClick={() => { add(name, text); setText(''); setName(''); }} disabled={!text.trim()}>{t('study.paste')}</button>
      </div>
    </div>
  );
}

const summaryPrompt = (nb: Notebook) => `Summarize these study sources for a university student with ADHD. Use short sections with clear headings, plain language, and bullet points. Bold nothing; use plain text. Cite sources like [S1]. Start with a 2-sentence "big picture". ${langLine()}

SOURCES:
${sourcesText(nb)}`;

const guidePrompt = (nb: Notebook) => `Create an ADHD-friendly study guide from these sources: 1) the 5-8 key concepts, each explained in one or two simple sentences, 2) likely exam questions, 3) a suggested order to study in 25-minute chunks. Plain text, cite [S1] etc. ${langLine()}

SOURCES:
${sourcesText(nb)}`;

function Generated({ nb, upd, field, prompt, extra }: { nb: Notebook; upd: Upd; field: 'summary' | 'guide'; prompt: (nb: Notebook) => string; extra?: boolean }) {
  const t = useT();
  const toast = useUI((s) => s.toast);
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const value = busy ? live : nb[field] || '';
  const run = async () => {
    setErr('');
    setBusy(true);
    setLive('');
    ctl.current = new AbortController();
    try {
      const text = await withThinking(() => ask(prompt(nb), { onText: setLive, signal: ctl.current!.signal }));
      upd((x) => {
        x[field] = text;
      });
    } catch (e) {
      if ((e as any)?.code !== 'cancelled') setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  const makeSessions = async () => {
    setBusy(true);
    try {
      const res = await withThinking(() => askJSON<{ sessions: { title: string; minutes: number }[] }>(
        `Split the material in these sources into 4-10 focused study sessions of 15-30 minutes each, in a sensible order. Titles short, in the sources' language.
SOURCES:
${sourcesText(nb).slice(0, 30000)}
Reply with only JSON: {"sessions":[{"title":"...","minutes":25}]}`, { quick: true }));
      const ss = (res?.sessions || []).slice(0, 12);
      useApp.getState().mutate((d) => {
        ss.forEach((s, i) => d.tasks.push(newTask({ title: `${nb.title}: ${s.title}`, space: nb.space, estimateMin: Math.max(10, Math.min(60, Number(s.minutes) || 25)), scheduledFor: addDays(dayKey(), Math.floor(i / 2)), importance: 2 })));
      });
      toast(t('study.sessionsMade', { n: ss.length }));
    } catch (e) {
      setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  if (!aiReady()) return <p className="card soft">{t('aiOff')}</p>;
  return (
    <div className="stack lg">
      <div className="row">
        {busy ? (
          <button className="btn ghost" onClick={() => ctl.current?.abort()}>{t('stop')}</button>
        ) : (
          <button className="btn" onClick={run}><IWand /> {value ? t('study.regenerate') : t('study.generate')}</button>
        )}
        {value && !busy && <SpeakButton text={value} />}
        {extra && !busy && <button className="btn ghost" onClick={makeSessions}>{t('study.sessions')}</button>}
      </div>
      {busy && !live && <p className="muted small">{t('thinking')}</p>}
      {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      {value && <div className="prose out">{value}</div>}
    </div>
  );
}

function Cards({ nb, upd }: { nb: Notebook; upd: Upd }) {
  const t = useT();
  const toast = useUI((s) => s.toast);
  const today = dayKey();
  const due = nb.cards.filter((c) => c.due <= today);
  const [reviewing, setReviewing] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [reviewed, setReviewed] = useState(0);
  const card = due[0];

  const generate = async () => {
    setErr('');
    setBusy(true);
    try {
      const res = await withThinking(() => askJSON<{ cards: { q: string; a: string }[] }>(
        `Create 12 high-quality flashcards from these sources for active recall. Questions short and specific; answers 1-2 sentences. Same language as the sources.
SOURCES:
${sourcesText(nb).slice(0, 40000)}
Reply with only JSON: {"cards":[{"q":"...","a":"..."}]}`));
      const cs = (res?.cards || []).filter((c) => c.q && c.a).slice(0, 30);
      upd((x) => {
        x.cards.push(...cs.map((c) => newCard(String(c.q), String(c.a))));
      });
    } catch (e) {
      setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const grade = (g: 0 | 1 | 2 | 3) => {
    if (!card) return;
    upd((x) => {
      const i = x.cards.findIndex((c) => c.id === card.id);
      if (i >= 0) x.cards[i] = reviewCard(x.cards[i], g);
    });
    setShow(false);
    const n = reviewed + 1;
    setReviewed(n);
    if (n === 5) {
      const got = earn(4, 'spark.review');
      if (got) toast(t('toast.done', { n: got }));
    }
  };

  if (reviewing && card) {
    return (
      <div className="stack lg">
        <p className="small muted">{t('study.due', { n: due.length })}</p>
        <div className="flash">
          <div>
            {card.front}
            {show && <div className="back">{card.back}</div>}
          </div>
        </div>
        {!show ? (
          <button className="btn block lg" onClick={() => setShow(true)}>{t('study.show')}</button>
        ) : (
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <button className="btn ghost" onClick={() => grade(0)}>{t('study.again')}</button>
            <button className="btn ghost" onClick={() => grade(1)}>{t('study.hard')}</button>
            <button className="btn" onClick={() => grade(2)}>{t('study.good')}</button>
            <button className="btn gold" onClick={() => grade(3)}>{t('study.easy')}</button>
          </div>
        )}
        <button className="btn link" onClick={() => setReviewing(false)}>{t('back')}</button>
      </div>
    );
  }

  return (
    <div className="stack lg">
      <div className="card row between">
        <div>
          <h3>{due.length ? t('study.due', { n: due.length }) : t('study.noDue')}</h3>
          <p className="small muted">{nb.cards.length} {t('study.cards').toLowerCase()}</p>
        </div>
        <button className="btn gold" disabled={!due.length} onClick={() => { setReviewing(true); setShow(false); }}>{t('study.review')}</button>
      </div>
      {aiReady() && nb.sources.length > 0 && (
        <button className="btn ghost" onClick={generate} disabled={busy}><IWand /> {busy ? t('thinking') : t('study.makeCards')}</button>
      )}
      {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      <div className="card stack">
        <h3>{t('study.addCard')}</h3>
        <input id="card-front" className="input" placeholder={t('study.cardFront')} value={front} onChange={(e) => setFront(e.target.value)} />
        <textarea id="card-back" className="textarea" style={{ minHeight: 70 }} placeholder={t('study.cardBack')} value={back} onChange={(e) => setBack(e.target.value)} />
        <button className="btn" disabled={!front.trim() || !back.trim()} onClick={() => { upd((x) => { x.cards.push(newCard(front.trim(), back.trim())); }); setFront(''); setBack(''); }}>{t('add')}</button>
      </div>
      {nb.cards.length > 0 && (
        <details>
          <summary className="small muted" style={{ cursor: 'pointer' }}>{t('study.cards')} ({nb.cards.length})</summary>
          <div className="stack" style={{ marginTop: 10, gap: 6 }}>
            {nb.cards.map((c) => (
              <div key={c.id} className="row nowrap card" style={{ padding: 10 }}>
                <div className="grow small" style={{ minWidth: 0 }}><b>{c.front}</b><br /><span className="muted">{c.back}</span></div>
                <button className="icon-btn" aria-label={t('delete')} onClick={() => upd((x) => { x.cards = x.cards.filter((y) => y.id !== c.id); })}><ITrash /></button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

interface Q { q: string; options: string[]; answer: number; topic: string; why: string }

function Quiz({ nb, upd }: { nb: Notebook; upd: Upd }) {
  const t = useT();
  const toast = useUI((s) => s.toast);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [finished, setFinished] = useState(false);

  if (!aiReady()) return <p className="card soft">{t('aiOff')}</p>;

  const start = async () => {
    setErr('');
    setBusy(true);
    try {
      const weak = nb.weakTopics.slice(-5).join(', ');
      const res = await withThinking(() => askJSON<{ questions: Q[] }>(
        `Write 5 multiple-choice questions (4 options each) testing understanding of these sources, not trivia. ${weak ? 'Include at least 2 on these weak topics: ' + weak + '.' : ''} Same language as the sources. "answer" is the 0-based index of the correct option; "topic" is a 2-4 word topic label; "why" explains the answer in one sentence.
SOURCES:
${sourcesText(nb).slice(0, 40000)}
Reply with only JSON: {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"topic":"...","why":"..."}]}`));
      const list = (res?.questions || []).filter((q) => q.q && Array.isArray(q.options) && q.options.length >= 2).slice(0, 5);
      if (!list.length) throw new Error('empty');
      setQs(list);
      setI(0);
      setPicked(null);
      setWrong([]);
      setScore(0);
      setFinished(false);
    } catch (e) {
      setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const choose = (k: number) => {
    if (picked !== null || !qs) return;
    setPicked(k);
    if (k === Number(qs[i].answer)) setScore((s) => s + 1);
    else setWrong((w) => [...w, qs[i].topic]);
  };

  const next = () => {
    if (!qs) return;
    if (i + 1 < qs.length) {
      setI(i + 1);
      setPicked(null);
      return;
    }
    setFinished(true);
    const weak = Array.from(new Set(wrong));
    upd((x) => {
      x.quizzes.push({ date: dayKey(), score, total: qs.length, weak });
      x.weakTopics = Array.from(new Set([...x.weakTopics, ...weak])).slice(-12);
    });
    if (weak.length) {
      useApp.getState().mutate((d) => {
        weak.forEach((w) => d.tasks.push(newTask({ title: `↻ ${nb.title}: ${w}`, space: nb.space, estimateMin: 15, scheduledFor: addDays(dayKey(), 1), importance: 2, difficulty: 1 })));
      });
      toast(t('study.weakAdded'));
    }
    const got = earn(4, 'spark.review');
    if (got) toast(t('toast.done', { n: got }));
  };

  if (!qs || finished) {
    return (
      <div className="stack lg">
        {finished && qs && (
          <div className="card stack">
            <h2>{t('study.quizScore', { s: score, t: qs.length })}</h2>
            {wrong.length > 0 && <p className="small muted">{t('study.weak')}: {Array.from(new Set(wrong)).join(' · ')}</p>}
          </div>
        )}
        {nb.quizzes.length > 0 && !finished && <p className="small muted">{nb.quizzes.slice(-5).map((q) => `${q.score}/${q.total}`).join(' · ')}</p>}
        <button className="btn gold lg" onClick={start} disabled={busy}>{busy ? t('thinking') : t('study.quizStart')}</button>
        {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      </div>
    );
  }

  const q = qs[i];
  return (
    <div className="stack lg">
      <p className="small muted num">{i + 1} / {qs.length}</p>
      <h2 style={{ lineHeight: 1.4 }}>{q.q}</h2>
      <div className="stack">
        {q.options.map((o, k) => (
          <button key={k} className={`opt ${picked !== null && k === Number(q.answer) ? 'right' : picked === k ? 'wrong' : ''}`} onClick={() => choose(k)} disabled={picked !== null}>{o}</button>
        ))}
      </div>
      {picked !== null && (
        <>
          <p className="card soft small">{q.why}</p>
          <button className="btn block" onClick={next}>{t('next')}</button>
        </>
      )}
    </div>
  );
}

function Ask({ nb, upd }: { nb: Notebook; upd: Upd }) {
  const t = useT();
  const [msg, setMsg] = useState('');
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!aiReady()) return <p className="card soft">{t('aiOff')}</p>;
  const send = async () => {
    const q = msg.trim();
    if (!q) return;
    setMsg('');
    setErr('');
    upd((x) => {
      x.chat.push({ role: 'user', content: q });
    });
    setBusy(true);
    setLive('');
    const history = nb.chat.slice(-8);
    const rules = `You are a patient tutor. Answer ONLY from these sources; if the answer isn't there, say so. Keep answers short and clear, cite like [S1]. ${langLine()}
SOURCES:
${sourcesText(nb).slice(0, 45000)}`;
    try {
      const text = await withThinking(() => ask(q, { history: [{ role: 'user', content: rules }, { role: 'assistant', content: 'Understood.' }, ...history], onText: setLive }));
      upd((x) => {
        x.chat.push({ role: 'assistant', content: text });
        if (x.chat.length > 40) x.chat.splice(0, x.chat.length - 40);
      });
    } catch (e) {
      setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
      setLive('');
    }
  };
  return (
    <div className="stack lg">
      <div className="stack" style={{ display: 'grid' }}>
        {nb.chat.map((c, i) => <div key={i} className={`bubble ${c.role}`}>{c.content}</div>)}
        {busy && <div className="bubble assistant">{live || t('thinking')}</div>}
      </div>
      {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      <textarea id="ask-q" className="textarea" style={{ minHeight: 70 }} placeholder={t('study.askPh')} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <div className="row between">
        <MicButton onText={(s) => setMsg((x) => (x ? x + ' ' : '') + s)} />
        <div className="row">
          {nb.chat.length > 0 && <button className="btn link" onClick={() => upd((x) => { x.chat = []; })}>{t('delete')}</button>}
          <button className="btn" onClick={send} disabled={busy || !msg.trim()}>{t('study.ask')}</button>
        </div>
      </div>
    </div>
  );
}

function Explain({ nb }: { nb: Notebook }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!aiReady()) return <p className="card soft">{t('aiOff')}</p>;
  const go = async (simpler = false) => {
    if (!q.trim()) return;
    setErr('');
    setBusy(true);
    setOut('');
    try {
      await withThinking(() => ask(
        `Explain "${q}" ${simpler ? 'even more simply, like to a 12-year-old, with an everyday analogy' : 'in simple language with one concrete example and one everyday analogy'}. Use the sources where relevant (cite [S1]). Max 180 words. ${langLine()}
SOURCES:
${sourcesText(nb).slice(0, 30000)}`, { onText: setOut }));
    } catch (e) {
      setErr(t(aiErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack lg">
      <div className="row nowrap">
        <input id="explain-q" className="input grow" placeholder={t('study.explainPh')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button className="btn" onClick={() => go()} disabled={busy || !q.trim()}>{t('study.explain')}</button>
      </div>
      {busy && !out && <p className="muted small">{t('thinking')}</p>}
      {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      {out && (
        <>
          <div className="prose out">{out}</div>
          <div className="row">
            <SpeakButton text={out} />
            <button className="btn sm ghost" onClick={() => go(true)} disabled={busy}>{t('study.explain')} ↓</button>
          </div>
        </>
      )}
    </div>
  );
}
