# Puzzle Trail

Invite-only, voice-first puzzle game (PWA) for kids in Grades 2–3: number puzzles and a thinking-puzzles track, made to be tough and make kids think.
Independent: never name, imitate or claim a link to any competition, test or publisher (disclaimer in `content/legal.ts`). Redesign plan: `docs/REDESIGN.md`.
Kid practices on an iPad; a parent follows along on their own device.

## Commands

- `npm run dev`: local app (no `/api`; voice falls back to the device, sync is off)
- `npm run check`: typecheck, then tests, then build. **Run before every commit.**
- `npm test -- <file>`: one test file

## Map

```
src/
  app.ts            route table (#/<route>/<param>) → one screen per file
  screens/          home, world (game-look Home: map + islands), buddy (picker), stickers (sticker book), practice, review, test, learn (+ topic, strategies), thinking, round (reopen the last round), progress, settings (+ privacy), parent
  ui/               building blocks: dom (h, list, group, segmented, meter, fill), icons, problemCard, answerCard, placementBoard, choicePicker (tap-to-answer pictures/words), roundEnd (end-of-round summary, explanations, retry missed), clock, charts, session, player (animated explanations), feedbackSheet (the Feedback button), fx (game-look feedback), buddy (game-look buddy: poses, bubble, walking the round's stones), voiceControls (Pause/Mute on questions)
  core/             pure logic, no DOM: types, rng, answer (parse/check), coach, mastery, progress (stars, goal, streak, today), session (test modes + clock), storage, insights, scene (SceneBuilder), explain (sceneFor + whiteboard fallback), pacing (explanation timing), feedback (end-of-round score + line), tunes (game music composed in code, levels per screen)
  content/          topics.ts (registry, makeProblem, makeMeet) + generators/*.ts (one Topic per problem family) + scenes/*.ts (kit + one scene function per family)
                    + thinking/ (verbal, quantitative, nonverbal, figures: shared SVG/scene geometry, common: mc() choices)
                    + world.ts (game-look islands → Number Puzzles topics), buddies.ts (buddy SVGs, poses, effort-based lines), stickers.ts (round-end sticker rules, 24 designs)
  voice/            speech (TTS: natural via /api/tts, device fallback), recognition (STT + voice commands), activity (talking/listening signal), music (game-look tunes and effects, Web Audio)
  sync/             offline-first upload of the attempt log to /api/sync
  notify/           daily reminder (web push subscribe, practiced-today touch) and app icon badge
public/push-sw.js   imported by the service worker: shows reminders, opens Practice on tap
server/             backend logic shared by functions/ (unit-tested on SQLite): parent, email (+ nudges), digest, ses, push (RFC 8291/8292), userFeedback, env
functions/api/      Cloudflare Pages Functions: tts, sync, parent, push, feedback, hourly, weekly, email/{confirm,unsubscribe}
migrations/         D1 schema, applied once each by scripts/ensure-d1.mjs on deploy
scripts/            CI helpers: ensure-d1, ensure-domain, status (prod report; lib/experiment: Game vs Classic tester round), probe (live API round-trip), feedback (triage), email-dns (+ email-dns-plan: SES MAIL FROM + DMARC, dry run by default), consolidate-prompts
tests/              vitest, including a sweep of every topic × grade × level × 120 seeds
```

## Conventions

- **Screens** export `xScreen(param?) => View` (`{ title, el, destroy? }`) and get registered in `src/app.ts`. The top bar has Back + ⌂ Home (hidden on Home only), Feedback and Settings, plus ♪ music on/off in the game look (`ui/musicToggle.ts`, hidden where music is silent). Every question card has the Pause/Mute pair (`ui/voiceControls.ts`): Mute is the Read aloud setting, so it carries over to the next questions and the explanation player. The grade switch is `ui/session.gradeSwitch()` (Home and Thinking Puzzles).
- **UI copy:** no taglines, helper text or secondary labels. A list row's right side shows data (a count, a time), never an explanation. If a screen needs words to make sense, change the layout.
- **Styling:** tokens in `src/styles.css` `:root` (light and dark). One accent color. Lists use `list()` / `group()`.
- **New topic:** add a `Topic` in `src/content/generators/*.ts` and register it in `content/topics.ts`. `tests/generators.test.ts` covers it automatically.
  Problems must be deterministic per seed (ids are `topic:grade:level:seed`). Include hints, steps, and misconceptions for likely wrong answers.
  Mark the key quantities and conditions in `text` with `**bold**` (1–3 per problem; never in `speech`): `tests/keywords.test.ts` requires it for every problem, Number Puzzles and Thinking Puzzles. Tests that parse numbers out of `text` should use the plain text (markers removed); the voice strips them in `prepareForSpeech`.
