# Math Coach: use-case catalog

Every use case below is grounded in shipped code (file references are to `src/`, `server/`, `functions/` and
`.github/workflows/`), except the **Open / planned** section, which lists only work recorded in `docs/` and
`docs/prompts-history/` (there is no separate roadmap). Status as of 2026-11-13 (step053).

**Actors**

| Actor | Who | Device |
|---|---|---|
| **Child** | Grade 2–3 student practising for CML and CogAT | iPad (Home Screen app or Safari) |
| **Parent** | Follows progress, sets up sync, email and reminders | Own phone or computer, plus the child's iPad for setup |
| **Tester** | Invited family trying the app | Any, signed in through Cloudflare Access |
| **Owner** | Maintainer: deploys, triages feedback, checks health | GitHub Actions + Cloudflare |
| **System** | The hourly job, the service worker and the email/push senders | Cloudflare Pages Functions, D1, SES, Web Push |

Status: **Shipped** (in `main` and deployed) · **Open / planned** (recorded but not built).

---

## A. Getting in and set up

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| A1 | Sign in to the private app | Child, Parent, Tester | Open any page → Cloudflare Access asks for the invited email → one-time code → app loads | Cloudflare Access (`scripts/cloudflare-access.mjs`), `functions/_middleware.ts` → `server/guard.ts` | Shipped |
| A2 | Install on the iPad Home Screen | Parent | Safari → Share → Add to Home Screen → app runs offline from the service worker | `src/pwa.ts`, vite-plugin-pwa | Shipped |
| A3 | Get the new version | System | App opened, brought to front, or hourly → update check → new version installs; expired sign-in → offline copy dropped, reload to sign-in | `src/pwa.ts`, `public/push-sw.js` | Shipped |
| A4 | Set name and grade | Child, Parent | Settings → name; Home or CogAT → Grade 2 / Grade 3 switch | `screens/settings.ts`, `ui/session.gradeSwitch` | Shipped |
| A5 | Choose voice, speed, read-aloud, hands-free | Parent | Settings → Voice (Natural / This device), Speed, Read aloud, Hands-free | `screens/settings.ts`, `voice/speech.ts` | Shipped |
| A6 | Choose highlight style | Parent, Child | Settings → Highlights → Neon (default) / Classic; mirrored to `<html data-hl>` | `core/storage.ts` (`highlight`), `ui/dom.applyHighlight`, `styles.css` | Shipped |
| A7 | Set the daily goal | Parent | Settings → Daily goal 5 / 10 / 15 / 20 | `core/progress.ts`, `screens/settings.ts` | Shipped |
| A8 | Reset progress on this device | Parent | Settings → Reset progress → confirm → all local progress erased | `core/storage.reset` | Shipped |
| A9 | Read the privacy summary | Parent | Settings → Privacy | `screens/settings.privacyScreen` | Shipped |

