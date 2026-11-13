# Math Coach: state and workflow model

The states and transitions behind the use cases in `docs/USE-CASES.md` (ids in brackets). Every threshold and
rule here is read from the code (file references given); diagrams are Mermaid and render on GitHub.
As of 2026-11-13 (step053).

## 1. The daily loop (end to end)

```mermaid
flowchart LR
  open([Open app]) --> access{Signed in?}
  access -- no --> signin[Cloudflare Access: email code] --> home
  access -- yes --> home[Home: Today card]
  home --> practice[Practice round]
  home --> review[Review due]
  home --> test[Test]
  home --> learn[Learn a topic]
  learn --> practice
  practice --> roundEnd[Round end: score, try missed again]
  review --> roundEnd
  test --> results[Test results]
  roundEnd --> sync[(Sync to parent dashboard)]
  results --> sync
  roundEnd --> goal{Goal met?}
  goal -- yes --> done[Done for today]
  goal -- no --> home
```

Use cases: A1, B1–B18, C1–C6, E1–E2, F3.

## 2. One problem card (coaching)

`core/coach.ts` (`maxTries = 2`), `ui/problemCard.ts`. [B4–B7, B10]

```mermaid
stateDiagram-v2
  [*] --> Asking: question shown (read aloud if on)
  Asking --> Asking: unclear voice answer ("did not catch an answer")
  Asking --> Hinted: Hint (setup steps of the picture, never the answer)
  Hinted --> Hinted: another Hint
  Asking --> SecondTry: wrong (misconception message + hint)
  Hinted --> SecondTry: wrong
  Asking --> Solved: correct (first try counts if no hint)
  Hinted --> Solved: correct
  SecondTry --> Solved: correct ("you kept going")
  SecondTry --> Revealed: wrong again (2 tries) → answer + explanation
  Asking --> Revealed: Answer / "explain" / "skip"
  Asking --> Revealed: time up (Learn mode, Each clock)
  Solved --> [*]: Next (hands-free: automatic)
  Revealed --> [*]: Next
```

Outcome recorded: `correct`, `firstTry` (correct, no hint, first try), `hints`, `seconds`, first wrong answer.
A card that ends **Revealed** or not on the first try goes to Review (§4).

## 3. A practice round

`screens/practice.ts`, `ui/roundEnd.ts`, `state.rounds`. [B2, B11–B14, B17]

```mermaid
stateDiagram-v2
  [*] --> Card: pickTopic (weak and stale topics weighted up)
  Card --> Card: next card (progress dots: ok / miss / now)
  Card --> Peek: ‹ or a tapped dot
  Peek --> Peek: Try again on a missed one (counts as a fix)
  Peek --> Card: Back to question n
  Card --> RoundEnd: last card
  RoundEnd --> Retry: Try missed again (same ids, review mode)
  Retry --> RoundEnd: each fix raises the score (7 → 9 of 10)
  RoundEnd --> Saved: state.rounds[grade:kind] updated → sync
  Saved --> [*]
```

Topic weights (`core/mastery.pickTopic`): untried 1.6; tried `0.25 + (1 − mastery) × 1.5 + min(staleDays, 7) × 0.08`;
the previous topic is avoided.

## 4. Spaced review (Leitner boxes)

`core/storage.ts` (`BOX_DAYS = [0, 0, 1, 3, 7, 14]`, indexed by box: box 2 waits 1 day, box 3 3, box 4 7, box 5 14; box 1 and a wrong answer are due now). [B18]

```mermaid
stateDiagram-v2
  [*] --> Box1: missed anywhere (or missed again) → due now
  Box1 --> Box2: right → due in 1 day
  Box2 --> Box3: right → due in 3 days
  Box3 --> Box4: right → due in 7 days
  Box4 --> Box5: right → due in 14 days
  Box5 --> Mastered: right in box 5
  Box2 --> Box1: wrong
  Box3 --> Box1: wrong
  Box4 --> Box1: wrong
  Box5 --> Box1: wrong
  Mastered --> [*]: removed from the queue
```

Only items for the current grade that are due show on Home (Review count) and the app badge (G3).

## 5. Mastery, level and stars

`core/storage.recordAttempt`, `core/mastery.levelFor`, `core/progress.STAR_RULES`. [B15]

- **Mastery** after each attempt: `m ← 0.75·m + 0.25·(correct ? 1 : 0)`.
- **Level** (difficulty of the next problem): fewer than 2 attempts → 1; mastery ≥ 0.8 and ≥ 4 attempts → 3;
  mastery ≥ 0.5 → 2; else 1.
- **Stars** never go down:

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Zero
  Zero --> One: mastery ≥ 0.5 and ≥ 2 attempts
  One --> Two: mastery ≥ 0.8 and ≥ 4 attempts
  Two --> Three: mastery ≥ 0.9 and ≥ 8 attempts
  note right of Three: a star increase is celebrated, stars never decrease