- **Explanations:** every problem returns a `scene` (`content/scenes/*.ts`, drawn with `scenes/kit.ts`). A scene is steps of `say` (voice-over) + the full picture; the player animates between them by shape id. Mark the first step that gives the answer away `reveal: true`: hints stop before it. `tests/scenes.test.ts` requires a scene for every topic.
- **Content:** original puzzles only, generated per seed. Never copy or paraphrase puzzles from contests, tests, books or videos, and never name a third-party contest, test or publisher anywhere (code, docs, UI, emails, prompt history going forward). Old ids are rewritten by `core/legacy.ts` (device, sync) and `migrations/0006` (D1).
- **Legal:** `content/legal.ts` holds the disclaimer, privacy policy and terms (`TERMS_VERSION`); `screens/legal.ts` shows them at `#/about`, `#/terms`, `#/privacy`, and `acceptScreen` blocks every other screen until the terms are accepted, again every 30 days or when `TERMS_VERSION` changes (`settings.terms`). Change `TERMS_VERSION` whenever their text changes, and keep every statement true of the code. Emails end with `DISCLAIMER_SHORT`. The child's nickname stays on the device (never synced).
- **Tracks:** `Topic.track` is `'number'` (default) or `'thinking'`. `topicsForGrade(grade)` returns Number Puzzles only, so the Number Puzzles mix, tests, progress and stars never include Thinking Puzzles. Thinking Puzzles lives at `#/thinking` (mix: `#/practice/thinking`).
  Thinking Puzzles items are multiple choice: 3 choices in Grade 2 (pictures, read aloud), 5 in Grade 3 (words). Build them with `thinking/common.ts` `mc()`; `tests/thinking.test.ts` checks every item.
- **Settings** (`core/storage.ts`): when you change the shape, migrate it in `migrateSettings` and add a case to `tests/settings.test.ts`.
- **Highlights:** `settings.highlight` is `'neon'` (default) or `'classic'`, mirrored to `<html data-hl>` by `ui/dom.applyHighlight` (at start and from Settings). Neon styles live at the end of `styles.css`: a lime highlighter on `**bold**` key words, a glow on pulses and on meaning-carrying outlines (`s-accent`, `s-s1`, `s-s2`, `s-good`), a lime edge on the newest hint, a glow on the picked and the right multiple-choice answer (never on a wrong pick). Review and Test: the current progress dot (`.dots > .now`) and right ones glow, the running clock glows (never in its last minute), the answer box gets a lime focus ring, a right result card glows, and the right answer in a comparison (`.compare dd.right`) gets the highlighter. Parent dashboard: the week's tile numbers and ✓ marks glow, and each mistake's right answer is highlighted; ✗ marks, meters and charts stay plain. Learn: earned stars glow, the topic's main idea gets a lime edge, tips get lime bullets (`.bullets.tips`), strategy names get the highlighter (`strong.key`); "Watch out" stays plain. Progress: the tiles glow, the best listed test score gets the highlighter (`.best`, only with 2+ tests); "Practice next" stays plain. Small lime marks use `--neon-dot` (darker in light mode, ≥ 3:1 on white). Keep text contrast ≥ 4.5:1 in both themes.
- **Look:** `settings.look` is `'classic'` (default) or `'game'`, and `settings.motion` is `'full'` or `'reduced'`; `ui/dom.applyLook` mirrors both to `<html data-look / data-motion>`. Game styles are the last block of `styles.css` (bright background and soft floating shapes around the card, never on it; stepping-stone dots; pressable buttons). `ui/fx.cheer` adds a ≤ 600 ms burst on a right answer and a gentle wobble on a miss, game look only. Reduced motion (setting or system) turns animations off. The classic Home asks Game or Classic once (`settings.lookOffered`; game saves count as answered). Game type is self-hosted Nunito (OFL, `@fontsource/nunito`, woff2 precached). Plan and next phases: `docs/GAME-MODE.md`.
- **API changes:** put the logic in `server/` with tests and keep `functions/` as thin wrappers. Schema changes go in a new `migrations/000N_*.sql`.

