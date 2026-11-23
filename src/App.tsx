import { useEffect, useState } from 'react';
import { useApp } from './lib/store';
import { useT, useUI, tNow, type Tab } from './lib/ui';
import { reflow } from './lib/engine';
import { endBreak, finishFocus } from './lib/actions';
import { detectClaude } from './lib/ai';
import { startSync } from './lib/sync';
import { speak } from './lib/voice';
import { makeReportFor } from './lib/report';
import { monthKey } from './lib/util';
import { todayCheckin } from './lib/store';
import { Logo, LogoDefs } from './components/Logo';
import { IBook, IList, IPlay, ISpark, ISprout, ISun, ITimer, IUser } from './components/Icons';
import { TaskEditor } from './components/TaskEditor';
import { BrainDump, ExamPlanner, PostponeDetective } from './components/Modals';
import { JustStart } from './components/JustStart';
import { Overwhelm } from './components/Overwhelm';
import { Today } from './screens/Today';
import { Plan } from './screens/Plan';
import { Focus } from './screens/Focus';
import { Study } from './screens/Study';
import { Growth } from './screens/Growth';
import { You } from './screens/You';
import { Onboarding } from './screens/Onboarding';

const NAV: { id: Tab; Icon: typeof ISun }[] = [
  { id: 'today', Icon: ISun }, { id: 'plan', Icon: IList }, { id: 'focus', Icon: ITimer },
  { id: 'study', Icon: IBook }, { id: 'growth', Icon: ISprout }, { id: 'you', Icon: IUser },
];

/** Applies palette, light/dark and language direction to <html>. */
function useTheme() {
  const { palette, mode, lang } = useApp((s) => s.data.profile);
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-palette', palette);
    r.setAttribute('data-mode', mode);
    r.setAttribute('lang', lang);
    r.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(r).getPropertyValue('--bg').trim() || '#3A4F41');
  }, [palette, mode, lang]);
}

/** Watches the focus timer on every screen, so sessions end on time wherever you are. */
function FocusWatcher() {
  const phase = useApp((s) => s.data.focus.phase);
  useEffect(() => {
    if (phase !== 'focus' && phase !== 'break') return;
    const id = setInterval(() => {
      const d = useApp.getState().data;
      const f = d.focus;
      if (Date.now() < f.endsAt) return;
      const energy = todayCheckin(d)?.energy ?? 'normal';
      if (f.phase === 'focus') {
        finishFocus(true, energy);
        if (document.visibilityState === 'visible') speak(tNow('focus.timeUp')).catch(() => {});
      } else if (f.phase === 'break') {
        endBreak(true);
        if (document.visibilityState === 'visible') speak(tNow('focus.breakUp')).catch(() => {});
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);
  return null;
}

export default function App() {
  useTheme();
  const t = useT();
  const ready = useApp((s) => s.ready);
  const onboarded = useApp((s) => s.data.profile.onboarded);
  const sparks = useApp((s) => s.data.rewards.sparks);
  const focusPhase = useApp((s) => s.data.focus.phase);
  const { tab, setTab, modal, toasts, overwhelm, open } = useUI();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    detectClaude();
    startSync();
    const d = useApp.getState().data;
    const moved = reflow();
    const away = Date.now() - d.prevOpen > 3 * 86400000;
    if (away && d.profile.onboarded) setBanner(tNow('today.welcomeBack') + (moved ? ' ' + tNow('today.carried', { n: moved }) : ''));
    else if (moved) setBanner(tNow('today.carried', { n: moved }));
    // monthly report: when a new month starts, last month's report is created automatically
    const prev = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15));
    const hadActivity = d.sessions.some((s) => monthKey(s.start) === prev) || d.tasks.some((x) => x.doneAt && monthKey(x.doneAt) === prev);
    if (hadActivity && !d.reports.some((r) => r.month === prev)) {
      const r = makeReportFor(d, prev);
      useApp.getState().mutate((x) => {
        x.reports.push(r);
      });
    }
  }, [ready]);

  if (!ready) {
    return (
      <div className="onb"><LogoDefs /><Logo size={72} /></div>
    );
  }
  if (!onboarded) return (<><LogoDefs /><Onboarding /></>);

  const showFab = tab !== 'focus' && tab !== 'today' && !modal;

  return (
    <div className="shell">
      <LogoDefs />
      <FocusWatcher />
      <header className="topbar">
        <div className="topbar-in">
          <button className="brand" onClick={() => setTab('today')} aria-label="Rafiq">
            <Logo size={34} />
            <span>Rafiq</span><span className="ar">رفيق</span>
          </button>
          <div className="row" style={{ gap: 8 }}>
            {(focusPhase === 'focus' || focusPhase === 'break' || focusPhase === 'paused') && tab !== 'focus' && (
              <button className="btn sm soft" onClick={() => setTab('focus')}><ITimer /> {t('focus.title')}</button>
            )}
            <button className="spark-pill num" onClick={() => setTab('growth')} aria-label={t('today.sparks')}><ISpark className="s" style={{ width: 14, height: 14 }} /> {sparks}</button>
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-in">
          {NAV.map(({ id, Icon }) => (
            <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              <Icon /> <span>{t('nav.' + id)}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="main" id="main">
        {tab === 'today' && <Today banner={banner} />}
        {tab === 'plan' && <Plan />}
        {tab === 'focus' && <Focus />}
        {tab === 'study' && <Study />}
        {tab === 'growth' && <Growth />}
        {tab === 'you' && <You />}
      </main>

      {showFab && (
        <button className="fab" onClick={() => open({ kind: 'just' })}><IPlay /> {t('just.title')}</button>
      )}

      {modal?.kind === 'task' && <TaskEditor taskId={modal.taskId} preset={modal.preset as any} />}
      {modal?.kind === 'dump' && <BrainDump />}
      {modal?.kind === 'exam' && <ExamPlanner />}
      {modal?.kind === 'postpone' && <PostponeDetective taskId={modal.taskId} />}
      {modal?.kind === 'just' && <JustStart taskId={modal.taskId} text={modal.text} />}
      {overwhelm && <Overwhelm />}

      <div className="toasts" aria-live="polite">
        {toasts.slice(-2).map((x) => <div key={x.id} className="toast">{x.text}</div>)}
      </div>
    </div>
  );
}