## B. Practising (the child's daily loop)

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| B1 | See today at a glance | Child | Home → Today card: "3 of 10", streak 🔥, progress bar; main button Practice, or "Keep going" after the goal | `screens/home.ts`, `core/progress.ts` | Shipped |
| B2 | Practise a mixed round | Child | Home → Practice → adaptive mix of CML topics at the child's level, one card at a time | `screens/practice.ts`, `core/mastery.ts`, `content/topics.ts` | Shipped |
| B3 | Practise one topic | Child | Learn → topic → Practice (`#/practice/<topic>`) | `screens/practice.ts` | Shipped |
| B4 | Answer by typing, tapping or voice | Child | Type + Check / Enter; tap a choice (checks at once); place digits on a board; mic → spoken answer ("forty five cents") | `ui/problemCard.ts`, `ui/choicePicker.ts`, `ui/placementBoard.ts`, `voice/recognition.ts`, `core/answer.ts` | Shipped |
| B5 | Get coached on a wrong answer | Child | Wrong → targeted misconception message, hint shown, one more try; second miss → answer + explanation | `core/coach.ts`, `ui/problemCard.ts` | Shipped |
| B6 | Ask for a hint | Child | Hint → next hint text; the explanation picture shows its setup steps (never the answer) | `core/coach.ts`, `ui/player.ts` (hint mode, stops before `reveal`) | Shipped |
| B7 | See the answer and the animated explanation | Child | Answer → answer shown, voiced step-by-step scene plays | `core/explain.sceneFor`, `ui/player.ts` | Shipped |
| B8 | Control an explanation | Child, Parent | Replay, back, play / pause, next, mute, speed 1× / 1.5× / 0.75×, Space / arrows | `ui/player.ts` | Shipped |
| B9 | Have the question read aloud | Child | Automatically (Read aloud on) or the speaker button; natural voice with device fallback; `**` markers never spoken | `voice/speech.ts` (`prepareForSpeech`), `functions/api/tts.ts` | Shipped |
| B10 | Practise hands-free | Child | Settings → Hands-free → each question read, then listening; voice commands: repeat, hint, explain, skip, next, slower, faster, stop, help | `voice/recognition.ts` (`parseCommand`), `ui/problemCard.ts` | Shipped |
| B11 | Look back mid-round | Child | ‹ next to the progress dots, or a tapped dot → earlier question: answer vs right one, explanation, Try again on a missed one | `ui/roundEnd.peekRound` | Shipped |
| B12 | Finish a round | Child | Last card → score (first tries), one line of feedback, right/total per question type, every question | `ui/roundEnd.ts`, `core/feedback.ts` | Shipped |
| B13 | Try missed questions again | Child | Round end → Try missed again → same problems in review mode; each fix raises the score ("7 → 9 of 10") | `ui/roundEnd.ts` | Shipped |
| B14 | Reopen the last round | Child | Home → Last round (latest of math/review), or CogAT → Last round (`#/round/<kind>`) | `screens/round.ts`, `state.rounds` | Shipped |
| B15 | Earn stars and celebrate a level-up | Child | Adaptive level rises → ★ / ★★ / ★★★ on the topic (never go down), celebration | `core/mastery.ts`, `core/progress.ts`, `ui/session.celebrate` | Shipped |
| B16 | Keep a streak | Child | Practise on consecutive local days; one missed day per week forgiven; no loss-framed copy | `core/progress.ts`, `core/storage.dayStreak` | Shipped |
| B17 | Stop when the goal is met | Child | Goal reached → "Done for today" becomes the main action (no endless play) | `screens/home.ts`, `screens/practice.ts` | Shipped |
| B18 | Review missed problems (spaced) | Child | Home → Review (count shown when due) → missed problems come back on a spaced schedule | `screens/review.ts`, `core/storage.dueReviews` | Shipped |

## C. Tests (contest practice)

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| C1 | Set up a test | Child, Parent | Test → Questions 6/10/15/20, Mode Learn/Test, Clock Off/Total/Each + time; remembered in `settings.test` | `screens/test.ts`, `core/session.ts` | Shipped |
| C2 | Take a paper-style test | Child | Test mode + clock Off or Total → all questions on one page → Hand in (asks if any are blank); time up hands in | `screens/test.runPaper`, `ui/answerCard.ts`, `ui/clock.ts` | Shipped |
| C3 | Take a one-at-a-time timed test | Child | Test mode + Each → one question per screen; time up moves on | `screens/test.runEach` | Shipped |
| C4 | Take a coached test | Child | Learn mode → coached cards; Each: time up reveals the answer; Total: time up ends the session | `screens/test.runLearn` | Shipped |
| C5 | See test results | Child | After hand-in → score, time, every question with yours vs the right answer, Explain plays the scene; misses go to Review | `screens/test.finishTest`, `ui/roundEnd.compareAnswer` | Shipped |
| C6 | Track test history | Child, Parent | Only Test mode writes a `meets` record → Progress → Tests (best score highlighted) and the parent chart | `state.meets`, `screens/progress.ts`, `ui/charts.meetChart` | Shipped |

