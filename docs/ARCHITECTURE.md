# Architecture

**Stack:** Vite 6 + TypeScript (strict) + `vite-plugin-pwa` (Workbox) + Vitest. No UI framework.
The app is small and voice-driven, and a framework-free UI keeps the bundle around 40 KB gzipped, which helps on low-end tablets.
The domain layer (`src/core`, `src/content`) is pure TypeScript with no DOM access. It can be moved into
Angular/React/Ionic later without changes. The UI layer is the only part that would need rewriting.

```
src/
  core/            pure domain logic (unit-tested)
    types.ts       Problem, Topic, AnswerSpec (number | money | time | day | choice | word | set)
    rng.ts         seeded PRNG (mulberry32). Problems are reproducible from their id
    numberWords.ts spoken/typed text → numbers ("one hundred and five", "31,400", "2nd")
    answer.ts      answer normalisation, checking and diagnosis of known misconceptions
    coach.ts       coaching policy: tries, hints, targeted feedback, when to reveal the solution
    mastery.ts     adaptive topic and level selection (EWMA mastery, staleness bonus)
    storage.ts     localStorage persistence, Leitner review boxes, streaks, meet history
  content/
    generators/*.ts  37 topic generators (number, word, money, time, logic, counting, puzzles)
    topics.ts        registry, makeProblem(), problemFromId(), makeMeet()
    strategies.ts    Pólya's 4 steps, strategy glossary, contest tips
  voice/
    speech.ts        TTS: sentence chunking, maths-to-speech ("−" → "minus", "$1.25" → "1 dollar and 25 cents")
    recognition.ts   STT: up to 5 alternatives, interim results, voice-command parser
  ui/              hash router + views (home, practice, review, meet, learn, toolkit, progress, settings)
```

## Key design decisions
1. **Generators instead of a fixed question bank.** Each topic is a function `(grade, level, rng) → Problem`
   that returns text, an optional SVG figure, a typed answer, hints, steps and misconceptions. This gives unlimited fresh
   practice, and the id `topic:grade:level:seed` regenerates the exact same problem for the review queue.
2. **Correct by construction, checked by brute force.** Logic puzzles keep adding clues until exactly one ordering or assignment fits,
   then remove redundant clues. Cryptarithms and number riddles are checked for a unique solution.
   The tests run every topic × grade × level × 120 seeds and assert that answers are well formed, misconceptions
   never equal the answer, and the canonical answer round-trips through the parser.
3. **Multi-hypothesis voice answers.** Recognition returns up to 5 alternatives. The answer counts as correct if *any*
   alternative is correct, which handles "for/four" and "to/two" homophones and children's speech.
4. **Typed answer specs.** Money accepts `45`, `45¢`, `$0.45`, "forty five cents". Time accepts `4:02`, `402`, "four oh two P M".
5. **Privacy.** No backend and no accounts. Data stays in `localStorage` on the device.

## Extending
Add a topic: create a `Topic` in `src/content/generators/*.ts`, register it in `topics.ts`, run `npm test`.
The generic test suite covers it automatically.

## Possible next steps
- Angular shell (to match the team's main stack) reusing `core/` + `content/` unchanged.
- Optional cloud sync (Firebase/Supabase) for parents and teachers. Teacher dashboard.
- On-device recognition (Chrome `processLocally`) when it is widely available, for full offline voice.
- LLM tutor turn (Claude API) for open-ended "why is my answer wrong?" questions, kept behind a parent toggle.
