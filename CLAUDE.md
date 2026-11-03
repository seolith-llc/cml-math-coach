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
  screens/          home, practice, review, meet, learn (+ topic, strategies), progress, settings (+ privacy), parent
  ui/               building blocks: dom (h, list, group, meter, fill), icons, problemCard, placementBoard, charts, session
  core/             pure logic, no DOM: types, rng, answer (parse/check), coach, mastery, storage, insights
  content/          topics.ts (registry, makeProblem, makeMeet) + generators/*.ts (one Topic per problem family)
  voice/            speech (TTS: natural via /api/tts, device fallback), recognition (STT + voice commands)
  sync/             offline-first upload of the attempt log to /api/sync
server/             backend logic shared by functions/ (unit-tested on SQLite): parent, email, digest, ses, env
functions/api/      Cloudflare Pages Functions: tts, sync, parent, weekly, email/{confirm,unsubscribe}
migrations/         D1 schema, applied once each by scripts/ensure-d1.mjs on deploy
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

## Deploy

Push to `main`. GitHub Actions runs tests, provisions D1, deploys to Cloudflare Pages, then smoke-tests `/api/parent` and `/api/tts`.
Setup and secrets: `docs/DEPLOY.md`.

## Prompt history (standing instruction)

- Save **every** request and response to `docs/prompts-history/YYYY/MM/YYYY-MM-DDTHH-MM-SSZ_stepNNN.md` (UTC):
  step id, timestamp, the request verbatim, and a response summary (decisions, files, verification, next steps).
- Step ids come from the user's `#stepNNN` tag. Otherwise continue the sequence.
- At the start of each month run `npm run prompts:consolidate`.
