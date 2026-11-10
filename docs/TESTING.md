# Math Coach: tester guide

Thank you for testing! Math Coach is a voice-first practice app for kids in Grades 2–3. It covers Continental Math League (CML) math and CogAT-style reasoning. A child practices on an iPad, and a parent follows along on their own device.

**App:** https://cml-math-coach.seolith.com
**Time needed:** about 60–90 minutes, split over 2–3 days if you can, so you also see the streak, Review and reminders.

## 1. Before you start

| | |
|---|---|
| **Best device** | iPad with Safari (the main target). Also useful: iPhone Safari, Android Chrome, desktop Chrome/Safari/Edge. |
| **Install** | In Safari, open the link, tap once on the page, then **Share → Add to Home Screen**. Open it from the new icon. (Do some tests in the Safari tab too: voice answers only work there.) |
| **Sound** | Turn the volume up and the silent switch off. The app talks. |
| **Microphone** | Allow it when asked (voice answers). On iPad: **Settings → General → Keyboard → Enable Dictation** must be on. |
| **Your data** | Use a made-up child name. Everything stays on the device unless you turn on the parent dashboard (step 5). |
| **Reset** | Settings → **Reset progress** starts over. |

Setup steps:

1. Open the app. On Home, pick **Grade 2** or **Grade 3**.
2. Tap the gear (top right) → type a child **Name**, pick a **Voice** (try *Natural*), turn on **Read aloud**.
3. Go back to Home.

## 2. Your focus area

Everyone runs the **smoke test** (section 3). Then spend most of your time on the area in your invite email, and explore anything else you like.

| Area | Focus | Test cases |
|---|---|---|
| 1 | Parent dashboard, emails, reminders, sync | D1–D8, N1–N3, X3 |
| 2 | Math practice, tests, review, goals and stars | P1–P8, T1–T4, R1–R2, E1–E3 |
| 3 | CogAT (Grade 2 *and* Grade 3) | C1–C8 |
| 4 | Explanations, voice and accessibility | H1–H3, V1–V5, X1–X2 |
| 5 | Other devices and browsers, offline, edge cases | X1–X6, plus the smoke test on every device you have |

## 3. Smoke test (everyone, ~10 minutes)

| ID | Steps | Expected |
|---|---|---|
| S1 | Open the app, set Grade, Name, Voice (section 1). | Home shows the grade switch, the **Today** card ("0 of 10") and rows Test, Learn, CogAT, Progress. |
| S2 | Home → **Practice**. Answer 10 problems (type, or tap the mic and say it). Get some wrong on purpose. | A dot per problem (green/red). Right answers are praised; wrong answers get a specific tip. |
| S3 | At the end of the round, look at the summary. | Score ("7 of 10"), one line of feedback, **By type**, and the list of **Questions** with ✓/✗. |
| S4 | Home → **CogAT** → **Practice**. Answer a few by tapping a picture or word. | Choices are big tap targets; a tap checks immediately. |
| S5 | Close the app completely and reopen it. | Progress is kept; Home shows **Last round**. |

## 4. Test cases

Mark each one **Pass / Fail / Blocked** (see section 6 for how to report).

### Practice (math)

| ID | Steps | Expected |
|---|---|---|
| P1 | Practice: type an answer with units, e.g. `45¢`, `$1.25`, `4:05 PM`, `Tuesday`. | Accepted in the natural forms a child would write. |
| P2 | Give a wrong answer once. | Specific coaching (not just "wrong"); the field stays open for a second try. |
| P3 | Give a second wrong answer. | The answer appears and the animated explanation plays with voice-over. |
| P4 | On a new problem tap **Hint** once, then again. | Each tap shows a hint and plays the picture up to just *before* the answer, never giving it away. |
| P5 | Tap **Answer** without trying. | The full explanation plays; the problem counts as missed. |
| P6 | At the round summary tap a question in **Questions**. Then **Back**, then **Next question**. | The question, your answer vs the right one, and the explanation playing. Navigation works. |
| P8 | Mid-round, tap **‹** (left of the progress dots) or any answered dot. Use ‹ › to move between earlier questions; on a missed one tap **Try again**; then **Back to question N**. | Each earlier question shows your answer vs the right one and its explanation. A fixed one counts at the end ("6 → 7 of 10"). The current question comes back exactly as you left it (typed answer kept). Not offered during a scored Test. |
| P7 | At the summary tap **Try missed again** and get them right. | The score updates, e.g. **"6 → 9 of 10"**, and the feedback says what you fixed. Leave the app midway, reopen via Home → **Last round**: the improved score is kept. |

