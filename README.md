# Rafiq · رفيق

*One step is enough to begin. — خطوة واحدة تكفي للبداية*

An ADHD-friendly companion for studying, work and life. React + TypeScript + Vite, local-first, English and Arabic (RTL).

## What's in V1

| Area | What it does | Where |
|---|---|---|
| Onboarding | Name, language, palette, light/dark, spaces, daily rhythm, personal character | `src/screens/Onboarding.tsx` |
| Today | Energy check-in → one recommended task with "why", adaptive day plan around anchors, motivation line, momentum | `src/screens/Today.tsx` |
| Just Start | Turns anything into a staircase of tiny steps, 2–5 min challenge timer, growing next steps, "I'm stuck" makes it smaller | `src/components/JustStart.tsx` |
| Focus | Energy-sized sessions, time disc, pause/+5/end, breaks, background sounds, thought parking lot, re-entry notes, wake lock, chime + voice | `src/screens/Focus.tsx` |
| Plan | Tasks with steps, priority sorting, brain dump (AI or offline), exam planner with spaced reviews + buffer day | `src/screens/Plan.tsx`, `src/components/Modals.tsx` |
| Postpone Detective | After 2 postpones asks why and changes the task (smaller step, clearer steps, look-only step, move to morning) | `src/lib/actions.ts` |
| Study (Notebooks) | Sources (paste / PDF / TXT), summary, study guide, flashcards with spaced repetition, quizzes that add review tasks for weak topics, grounded Q&A, explain simply, read aloud | `src/screens/Study.tsx` |
| Growth | Week stats, Time Mirror, done list, trackers with trends, evening reflection, Sparks + reward bank + unlocks, monthly growth report (auto on the 1st) | `src/screens/Growth.tsx`, `src/lib/report.ts` |
| Overwhelm mode | Hides everything, guided breathing, then one tiny thing | `src/components/Overwhelm.tsx` |
| Rafiq character | Upload a 4×2 character sheet → auto-cut into 8 moods that follow your day | `src/lib/character.ts`, `src/components/Rafiq.tsx` |

The "brain" (priorities, plan, momentum, Sparks, moods, exam plans, dialect learning) is in `src/lib/engine.ts`; motivation lines in `src/lib/motivation.ts`.

## AI, voice and sync

| | Inside claude.ai (published page) | Self-hosted (Vercel, Netlify…) |
|---|---|---|
| AI | Claude, on your own Claude account | Google Gemini with a free key (You → AI) |
| Read aloud | Claude voices | Browser voice (free) |
| Dictation | Claude dictation | Browser speech recognition (Chrome/Edge/Safari) |
| Sync | Private per-user docs, across your devices | This device only (IndexedDB) — cloud sync is V3 |

Everything else works with no AI at all (templates and rules take over).

## Run it

```bash
npm install
npm run dev
```

## Host it for free

```bash
npm run build
```

Upload the `dist/` folder to Netlify (drag and drop), or import the repo in Vercel (framework: Vite).

## Roadmap

- V2: Android/iPhone apps (Capacitor) with home-screen widgets, interest news feed
- V3: accounts + cloud sync (Supabase), Circles, gifting Sparks, partner rewards
