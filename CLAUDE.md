# Math Coach

Voice-first PWA for practicing Continental Math League (CML) problems, Grades 2–3.
Kid practices on an iPad; a parent follows along on their own device.

## Commands

- `npm run dev`: local app (no `/api`; voice falls back to the device, sync is off)
- `npm run check`: typecheck, then tests, then build. **Run before every commit.**
- `npm test -- <file>`: one test file

## Map

```
src/
  app.ts            route table (#/<route>/<param>) → one screen per file
  screens/          home, practice, review, test, learn (+ topic, strategies), progress, settings (+ privacy), parent
  ui/               building blocks: dom (h, list, group, segmented, meter, fill), icons, problemCard, answerCard, placementBoard, clock, charts, session
  core/             pure logic, no DOM: types, rng, answer (parse/check), coach, mastery, progress (stars, goal, streak, today), session (test modes + clock), storage, insights
  content/          topics.ts (registry, makeProblem, makeMeet) + generators/*.ts (one Topic per problem family)
  voice/            speech (TTS: natural via /api/tts, device fallback), recognition (STT + voice commands)
  sync/             offline-first upload of the attempt log to /api/sync
  notify/           daily reminder (web push subscribe, practiced-today touch) and app icon badge
public/push-sw.js   imported by the service worker: shows reminders, opens Practice on tap
server/             backend logic shared by functions/ (unit-tested on SQLite): parent, email (+ nudges), digest, ses, push (RFC 8291/8292), env
functions/api/      Cloudflare Pages Functions: tts, sync, parent, push, hourly, weekly, email/{confirm,unsubscribe}
migrations/         D1 schema, applied once each by scripts/ensure-d1.mjs on deploy
scripts/            CI helpers: ensure-d1, ensure-domain, status (prod report), probe (live API round-trip), consolidate-prompts
tests/              vitest, including a sweep of every topic × grade × level × 120 seeds
```

## Conventions

- **Screens** export `xScreen(param?) => View` (`{ title, el, destroy? }`) and get registered in `src/app.ts`.
- **UI copy:** no taglines, helper text or secondary labels. A list row's right side shows data (a count, a time), never an explanation. If a screen needs words to make sense, change the layout.
- **Styling:** tokens in `src/styles.css` `:root` (light and dark). One accent color. Lists use `list()` / `group()`.
- **New topic:** add a `Topic` in `src/content/generators/*.ts` and register it in `content/topics.ts`. `tests/generators.test.ts` covers it automatically.
  Problems must be deterministic per seed (ids are `topic:grade:level:seed`). Include hints, steps, and misconceptions for likely wrong answers.
- **Content:** original problems only. Never commit the CML contest papers.
- **Settings** (`core/storage.ts`): when you change the shape, migrate it in `migrateSettings` and add a case to `tests/settings.test.ts`.
- **API changes:** put the logic in `server/` with tests and keep `functions/` as thin wrappers. Schema changes go in a new `migrations/000N_*.sql`.

## Tests (the screen)

Two independent choices: **Mode** (Learn = coached as you go, Test = scored at the end) and **Clock** (Off, Total minutes, Each question's seconds), plus 6/10/15/20 questions.
Test + Off/Total = all questions on one page. Test + Each = one at a time, and time up moves on. Learn = coached cards, and time up reveals the answer (Each) or ends the session (Total).
Only Test mode writes a `meets` record. The setup is stored in `settings.test`.

## Engagement (child-first)

- **Stars:** a topic earns ★/★★/★★★ when the adaptive level goes up (same thresholds as `mastery.levelFor`), and stars never go down. Level-ups are celebrated.
- **Daily goal** (5/10/15/20, default 10) and the **Today** card on Home. When the goal is met, "Done for today" is the main action: no endless play.
- **Streak:** local days; one missed day per week is forgiven. No loss-framed copy anywhere.
- **Reminders go to the parent first:** inactivity nudge emails (3 days, then 7, max 2 per break, 5 pm Chicago, never Sunday) with their own switch and one-click "turn off reminders".
  Device reminders (web push) are opt-in in Settings, one a day at a chosen hour, skipped if practice already happened today, paused after 14 idle days. On iPad they need the Home Screen app.
- **Scheduling:** one job. `.github/workflows/hourly.yml` → `POST /api/hourly` (bearer `CRON_SECRET`), and each part decides if it's due. The VAPID key pair is generated once and stored in D1 `kv`.

## Deploy

Push to `main`. GitHub Actions runs `npm run check`, provisions D1, deploys to Cloudflare Pages, smoke-tests `/api/parent` and `/api/tts`, and checks the custom domain.
Production health and email log: Actions → **Status** (read-only).
Setup and secrets: `docs/DEPLOY.md`.

## Prompt history (standing instruction)

- Save **every** request and response to `docs/prompts-history/YYYY/MM/YYYY-MM-DDTHH-MM-SSZ_stepNNN.md` (UTC):
  step id, timestamp, the request verbatim, and a response summary (decisions, files, verification, next steps).
- Step ids come from the user's `#stepNNN` tag. Otherwise continue the sequence.
- At the start of each month run `npm run prompts:consolidate`.