## D. CogAT-style reasoning

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| D1 | Browse CogAT question types | Child | Home → CogAT → 9 types with stars, grade switch, Last round | `screens/cogat.ts` | Shipped |
| D2 | Practise CogAT | Child | CogAT → a type, or the mix (`#/practice/cogat`) → multiple choice: 3 picture choices read aloud (Grade 2), 5 word choices (Grade 3) | `content/cogat/*`, `cogat/common.mc` | Shipped |
| D3 | Kept separate from CML | System | `topicsForGrade` returns CML only, so CML mixes, tests, progress and stars never include CogAT | `content/topics.ts` | Shipped |

## E. Learning (before practising)

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| E1 | Browse topics by category | Child, Parent | Home → Learn → topics grouped by category, with stars | `screens/learn.learnScreen` | Shipped |
| E2 | Study a topic | Child | Learn → topic → the idea (read aloud), tips, "Watch out", an animated example, Practice | `screens/learn.topicScreen` | Shipped |
| E3 | Learn the problem-solving method | Child, Parent | Learn → How to solve any problem → four steps, strategies, contest-day tips | `screens/learn.strategiesScreen` | Shipped |
| E4 | See own progress | Child | Home → Progress → day streak, stars, first-try %, Practice next (weakest), Tests | `screens/progress.ts` | Shipped |

## F. Parent: dashboard, sync and email

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| F1 | Turn on the parent dashboard | Parent | Settings → Parent dashboard → choose a PIN → Turn on → family created on first sync | `screens/settings.parentGroup`, `POST /api/sync` → `server/parent.sync` | Shipped |
| F2 | Share the dashboard link | Parent | Settings → Share dashboard link (share sheet) or Open dashboard | `screens/settings.ts` | Shipped |
| F3 | Sync the child's practice | System | Offline-first: attempts queue locally, upload when online; saving a round triggers a sync | `sync/sync.ts`, `server/parent.sync` | Shipped |
| F4 | Open the dashboard with the PIN | Parent | `#/parent/<familyId>` → PIN (remembered for the tab only) → `POST /api/parent` | `screens/parent.ts`, `server/parent.authorize`, `readDashboard` | Shipped |
| F5 | Read the week | Parent | Dashboard → tiles (problems, first-try %, minutes, days, change vs last week), tips, 30-day chart, Needs help / Building / Strong, test chart | `core/insights.summarize`, `ui/charts.ts` | Shipped |
| F6 | Look into the last rounds | Parent | Dashboard → rounds newest first → tap a question → child's answer vs the right one + the explanation | `insights.lastRounds`, `ui/roundEnd.answerReview` | Shipped |
| F7 | Look at mistakes | Parent | Dashboard → Mistakes: question, child's answer, right answer | `screens/parent.ts`, `insights.summarize` | Shipped |
| F8 | Export the data | Parent | Dashboard → Export CSV | `screens/parent.csv` | Shipped |
| F9 | Lock the dashboard | Parent | Dashboard → Lock (forgets the PIN for the tab) | `screens/parent.ts` | Shipped |
| F10 | Turn the dashboard off | Parent | Settings → Turn off → family data deleted on the server | `server/parent.deleteFamily` | Shipped |
| F11 | Add an email for the weekly digest | Parent | Dashboard → Email → Add → confirmation email → confirm link (public bypass) | `server/email.setEmail`, `confirmEmail`, `functions/api/email/confirm.ts` | Shipped |
| F12 | Get the weekly digest | System → Parent | Sunday from 5 pm Central (catch-up until 6 am Monday) → email: the week's summary and a button to open Math Coach; unsubscribe link | `server/digest.buildDigest`, `email.sendWeekly`, `functions/api/weekly.ts` | Shipped |
| F13 | Get inactivity nudges | System → Parent | 3 days idle, then 7; max 2 per break; 5 pm Chicago; never Sunday | `server/email.sendNudges` | Shipped |
| F14 | Choose which emails / unsubscribe | Parent | Dashboard → Email → Weekly email / Practice reminders checkboxes; one-click "turn off reminders" / unsubscribe link | `email.setPrefs`, `stopEmail`, `unsubscribe` | Shipped |
| F15 | Send a test email | Parent | Dashboard → Send test → logged (sent or refusal reason) | `server/email.testEmail` | Shipped |