### CogAT

| ID | Steps | Expected |
|---|---|---|
| C1 | Grade 2: CogAT → **Practice** (a round of 10). | Picture questions, **3** choices, questions read aloud. |
| C2 | Grade 3: same. | Word/number questions, **5** choices. |
| C3 | CogAT screen: open each of the 9 types (Verbal: analogies, sentence completion, classification · Quantitative: number analogies, puzzles, series · Nonverbal: matrices, paper folding, figure classification). | Each has a lesson, a worked example with an animation, and a **Practice** button. |
| C4 | Answer by voice: say the letter ("B") or the option name ("butterfly"). | The right choice is selected and checked. |
| C5 | Look closely at 20+ questions of each type. | Exactly **one** answer is defensible. Pictures are clear; nothing is cut off; no two choices look identical. **Report anything ambiguous.** |
| C6 | Paper folding: watch the explanation. | Each fold opens in turn and the holes mirror across the fold line. |
| C7 | Finish a CogAT round, leave, then CogAT → **Last round**. | The same summary, explanations and **Try missed again**. |
| C8 | Check Learn, Progress and Tests. | CogAT questions do **not** appear in the math sections. |

### Tests

| ID | Steps | Expected |
|---|---|---|
| T1 | Home → **Test** → Mode **Test**, Clock **Total**, 6 questions → **Start**. | All questions on one page, a countdown. Submitting shows the score, your answer vs the right one, and **Explain** per question. |
| T2 | Mode **Test**, Clock **Each**. | One question at a time; when time runs out it moves on. |
| T3 | Mode **Learn**, Clock **Each**. Let the timer run out. | The answer and explanation appear. |
| T4 | Mode **Learn**, Clock **Total**. Let it run out. | The session ends with a summary. |

### Review, goals, stars

| ID | Steps | Expected |
|---|---|---|
| R1 | After missing some problems, Home → **Review**. | The missed problems come back (the same problems). End-of-round summary as in S3. |
| R2 | Come back the next day. | Review shows the problems that are due again. |
| E1 | Reach the daily goal (Settings → **Daily goal**, try 5). | A celebration; Home says **Done for today** as the main action. |
| E2 | Practice on two days in a row. | A 🔥 streak on Home. Skip a day: one missed day per week is forgiven. |
| E3 | Do well in one topic for several problems. | A level-up (★) toast; stars show in Learn. |

### Explanations and voice

| ID | Steps | Expected |
|---|---|---|
| H1 | In any explanation use the controls: ⟲ replay, ‹ back, ▶/❚❚, › next, speed (1× / 1.5× / 0.75×), speaker on/off. | All work; the counter ("3 / 7") is right; speed changes both the animation and the voice. |
| H2 | Watch 10+ explanations (mix of math and CogAT). | The picture matches what is said; numbers are right; nothing overlaps or is cut off. |
| H3 | Learn → any topic. | The idea, tips, "watch out", and an animated example. |
| V1 | Settings → Voice: try *Natural* voices and *This device* voices, and **Speed**. | The voice changes; natural voices sound human. |
| V2 | Read aloud on: start a problem. | The question is read automatically. |
| V3 | In Safari (not the Home Screen app): Settings → **Hands-free** on. Answer by voice; say "hint", "repeat", "explain", "skip", "next", "slower", "faster", "stop". | Each command works. (Apple blocks the microphone in Home Screen apps; that is expected.) |
| V4 | Say answers in different ways: "forty five cents", "four oh five P M". | Understood. |
| V5 | Tap the speaker on a problem while another sound plays. | No overlapping voices. |

