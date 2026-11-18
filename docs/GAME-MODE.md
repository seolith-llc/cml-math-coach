# Game mode: plan

**Why.** A tester's child did not find the look and colours interesting enough to keep going. The app's math engine works (adaptive levels, coaching, explanations, stars).
The calm, adult-style look is what's missing for some children. Game mode is a second **look and feel** for the same practice. It does not add new rules.

## What the research says (and what we take from it)

| Finding | Source (summary) | Design rule for us |
|---|---|---|
| Motivation lasts when play meets **competence, autonomy and relatedness** | Self-Determination Theory (Ryan & Deci); Przybylski, Rigby & Ryan on games | Show growth (levels, a world that fills in), let the child choose (world, buddy, colour), give the parent a way to cheer |
| Learning games work best when the **math *is* the game action** (intrinsic integration), not a quiz with prizes stuck on | Habgood & Ainsworth 2011; Kafai | Answering moves your buddy, builds the path, feeds the creature. No separate mini-game you can play instead of the math |
| **Rewards you expect for a task** can reduce interest | Deci, Koestner & Ryan 1999 (overjustification) | Small surprise rewards (sticker, buddy dance), not "pay per answer". No currency, no shop, no loot boxes |
| **Decorative extras hurt learning** when they compete with the problem (seductive details, extraneous load) | Mayer's multimedia principles; Sundararajan & Adesope 2020 | Colour and motion go **around** the question card, never on it. Animations play *between* questions. Question text stays high-contrast |
| Background music with lyrics or a strong beat hurts reading and working memory. Soft instrumental music affects it less, and it differs from child to child | Research on background music and working memory (Kämpfe et al. 2011 meta-analysis) | Music is instrumental, quiet and slow, **ducks to near silence while a question is read or being answered**, and has its own off switch (default: on in game mode, at low volume) |
| Quick, specific feedback with **juice** (bounce, sparkle, a sound) makes success feel good | Game feel / "juiciness" (Swink; Hunicke) | Right answer → short burst (≤ 600 ms) plus a chime. Wrong answer → gentle wobble, no buzzer, no red flash |
| Children under 8 respond to **characters and a story frame** | Kids' app design guides (Nielsen Norman Group on children; Apple HIG Kids) | One friendly buddy who reacts and talks in the coach voice; tap targets ≥ 60 pt; icons with spoken labels |
| Dark patterns (streak loss, timers to pressure, endless play) harm children | 5Rights / UK Age Appropriate Design Code; FTC guidance | Keep our rules: **no loss-framed copy, the daily goal ends play, no ads, no purchases, no leaderboards** |
| Movement can upset some children | WCAG 2.3.3; vestibular guidance | `prefers-reduced-motion` and a Settings switch replace motion with fades; no flashing over 3 Hz |

## The experience

- **Turn it on:** Settings → **Look**: *Classic* or *Game*. Game is offered (not forced) the first time the app opens after the update, with a 3-second preview.
- **World map instead of Home:** a winding path through 4 themed islands (Numbers Meadow, Coin Cove, Clock Tower, Puzzle Peaks). Each island holds a set of Number Puzzles topics, and stars from the real mastery levels light up stepping stones.
  Today's goal shows as the stones still to cross today. When the goal is met, the buddy waves goodnight and "Done for today" stays the main action.
- **Buddy:** the child picks one of 4 original buddies (SVG, drawn in-house, named by the child). Each has idle, happy, thinking and cheer poses. The buddy walks one stone forward on each right answer.
  On a miss the buddy says "Let's look together" and the existing coaching hint opens.
- **Question screen:** the same `problemCard`, now on a bright, softly moving background (a gradient plus slow parallax shapes). The card itself stays white or dark with today's contrast.
  Neon key words stay. The progress dots become stepping stones.
- **Round end:** a confetti or bubble burst sized to the score, stickers for "first try", "fixed a miss" and "new star" (collected in a sticker book), then Try missed again as today.
- **Sound:** 3 soft instrumental loops (one per mood: map, practice, celebration), plus short effects (tap, right, level up). Played with Web Audio; the music ducks under the voice.
- **Not in game mode:** Tests stay calm and scored (timed challenges). Game mode only touches Home, Practice, Review, Thinking Puzzles practice and round ends. The parent dashboard is unchanged.

## How it fits the code

