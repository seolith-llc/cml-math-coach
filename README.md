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
| 📚 Learn | 37 topics (33 for Grade 2 and 37 for Grade 3), each with an idea, tips, traps, a strategy and a step-by-step worked example. |
| 🔁 Review | Missed problems go into a Leitner spaced-repetition queue and are re-asked as the *same* problem later. |
| 🧭 Toolkit | Pólya's 4 problem-solving steps, 10 strategies and contest-day tips, all read aloud. |
| 📈 Progress | Mastery per topic, accuracy, day streak, meet history and "next goals". |
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
Open the printed URL in Chrome, Edge or Safari, allow the microphone, and install with "Add to Home Screen" / "Install app".
The microphone needs HTTPS or `localhost`.

## Browser support for voice
| Browser | Read aloud | Voice answers |
|---|---|---|
| Chrome / Edge (desktop & Android) | ✅ | ✅ (Google's service, needs network) |
| Safari macOS 14.1+ / iOS 14.5+ | ✅ | ✅ |
| Firefox | ✅ | ❌ behind a flag, so typing is used instead |

## Docs
- [Architecture](docs/ARCHITECTURE.md)
- [Coaching guide & 8-week study plan](docs/STUDY-PLAN.md)
- [Research notes](docs/RESEARCH.md)
- [Prompt history](docs/prompts-history/README.md)
