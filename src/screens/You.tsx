import { useEffect, useRef, useState } from 'react';
import { useApp, defaultData, hydrate, wipeLocal } from '../lib/store';
import { useT, useUI } from '../lib/ui';
import { activeProvider, detectClaude } from '../lib/ai';
import { CHARACTER_PROMPT, SAMPLE_SHEET, POSE_ORDER, storeSheet, clearLocalSheet } from '../lib/character';
import { saveFile, } from '../lib/files';
import { speak } from '../lib/voice';
import { syncState, onSyncState, wipeRemote } from '../lib/sync';
import { uid, dayKey } from '../lib/util';
import type { Anchor, Palette, SpaceId } from '../lib/types';
import { Field, Seg } from '../components/ui';
import { usePoses } from '../components/Rafiq';
import { IPlus, ISpeaker, IUpload, IX } from '../components/Icons';

const ALL_SPACES: SpaceId[] = ['study', 'work', 'health', 'home', 'money', 'growth'];

export function PalettePicker({ value, onChange }: { value: Palette; onChange: (p: Palette) => void }) {
  const P: { id: Palette; name: string; c: string[] }[] = [
    { id: 'muse', name: 'The Muse', c: ['#3A4F41', '#D9A6A0', '#EAE0CB'] },
    { id: 'thinker', name: 'The Thinker', c: ['#353C5F', '#B6ACD7', '#F1EEE9'] },
    { id: 'bloom', name: 'The Bloom', c: ['#B06A4A', '#E5C08E', '#F5E9DB'] },
  ];
  return (
    <div className="pal-pick" role="group">
      {P.map((p) => (
        <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(p.id)}>
          <span className="sw">{p.c.map((c) => <i key={c} style={{ background: c }} />)}</span>
          <b>{p.name}</b>
        </button>
      ))}
    </div>
  );
}