```

## 6. Tests

`screens/test.ts`, `core/session.ts`. [C1–C6]

```mermaid
flowchart TD
  setup[Setup: questions 6/10/15/20, Mode, Clock] --> mode{Mode}
  mode -- Learn --> learn[Coached cards §2]
  learn --> lclock{Clock}
  lclock -- Each: time up --> reveal[Answer revealed, next card]
  lclock -- Total: time up --> lend[Session ends]
  learn --> lend
  mode -- Test --> tclock{Clock}
  tclock -- Off / Total --> paper[All questions on one page]
  paper -- Hand in, or Total time up --> grade[Score + results]
  tclock -- Each --> each[One at a time]
  each -- Next, or time up moves on --> each
  each -- last question --> grade
  grade --> meet[(meets record)]
  grade --> rev[Misses → Review §4]
  lend --> noMeet[No meets record]
```

Only **Test mode** writes a `meets` record (Progress, parent chart). The last minute of a clock warns (and is
announced when read-aloud is on).

## 7. Parent dashboard, sync and family data

`server/parent.ts`, `sync/sync.ts`, `screens/settings.ts`, `screens/parent.ts`. [F1–F10]

```mermaid
stateDiagram-v2
  [*] --> Off
  Off --> On: Settings → PIN → Turn on (first sync creates the family)
  On --> On: sync (attempts + snapshot incl. rounds, offline-first queue)
  On --> Viewing: dashboard link + PIN (remembered for the tab)
  Viewing --> On: Lock
  Viewing --> Viewing: Export CSV, tap a round question
  On --> Off: Turn off → family data deleted on the server
```

## 8. Parent email

`server/email.ts` (`TOKEN_DAYS = 3`, `NUDGE_AFTER_DAYS = [3, 7]`, `NUDGE_HOUR = 17`), `server/digest.ts`. [F11–F15]

```mermaid
stateDiagram-v2
  [*] --> NoEmail
  NoEmail --> Unconfirmed: Add email → confirmation link (valid 3 days)
  Unconfirmed --> Confirmed: link opened (public confirm route)
  Unconfirmed --> NoEmail: removed
  Confirmed --> Confirmed: weekly digest (Sunday from 5 pm Central, catch-up until 6 am Monday) if Weekly on
  Confirmed --> Confirmed: nudge if Practice reminders on (see below)
  Confirmed --> Confirmed: Send test (logged: sent or refusal)
  Confirmed --> Confirmed: one-click unsubscribe (weekly or nudges off)
  Confirmed --> NoEmail: removed
```

Nudges: the first after **3** idle days, the second after **7**, at most 2 per break, only at **5 pm America/Chicago**,
never on Sunday; practising again resets the count.

## 9. Device reminders (web push)

`notify/reminders.ts`, `server/push.ts`, `functions/api/hourly.ts`. [G1–G3]

```mermaid
flowchart TD
  hourly[Hourly job] --> due{Chosen hour, local time?}
  due -- no --> skip1[Skip]
  due -- yes --> today{Practised today?}
  today -- yes --> skip2[Skip]
  today -- no --> idle{Idle ≥ 14 days?}
  idle -- yes --> paused[Paused]
  idle -- no --> send[Push: tap opens Practice]
```

Opt-in in Settings, hours 6–21, at most one a day; on iPad only from the Home Screen app.

## 10. Feedback triage

`ui/feedbackSheet.ts`, `server/userFeedback.ts`, `scripts/feedback.mjs`. [H1–H4]

```mermaid
stateDiagram-v2
  direction LR
  [*] --> New: Send (rate-limited 10/h per install, 200/day) → owner emailed
  New --> Triaged: Actions → Feedback
  New --> Done
  New --> Wontfix
  Triaged --> Done
  Triaged --> Wontfix
```

Message text never goes into GitHub (issues or logs).

## 11. App version and sign-in

`src/pwa.ts`, `public/push-sw.js`. [A1–A3]

```mermaid
stateDiagram-v2
  [*] --> Running
  Running --> Checking: open, back to foreground, or hourly
  Checking --> Running: no update
  Checking --> Updated: new version installed → reload
  Checking --> SignIn: sign-in expired → offline copy dropped → sign-in page
  SignIn --> Running: email code
  Updated --> Running
```

## 12. Scheduled jobs

`.github/workflows/hourly.yml` → `POST /api/hourly` (bearer `CRON_SECRET`); each part decides if it is due:
weekly digest (§8), nudges (§8), device reminders (§9). Deploys: push to `main` → check → D1 migrations →
Pages → smoke tests → custom-domain check (H6).