## G. Reminders on the device

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| G1 | Turn on a daily device reminder | Parent | Settings → Reminder → hour → permission → web push subscription (iPad: Home Screen app only) | `notify/reminders.ts`, `server/push.subscribe` | Shipped |
| G2 | Receive the reminder | System → Child | Hourly job at the chosen hour → push (skipped if practised today, paused after 14 idle days) → tap opens Practice | `server/push.ts`, `public/push-sw.js` | Shipped |
| G3 | See reviews due on the app icon | Child | Number of reviews due shown as the app icon badge (Badging API; iPad: Home Screen app + notification permission) | `notify/reminders.updateBadge` | Shipped |

## H. Feedback, testing and operations

| ID | Use case | Actor | Trigger → flow | Code | Status |
|---|---|---|---|---|---|
| H1 | Send feedback from the app | Child, Parent, Tester | Speech-bubble → Problem / Idea → message → Send; screen, problem id and grade attached | `ui/feedbackSheet.ts`, `server/userFeedback.ts` | Shipped |
| H2 | Rate-limit feedback | System | 10 per hour per install, 200 per day app-wide | `server/userFeedback.ts` | Shipped |
| H3 | Be told about new feedback | System → Owner | Each message emailed to `FEEDBACK_TO` (else `MAIL_REPLY_TO`) | `server/userFeedback.ts`, `server/ses.ts` | Shipped |
| H4 | Triage feedback | Owner | Actions → Feedback → list ids/screens/statuses → set triaged / done / wontfix + note (text never in GitHub) | `.github/workflows/feedback.yml`, `scripts/feedback.mjs` | Shipped |
| H5 | Run the tester programme | Tester, Owner | `docs/TESTING.md` cases (A–H, H1–H9) → replies triaged by case id | `docs/TESTING.md` | Shipped |
| H6 | Deploy | Owner | Push to `main` → check, D1 migrations, Pages deploy, smoke tests, custom-domain check | `.github/workflows/deploy-cloudflare.yml`, `scripts/ensure-d1.mjs` | Shipped |
| H7 | Check production health | Owner | Actions → Status (read-only): health, email log, live API probe | `.github/workflows/status.yml`, `scripts/status.mjs`, `scripts/probe.mjs` | Shipped |
| H8 | Run the scheduled jobs | System | `hourly.yml` → `POST /api/hourly` (bearer) → each part decides if due: digest, nudges, push | `functions/api/hourly.ts` | Shipped |
| H9 | Keep crawlers and AI agents out | System | robots.txt, `X-Robots-Tag`, meta; crawlers get 403; Access on every host | `server/guard.ts` | Shipped |
| H10 | Manage sign-in access and the voice rate limit | Owner | Actions → Cloudflare Access (invited emails) / Cloudflare rate limit (WAF rule on `/api/tts`, requests per IP) | `cloudflare-access.yml`, `cloudflare-rate-limit.yml` | Shipped |

## Open / planned (recorded, not built)

| ID | Item | Source | Status |
|---|---|---|---|
| P1 | Custom MAIL FROM domain and published DMARC records for the email sender | prompts-history (SES setup) | Open |
| P2 | SES production access (out of the sandbox), so the digest reaches any address | prompts-history (step on first SES delivery) | Open: depends on AWS |
| P3 | Reply to the testers' feedback rounds already triaged (Areas 1–3) | prompts-history step043 | Open |
| P4 | Verify the iPad's first real dashboard turn-on in production (the DB had never received one) | prompts-history (probe follow-up) | Open: needs the iPad |
| P5 | Move GitHub Actions off the deprecated Node 20 actions (warning only) | prompts-history (deploy note) | Open |

Not in scope today (no record in the repo of plans for them): accounts with passwords, multiple children per
family, teacher/classroom views, payments.