| Piece | Where | Notes |
|---|---|---|
| Setting `look: 'classic' \| 'game'`, `music: { on, volume }`, `motion: 'full' \| 'reduced'` | `core/storage.ts` + `migrateSettings` + `tests/settings.test.ts` | Mirrored to `<html data-look>` like `data-hl` |
| Theme tokens | `styles.css` (a `[data-look=game]` block after the neon block) | Bright palette, rounded display font (self-hosted, OFL), larger tap targets. Text contrast ≥ 4.5:1 checked in both themes |
| World map screen | `screens/world.ts`, route `#/world` (Home redirects there when look = game) | Reads stars and the daily goal from `core/progress.ts`; islands defined in `content/world.ts` (topic → island) |
| Buddy | `ui/buddy.ts` (SVG poses and CSS keyframes) | Reacts to `ProgressEvent` and answer results through the existing `celebrate` hook |
| Effects | `ui/fx.ts` (confetti or bubbles on canvas, ≤ 600 ms, rAF, off under reduced motion) | Called from `problemCard` and `roundEnd` |
| Audio | `voice/music.ts` (Web Audio: loops, effects, ducking while `speech` talks or the mic listens) | Assets: CC0 or commissioned loops, ≤ 150 KB each, precached by the service worker |
| Stickers | `core/stickers.ts` (pure, tested) + `state.stickers` | Earned from existing events only; synced inside `snapshot` so the parent sees them (no schema change) |
| Tests | `tests/look.test.ts` (setting migration, sticker rules), Playwright screenshots of map/question/round end in both themes, an axe contrast pass | `npm run check` stays the gate |

## Phases

1. **Look and feel: shipped 2026-11-17 (step063)** (Settings → Look → Game, and Less motion; the first-run offer and the self-hosted font move to phase 2): the setting, game tokens and font, the bright background, stepping-stone dots, juicy right/wrong feedback, reduced motion. *Exit:* testers' children choose Game when offered, contrast passes, no change in first-try accuracy.
2. **Buddy and world map: shipped 2026-11-17 (step065); the first-run Game / Classic offer, the self-hosted Nunito font and a full-page background fix merged in step069 from a parallel phase 2.** Four original buddies (`content/buddies.ts`, 5 poses) chosen once on first open in the game look and changeable in Settings (no outfits or shop). The world map is Home in the game look (`screens/world.ts`): today's goal as stones, four islands (`content/world.ts`) lit by real stars, each opening to its topics as ≥ 100 px stones, plus an island mix (`#/practice/island-<id>`). In rounds the buddy walks the progress stones and reacts to every checked answer (effort-based, varied lines; `ui/buddy.ts`). Tester cases G1–G6.
3. **Sound: shipped 2026-11-17 (step066).** Music is composed in code (`core/tunes.ts`, pure and tested): three soft instrumental tunes the child picks from (Breeze, Bubbles, Stars) or Off, with no lyrics or drums and 64–80 bpm. It plays through Web Audio (`voice/music.ts`, no audio files, nothing to license). It's full (still soft) on map screens, about a third as loud on questions, ducks to near silence whenever the coach talks or the mic listens (`voice/activity.ts`), and is off in Tests and the parent area. Short effects: right (rising chime), miss (soft, low, never a buzzer), star, goal, buddy pick. Controls: Settings → Music (tune, volume, effects) and a ♪ switch in the top bar on every game-look screen where music plays (`ui/musicToggle.ts`; testers couldn't stop the music from a question when it was only on the map, step073). Audio starts on the first tap and pauses in the background. This replaces the plan's "one loop per mood" with the child's own pick (refinement 1). Tester cases G7–G9.
4. **Stickers and round-end celebration: shipped 2026-11-17 (step067).** At the end of a Practice, Thinking Puzzles or Review round in the game look, a celebration card appears above the score: the buddy cheers about effort ("You fixed every miss!", "What a careful round!", "You kept going. That's how we grow!"), with confetti sized to the score and a chime. Stickers are earned only at round ends, for **Fixed a miss** (first), **Explained it** (a right "How did you know?", step084), **New star**, **Today's goal** and **Careful round** (≥ 80 % first try, 5+ questions), at most 3 a day (`content/stickers.ts`, pure and tested). Fixing a miss later in the summary earns it then. The design is a surprise from 24 original designs (new ones first). The sticker book (`#/stickers`, a world-map row) shows only what was collected, with why and when: no empty slots and no "x of 24". Stickers sync in the snapshot, and the parent dashboard shows the latest 12 with their reasons. Reopening a saved round awards nothing. Tester cases G10–G12.
5. **Tester round: running from 2026-11-17 (step068).** Every finished Practice, Thinking Puzzles or Review round is logged once in either look (`state.roundLog`: look, tune, kind, grade, right, fixed and total; numbers only). The log syncs in the dashboard snapshot. Actions → **Status** prints *Game mode tester round (last 28 days)* per family (anonymous "Family N"): rounds, days, rounds per day, first-try % and fixes, for Classic vs Game and for Game with vs without music. It also flags when there isn't enough data (fewer than 5 rounds or 3 days on a side). The shared logic is `scripts/lib/experiment.mjs`, tested.
   **Protocol (2 weeks, per tester family with a child aged 7–9):** turn on the parent dashboard (so rounds sync). *Week 1:* Settings → Look → **Game**, music on (the child picks the tune). *Week 2:* still Game, Settings → Music → **Off** (effects can stay). The baseline is any Classic rounds plus the days practised before the switch (on the dashboard). Ask the child what they liked and didn't (buddy, map, music, stickers); feedback goes through the in-app Feedback button or a reply to the invite.
   **Decision rule:** keep the game look as an option if children practise on more days or finish more rounds with it, **and** first-try % doesn't drop by more than 5 points. Keep the music on by default only if first-try % with music isn't lower than without. With one or two families this is a signal, not proof; repeat with more families before changing defaults.

