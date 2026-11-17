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
- **World map instead of Home:** a winding path through 4 themed islands (Numbers Meadow, Coin Cove, Clock Tower, Puzzle Peaks). Each island holds a set of CML topics, and stars from the real mastery levels light up stepping stones.
  Today's goal shows as the stones still to cross today. When the goal is met, the buddy waves goodnight and "Done for today" stays the main action.
- **Buddy:** the child picks one of 4 original buddies (SVG, drawn in-house, named by the child). Each has idle, happy, thinking and cheer poses. The buddy walks one stone forward on each right answer.
  On a miss the buddy says "Let's look together" and the existing coaching hint opens.
- **Question screen:** the same `problemCard`, now on a bright, softly moving background (a gradient plus slow parallax shapes). The card itself stays white or dark with today's contrast.
  Neon key words stay. The progress dots become stepping stones.
- **Round end:** a confetti or bubble burst sized to the score, stickers for "first try", "fixed a miss" and "new star" (collected in a sticker book), then Try missed again as today.
- **Sound:** 3 soft instrumental loops (one per mood: map, practice, celebration), plus short effects (tap, right, level up). Played with Web Audio; the music ducks under the voice.
- **Not in game mode:** Tests stay calm and scored (contest rehearsal). Game mode only touches Home, Practice, Review, CogAT practice and round ends. The parent dashboard is unchanged.

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
2. **Buddy and world map (about 1–2 weeks):** buddy choice and poses, `#/world`, islands lit by stars, the goal shown as stones.
3. **Sound (about 3 days):** loops, effects, ducking, Settings switch and volume.
4. **Stickers and round-end celebration (about 3 days):** sticker book, sized celebrations, parent dashboard shows stickers.
5. **Tester round:** send the same tester family a build; feedback goes through the in-app Feedback button. Measure: days practised per week, rounds finished, and first-try % (game mode must not lower it), compared with Classic.

## Guardrails (unchanged rules, restated)

- The daily goal still ends play. No endless map, no "one more" prompts.
- No currency, shop, ads, purchases, leaderboards or loss-framed streaks.
- All art, music and characters are original or CC0. No characters or look from existing games.
- Question text is never animated or put over a moving background; explanations keep their current player.
- The app stays private (no new public routes); new assets are precached so it works offline.
