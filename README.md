# CML Math Coach (Grades 2 & 3)

A voice-first **Progressive Web App** that helps children practice for the
**Continental Mathematics League (CML)** Grade 2 and Grade 3 meets. Each meet has 6 problems and lasts 30 minutes.
Each topic has a guide, and the voice coach reads problems, listens to spoken answers, gives hints,
recognises common mistakes and talks through worked solutions.

> The original CML papers were used only to study topic coverage and style.
> All problems in the app are **original and generated**, and no contest content is included.

## Features
| Area | What it does |
|---|---|
| 🎯 Smart practice | Adaptive mix. Weak or unseen topics come up more often. Difficulty (Warm-up → Contest → Challenge) follows mastery. |
| ⏱ Mock meet | 6 questions in 30 minutes. Difficulty rises through the paper, there's no feedback until you hand in, then you get per-question explanations. |
| 📚 Learn | 40 topics (36 for Grade 2 and 40 for Grade 3), each with an idea, tips, traps, a strategy and a step-by-step worked example. |
| 🧩 Puzzles | Palindromes (spot, complete with given digits, next palindrome) and digit-placement "magic sum" boards (plus shape, triangle, corner square). Tap a circle and then a digit, or say the digits in order. Any valid arrangement counts. |
| 👨‍👩‍👧‍👦 Family puzzles | Brothers & sisters logic ("Jill has as many sisters as brothers…"). Warm-up counting from one child's point of view, then direct-count + relation clues, then the classic two-relation puzzle (Grade 3). Each puzzle has exactly one solution, and the coach catches the "counted yourself" mistake. |
| 👨‍👩‍👧 Parent dashboard | Turn on in Settings with a parent PIN, then open the private link on your own phone or computer. It shows this week vs last week (problems, first-try accuracy, minutes, days), daily activity, mastery per topic (needs help / building / strong), mock meet scores, recent mistakes with the real question and the correct answer, plain-language suggestions, and CSV export. Data syncs to Cloudflare D1. |
| 📧 Weekly email | Every Sunday about 6 pm US Central. The parent adds an address on the dashboard (PIN), confirms it by email (double opt-in), and can send a test or stop at any time. Every email has one-click unsubscribe. Content: the week's numbers vs last week, a 7-day chart, needs-help and strong topics, the mock meet, mistakes with the correct answers, and ideas for next week. Sent through Amazon SES. |
| 🔁 Review | Missed problems go into a Leitner spaced-repetition queue and are re-asked as the *same* problem later. |
| 🧭 Toolkit | Pólya's 4 problem-solving steps, 10 strategies and contest-day tips, all read aloud. |
| 📈 Progress | Mastery per topic, accuracy, day streak, meet history and "next goals". |
| ✨ Premium voice | Natural neural voice (Deepgram Aura-2 on Cloudflare Workers AI, served by a Pages Function at `/api/tts`, cached at the edge and offline). There are 12 voices to choose from, and it falls back to the device voice automatically. |
| 🎤 Voice | Text-to-speech for everything. Speech recognition for answers ("forty two", "$1.25", "four oh two P M", "Monday", "Mrs. Chen") and commands (*repeat, hint, explain, skip, next, slower, faster, stop*). Hands-free mode chains read → listen → feedback → next. |
| 🧑‍🏫 Mistake coaching | Each generator lists likely wrong answers with a targeted explanation (e.g. "You counted the small triangles only"). After 2 tries the coach reads the worked solution step by step. |
| 📴 Offline | Service worker precaches the app. Recognition may still need the network in Chrome. |

## Quick start
```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npm run build && npm run preview
```
**Live app:** https://cml-math-coach.seolith.com (Cloudflare Pages, deployed from `main`, see [docs/DEPLOY.md](docs/DEPLOY.md)).
**iPad:** see [docs/IPAD.md](docs/IPAD.md). In short: open the link in Safari, then Add to Home Screen.

Open the printed URL in Chrome, Edge or Safari, allow the microphone, and install with "Add to Home Screen" / "Install app".
The microphone needs HTTPS or `localhost`.

## Browser support for voice
| Browser | Read aloud | Voice answers |
|---|---|---|
| Chrome / Edge (desktop & Android) | ✅ | ✅ (Google's service, needs network) |
| Safari macOS 14.1+ / iPadOS & iOS 14.5+ | ✅ | ✅ in a Safari tab, ❌ from a Home Screen icon (WebKit limitation) |
| Firefox | ✅ | ❌ behind a flag, so typing is used instead |

## Docs
- [Deployment (Cloudflare Pages)](docs/DEPLOY.md)
- [Using it on an iPad](docs/IPAD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Coaching guide & 8-week study plan](docs/STUDY-PLAN.md)
- [Research notes](docs/RESEARCH.md)
- [Prompt history](docs/prompts-history/README.md)