## Guardrails (unchanged rules, restated)

- The daily goal still ends play. No endless map, no "one more" prompts.
- No currency, shop, ads, purchases, leaderboards or loss-framed streaks.
- All art, music and characters are original or CC0. No characters or look from existing games.
- Question text is never animated or put over a moving background; explanations keep their current player.
- The app stays private (no new public routes); new assets are precached so it works offline.

## Second research pass (step064): refinements to phases 2–5

An independent search confirmed the table above and changes these details:

1. **Let the child pick the music (phase 3).** In adults, music *with lyrics* hurt memory and reading, while instrumental music had no credible effect on performance ([J. Cognition 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10162369/)). Students doing math did better with music *they chose* than with set music or silence ([Frontiers in Education 2025](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1613039/full)). There's no direct study of 7–9 year olds, so: instrumental only, a choice of the 3 loops (autonomy), plus "off". The phase 5 tester round compares first-try % with music on vs off.
2. **Keep the buddy from becoming the game (phase 2).** Critics of Prodigy report children's attention going to character customisation and membership prompts: [16 membership ads vs 4 math problems in a 19-minute session](https://fairplayforkids.org/pf/prodigy/). See also [NEPC](https://www.nepc.colorado.edu/sites/default/files/publications/Newsletter%20prodigy.pdf) and [EdWeek](https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02). So: choose and name the buddy once (changeable in Settings), no outfits or shop, and nothing to customise during a round.
3. **Big targets for the youngest (phases 1–2).** NN/g recommends touch targets of at least **2 cm × 2 cm** for young children, 4× the adult size ([NN/g](https://www.nngroup.com/articles/children-ux-physical-development/)). That's about 100 CSS px on an iPad. Use it for the world-map stones and the buddy's buttons; the multiple-choice tiles already come close. Taps, swipes and drags only: no double-tap or pinch ([Google, building for kids](https://developers.google.com/building-for-kids/designing-engaging-apps)).
4. **"Math is the move" is backed, but test it on our children (phase 2).** In Habgood & Ainsworth's division game, children in free play spent about **7×** longer on the version where the math was the game action ([Nottingham repository](https://nottingham-repository.worktribe.com/output/23577510)). It was one game with small samples, and later work warns it isn't automatically better ([PMC9049184](https://pmc.ncbi.nlm.nih.gov/articles/PMC9049184)). Phase 5 metrics decide.
5. **Praise effort and strategy, not ability (phases 1, 4).** Positive verbal feedback raised interest (d ≈ 0.33), while expected tangible rewards lowered it ([Deci, Koestner & Ryan 1999](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf)). Praise can also become controlling. Buddy lines name what the child did ("You checked both pairs!"), never "You're so smart", and vary so they don't become a payout.