export function CharacterSetup() {
  const t = useT();
  const mutate = useApp((s) => s.mutate);
  const character = useApp((s) => s.data.character);
  const poses = usePoses();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasSample, setHasSample] = useState(false);
  useEffect(() => {
    fetch(SAMPLE_SHEET, { method: 'HEAD' }).then((r) => setHasSample(r.ok && (r.headers.get('content-type') || '').startsWith('image'))).catch(() => setHasSample(false));
  }, []);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const { url } = await storeSheet(f);
      mutate((d) => {
        d.character = { sheetUrl: url, source: 'upload', updatedAt: Date.now() };
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CHARACTER_PROMPT);
      setCopied(t('you.copied'));
    } catch {
      promptRef.current?.focus();
      promptRef.current?.select();
      setCopied(t('you.selectCopy'));
    }
  };

  return (
    <div className="stack lg">
      {poses ? (
        <div className="pose-grid">
          {POSE_ORDER.map((p) => (
            <figure key={p}><img src={poses[p]} alt="" /><figcaption>{t('pose.' + p)}</figcaption></figure>
          ))}
        </div>
      ) : (
        <p className="small muted">{t('you.charHint')}</p>
      )}
      <div className="row">
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><IUpload /> {busy ? t('thinking') : t('you.uploadSheet')}</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        {hasSample && character.source !== 'sample' && <button className="btn ghost" onClick={() => mutate((d) => { d.character = { sheetUrl: SAMPLE_SHEET, source: 'sample', updatedAt: Date.now() }; })}>{t('you.useSample')}</button>}
        {character.source !== 'none' && <button className="btn link" onClick={async () => { await clearLocalSheet(); mutate((d) => { d.character = { source: 'none', updatedAt: Date.now() }; }); }}>{t('you.removeChar')}</button>}
      </div>
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>{t('you.copyPrompt')} (Gemini)</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <textarea ref={promptRef} readOnly className="textarea small" rows={6} value={CHARACTER_PROMPT} aria-label={t('you.copyPrompt')} />
          <div className="row">
            <button className="btn sm ghost" onClick={copy}>{t('you.copyPrompt')}</button>
            <span className="small muted">{copied}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

export function You() {
  const t = useT();
  const data = useApp((s) => s.data);
  const mutate = useApp((s) => s.mutate);
  const toast = useUI((s) => s.toast);
  const p = data.profile;
  const s = data.settings;
  const [claude, setClaude] = useState<boolean | null>(null);
  const [, force] = useState(0);
  const [wipe, setWipe] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    detectClaude().then(setClaude);
    return onSyncState(() => force((x) => x + 1));
  }, []);

  const prov = activeProvider();
  const setP = (fn: (pp: typeof p) => void) => mutate((d) => fn(d.profile));
  const setS = (fn: (ss: typeof s) => void) => mutate((d) => fn(d.settings));

  const doExport = async () => {
    const ok = await saveFile(`rafiq-backup-${dayKey()}.json`, JSON.stringify({ app: 'rafiq', version: 1, data }, null, 1));
    if (ok) toast(t('toast.saved'));
  };
  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j?.app !== 'rafiq' || !j.data) throw new Error('bad');
      useApp.getState().replaceAll(hydrate(j.data));
      toast(t('you.imported'));
    } catch {
      toast(t('you.importFail'));
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };
  const doWipe = async () => {
    await wipeRemote();
    await wipeLocal();
    const fresh = defaultData();
    useApp.getState().replaceAll(fresh);
    setWipe(false);
    setWipeText('');
  };

  return (
    <div className="stack xl">
      <h1>{t('you.title')}</h1>

      <section className="card stack lg">
        <h2>{t('you.profile')}</h2>
        <Field label={t('you.name')}><input id="you-name" className="input" value={p.name} onChange={(e) => setP((x) => { x.name = e.target.value; })} /></Field>
        <Field label={t('you.lang')}>
          <Seg value={p.lang} onChange={(v) => setP((x) => { x.lang = v; })} options={[{ v: 'en', l: 'English' }, { v: 'ar', l: 'العربية' }]} />
        </Field>
        <Field label={t('you.palette')}><PalettePicker value={p.palette} onChange={(v) => setP((x) => { x.palette = v; })} /></Field>
        <Field label={t('you.mode')}>
          <Seg value={p.mode} onChange={(v) => setP((x) => { x.mode = v; })} options={[{ v: 'light', l: t('you.light') }, { v: 'dark', l: t('you.dark') }, { v: 'system', l: t('you.system') }]} />
        </Field>
        <Field label={t('you.spaces')}>
          <div className="chips">
            {ALL_SPACES.map((sp) => (
              <button key={sp} className="chip" aria-pressed={p.spaces.includes(sp)} onClick={() => setP((x) => { x.spaces = x.spaces.includes(sp) ? (x.spaces.length > 1 ? x.spaces.filter((y) => y !== sp) : x.spaces) : [...x.spaces, sp]; })}>{t('space.' + sp)}</button>
            ))}
          </div>
        </Field>
        <Field label={t('you.interests')}>
          <input id="you-interests" className="input" placeholder={t('you.interestsPh')} defaultValue={p.interests.join(', ')} onBlur={(e) => setP((x) => { x.interests = e.target.value.split(/[,،]/).map((y) => y.trim()).filter(Boolean).slice(0, 20); })} />
        </Field>
        <label className="toggle"><span>{t('you.tone')}</span><input type="checkbox" className="switch" checked={p.toughLove} onChange={(e) => setP((x) => { x.toughLove = e.target.checked; })} /></label>
      </section>

      <section className="card stack lg">
        <h2>{t('you.rhythm')}</h2>
        <div className="grid2">
          <Field label={t('you.wake')}><input id="you-wake" type="time" className="input" value={p.wake} onChange={(e) => setP((x) => { x.wake = e.target.value; })} /></Field>
          <Field label={t('you.sleep')}><input id="you-sleep" type="time" className="input" value={p.sleep} onChange={(e) => setP((x) => { x.sleep = e.target.value; })} /></Field>
        </div>
        <AnchorsEditor />
      </section>

      <section className="card stack lg">
        <h2>{t('you.character')}</h2>
        <CharacterSetup />
      </section>

      <section className="card stack lg">
        <h2>{t('you.ai')}</h2>
        <Seg value={s.aiProvider} onChange={(v) => setS((x) => { x.aiProvider = v; })} options={[
          { v: 'auto', l: t('you.aiAuto') }, { v: 'claude', l: 'Claude' }, { v: 'gemini', l: 'Gemini' }, { v: 'off', l: t('you.aiOff') },
        ]} />
        <p className="small"><b>{t('you.aiStatus', { p: prov === 'claude' ? 'Claude' : prov === 'gemini' ? 'Gemini' : t('you.none') })}</b></p>
        {claude && <p className="small muted">{t('you.claudeHint')}</p>}
        {(s.aiProvider === 'gemini' || (s.aiProvider === 'auto' && !claude)) && (
          <div className="stack">
            <Field label={t('you.geminiKey')}><input id="gem-key" className="input" type="password" autoComplete="off" value={s.geminiKey} onChange={(e) => setS((x) => { x.geminiKey = e.target.value.trim(); })} /></Field>
            <Field label={t('you.geminiModel')}><input id="gem-model" className="input" value={s.geminiModel} onChange={(e) => setS((x) => { x.geminiModel = e.target.value.trim(); })} /></Field>
            <p className="small muted">{t('you.geminiHint')}</p>
          </div>
        )}
      </section>

      <section className="card stack lg">
        <h2>{t('you.voice')}</h2>
        <Seg value={s.voice} onChange={(v) => setS((x) => { x.voice = v; })} options={(['airy', 'buttery', 'glassy', 'rounded'] as const).map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) }))} />
        <Field label={`${t('you.rate')} · ${s.voiceRate.toFixed(1)}×`}>
          <input id="voice-rate" type="range" min={0.7} max={1.5} step={0.1} value={s.voiceRate} onChange={(e) => setS((x) => { x.voiceRate = Number(e.target.value); })} />
        </Field>
        <div className="row">
          <button className="btn sm ghost" onClick={() => speak(p.lang === 'ar' ? 'أهلاً، أنا رفيق. خطوة واحدة تكفي للبداية.' : 'Hi, I’m Rafiq. One step is enough to begin.')}><ISpeaker /> {t('you.voiceTest')}</button>
        </div>
        <label className="toggle"><span>{t('you.chime')}</span><input type="checkbox" className="switch" checked={s.chime} onChange={(e) => setS((x) => { x.chime = e.target.checked; })} /></label>
      </section>

      <section className="card stack lg">
        <h2>{t('you.data')}</h2>
        <p className="small"><b>{t('you.sync')}:</b> {syncState.active ? t('you.synced') : t('you.local')}</p>
        <p className="small muted">{t('you.privacy')}</p>
        <div className="row">
          <button className="btn sm ghost" onClick={doExport}>{t('you.export')}</button>
          <button className="btn sm ghost" onClick={() => importRef.current?.click()}>{t('you.import')}</button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          <button className="btn sm danger" onClick={() => setWipe(true)}>{t('you.wipe')}</button>
        </div>
        {wipe && (
          <div className="card soft stack">
            <p className="small">{t('you.wipeConfirm')}</p>
            <input id="wipe-confirm" className="input" value={wipeText} onChange={(e) => setWipeText(e.target.value)} />
            <div className="row">
              <button className="btn sm danger" disabled={wipeText !== 'DELETE'} onClick={doWipe}>{t('you.wipe')}</button>
              <button className="btn sm ghost" onClick={() => { setWipe(false); setWipeText(''); }}>{t('cancel')}</button>
            </div>
          </div>
        )}
      </section>
      <p className="tiny muted" style={{ textAlign: 'center' }}>Rafiq · رفيق · v1.0 — {t('motto')}</p>
    </div>
  );
}