### Parent dashboard and email

| ID | Steps | Expected |
|---|---|---|
| D1 | Kid device: Settings → **Parent dashboard** → set a PIN (4–8 digits) → **Turn on**. | A **Share dashboard link** row appears. |
| D2 | Open the link on a *different* device and enter the PIN. | The dashboard shows the problems, first-try %, minutes, days, charts and topics. |
| D3 | Practice a round on the kid device; refresh the dashboard. | New data within a minute, including the round sections (e.g. **CogAT · Tue, Nov 10** with the score and every question). |
| D4 | On the dashboard tap a question in a round section. | Your child's answer vs the right one, and the explanation plays. |
| D5 | Check the **Mistakes** list. | Each says what happened: "Showed the answer", "Skipped", "Right after a hint", the wrong answer, or "(b) octopus" for a choice. |
| D6 | Dashboard → **Email** → enter your address → **Add**. | A confirmation email arrives (check spam). Clicking it confirms. *If nothing arrives within 10 minutes, report it as Blocked; it may mean the sender is still restricted.* |
| D7 | After confirming: **Send test**. | A weekly summary email with KPIs, the chart, **CogAT** (if you did CogAT), and Mistakes. Links work. |
| D8 | Wrong PIN 5 times. **Lock**. **Export CSV**. | Locked for a while after 5 tries; Lock asks for the PIN again; the CSV downloads. |

### Reminders (iPad/iPhone Home Screen app, or desktop Chrome)

| ID | Steps | Expected |
|---|---|---|
| N1 | Settings → **Reminder** → **Daily reminder** on → allow notifications → pick a time 1–2 hours from now. | Saved without errors. |
| N2 | Don't practice that day. | One notification at that hour; tapping it opens Practice. |
| N3 | Practice before the reminder time. | No notification that day. |

### Devices, offline, accessibility, edge cases

| ID | Steps | Expected |
|---|---|---|
| X1 | Turn on Dark Mode. Rotate the iPad. Try iPhone and a desktop browser. | Everything is readable, nothing overlaps, no sideways scrolling. |
| X2 | iPad **VoiceOver** basics; larger text size. | Buttons have names; the app stays usable. |
| X3 | Turn on Airplane mode, practice 10 problems, turn it off. | Practice works offline; the dashboard catches up after reconnecting. |
| X4 | Switch Grade 2 ↔ 3 mid-way. | Each grade keeps its own progress, stars and last rounds. |
| X5 | Tap fast, double-tap, press back mid-animation, lock the screen while the voice is talking. | No freezes, no double-counting, no voice that keeps talking after leaving. |
| X6 | Type nonsense answers, very long answers, emoji. | A gentle "I didn't understand" message, never a crash. |

## 5. What we especially want to know

- **Correctness:** any problem with a wrong answer key, two right answers, or an explanation that doesn't match. These matter most.
- **Kid-friendliness:** anything confusing for a 7–8 year old (words, pictures, voice speed).
- **Voice:** mishearing of answers, voices that cut off or overlap.
- **Look and feel:** layout glitches on your device.

## 6. How to report

Reply to the invite email (one email per issue, or one list) with:

```
Test case: C5 (or "exploratory")
Result: Fail
Device / OS / browser: iPad 10th gen, iPadOS 18.1, Home Screen app
Grade and screen: Grade 3, CogAT → Paper folding
Steps: 1) … 2) … 3) …
Expected: …
Actual: …
Screenshot or screen recording: attached
```

**Tip:** a screen recording (Control Center → Screen Recording) is the fastest way to show an animation or voice problem. For a wrong or ambiguous question, a screenshot of the question with the choices is enough; each question is reproducible from the screen.

At the end, please send a short summary: what you tested (the IDs with Pass/Fail), which devices you used, and your top 3 suggestions.