## End of a round (Practice and Review)

`ui/roundEnd.ts`: the score (first tries), one line of feedback (`core/feedback.ts`), right/total per question type, then every question. Tap one to see the child's answer against the right one and the animated explanation.
**Try missed again** replays the missed problems (same ids, review mode); each one fixed raises the score, shown as "7 → 9 of 10". Missed problems also stay in the spaced Review queue.
The last round per grade and kind (`number`, `thinking`, `review`) is saved in `state.rounds` (problem ids + results, updated after every fix) and reopens at `#/round/<kind>`: a **Last round** row on Home (latest of number/review) and on the Thinking Puzzles screen.
Mid-round, **‹** next to the progress dots (or a tapped dot) opens earlier questions (`peekRound`): answer vs right one, explanation, **Try again** on a missed one (counts as a fix). The current card is kept as is. Practice and Review only, never a scored Test.
Game look: `roundEnd({ celebrate: roundStart(state) })` (Practice and Review only) adds the celebration card and awards stickers (`state.stickers`, at most 3 a day, synced in `snapshot.stickers`), and logs the finished round in either look (`state.roundLog`, numbers only, synced in `snapshot.roundLog`) for the Game vs Classic comparison in Actions → Status.
Rounds sync to the parent dashboard inside the existing snapshot (`snapshot.rounds`, no schema change); saving a round triggers a sync. The dashboard lists them newest first (`insights.lastRounds`), and a tapped question shows the child's answer and plays the explanation.

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

## Feedback (in the app)

The top bar's speech-bubble button opens a sheet: **Problem** or **Idea**, a message, Send. The screen, the problem on screen (`data-problem-id` on the card) and the grade go along automatically.
`POST /api/feedback` (`server/userFeedback.ts`) stores it in D1 `user_feedback` (status `new`), rate-limited per install (10/hour) and app-wide (200/day), and emails the owner (`FEEDBACK_TO`, else `MAIL_REPLY_TO`).
Triage: Actions → **Feedback** lists ids, screens and statuses and sets status (`triaged`, `done`, `wontfix`) with a note. **Message text never goes into GitHub** (issues or logs): the repository is public and a message can mention a child.

## Deploy

Push to `main`. GitHub Actions runs `npm run check`, provisions D1, deploys to Cloudflare Pages, smoke-tests `/api/parent` and `/api/tts`, and checks the custom domain.
Production health and email log: Actions → **Status** (read-only).
**Private app:** not indexed (robots.txt + `X-Robots-Tag` + meta), crawlers and AI agents get 403 (`functions/_middleware.ts` → `server/guard.ts`), and Cloudflare Access (Actions → **Cloudflare Access**, `scripts/cloudflare-access.mjs`) requires an invited email sign-in on every host. CI calls the site with the Access service token (`CF_ACCESS_CLIENT_ID/SECRET`). Never add a public route; the only bypasses are email confirm/unsubscribe and the service-worker scripts (`/sw.js`, `/push-sw.js`, `/workbox-*`; code only, needed so installed copies can update). `src/pwa.ts` checks for updates (open, foreground, hourly) and, when the sign-in has expired, drops the offline copy and reloads to the sign-in page; `public/push-sw.js` does the same when a new version installs.
Setup and secrets: `docs/DEPLOY.md`. Tester guide and test cases: `docs/TESTING.md`.

## Prompt history (standing instruction)

- Save **every** request and response to `docs/prompts-history/YYYY/MM/YYYY-MM-DDTHH-MM-SSZ_stepNNN.md` (UTC):
  step id, timestamp, the request verbatim, and a response summary (decisions, files, verification, next steps).
- Step ids come from the user's `#stepNNN` tag. Otherwise continue the sequence.
- At the start of each month run `npm run prompts:consolidate`.