function AnchorsEditor() {
  const t = useT();
  const anchors = useApp((s) => s.data.profile.anchors);
  const mutate = useApp((s) => s.mutate);
  const set = (fn: (a: Anchor[]) => void) => mutate((d) => fn(d.profile.anchors));
  return (
    <div className="stack">
      <h3>{t('you.anchors')}</h3>
      <p className="small muted">{t('you.anchorsHint')}</p>
      {anchors.map((a) => (
        <div key={a.id} className="row nowrap">
          <input className="input grow" aria-label={t('you.anchorLabel')} value={a.label} onChange={(e) => set((x) => { const y = x.find((z) => z.id === a.id); if (y) y.label = e.target.value; })} />
          <select className="select" style={{ width: 'auto' }} aria-label={t('task.kind')} value={a.kind} onChange={(e) => set((x) => { const y = x.find((z) => z.id === a.id); if (y) y.kind = e.target.value as Anchor['kind']; })}>
            <option value="meal">🍽️</option><option value="class">🎓</option><option value="work">💼</option><option value="prayer">🕌</option><option value="other">•</option>
          </select>
          <input className="input" style={{ width: 110 }} type="time" aria-label={t('you.anchorTime')} value={a.time} onChange={(e) => set((x) => { const y = x.find((z) => z.id === a.id); if (y) y.time = e.target.value; })} />
          <input className="input num" style={{ width: 70 }} type="number" min={5} step={5} aria-label={t('you.anchorMin')} value={a.minutes} onChange={(e) => set((x) => { const y = x.find((z) => z.id === a.id); if (y) y.minutes = Math.max(5, Number(e.target.value) || 5); })} />
          <button className="icon-btn" aria-label={t('delete')} onClick={() => set((x) => { const i = x.findIndex((z) => z.id === a.id); if (i >= 0) x.splice(i, 1); })}><IX /></button>
        </div>
      ))}
      <button className="btn sm ghost" style={{ justifySelf: 'start' }} onClick={() => set((x) => { x.push({ id: uid(), label: '', time: '12:00', minutes: 30, kind: 'other' }); })}><IPlus /> {t('you.addAnchor')}</button>
    </div>
  );
}
