import { dayStreak, dueReviews, lastRound, load } from '../core/storage';
import { today } from '../core/progress';
import { summary } from '../core/session';
import { topicsForGrade } from '../content/topics';
import { ISLANDS, goalStones, islandById, islandProgress, type Island } from '../content/world';
import { h, list } from '../ui/dom';
import { gradeSwitch } from '../ui/session';
import { buddyName, buddyView } from '../ui/buddy';
import { savedScore } from './round';
import type { View } from '../app';

/** A small island picture (original shapes): sea, island, and its landmark. */
function islandArt(id: string): string {
  const land: Record<string, string> = {
    meadow: '<circle cx="34" cy="34" r="7" fill="#ffb703"/><text x="52" y="40" font-size="16" font-weight="800" fill="#1d5a2a" font-family="system-ui">123</text>',
    cove: '<circle cx="40" cy="36" r="10" fill="#ffd25a" stroke="#c98a00" stroke-width="2"/><circle cx="58" cy="38" r="8" fill="#ffd25a" stroke="#c98a00" stroke-width="2"/>',
    tower: '<rect x="42" y="14" width="16" height="30" rx="2" fill="#ef8354"/><circle cx="50" cy="24" r="6" fill="#fff"/><path d="M50 24 L50 20 M50 24 L53 25" stroke="#333" stroke-width="1.5"/>',
    peaks: '<path d="M26 44 L42 16 L58 44 Z" fill="#9b7bff"/><path d="M46 44 L60 24 L74 44 Z" fill="#7b5cff"/><path d="M38 23 L42 16 L46 23 Z" fill="#fff"/>'
  };
  return `<svg viewBox="0 0 100 60" aria-hidden="true"><ellipse cx="50" cy="48" rx="46" ry="10" fill="#7fd6f5" opacity=".7"/><ellipse cx="50" cy="44" rx="34" ry="10" fill="#8ac926"/><ellipse cx="50" cy="46" rx="34" ry="7" fill="#e9c46a" opacity=".55"/>${land[id] ?? ''}</svg>`;
}

/**
 * #/ in the game look: the world map. Today's goal as stepping stones with the buddy, four islands lit by
 * real stars, and everything Home has underneath. The daily goal still ends play ("Done for today").
 */
export function worldScreen(): View {
  const state = load();
  const s = state.settings;
  const grade = s.grade;
  const stats = state.stats[String(grade)] ?? {};
  const t = today({ log: state.log, goal: s.goal, reviewDue: dueReviews(state, grade).length, meets: state.meets.filter((m) => m.grade === grade) });
  const streak = dayStreak(state);

  const buddy = buddyView('big');
  const who = buddyName();
  if (t.goalMet) buddy.say(`We crossed today's stones! See you tomorrow.`, 'sleep', 6000, true);
  else if (t.practiced) buddy.say(`${t.goal - t.practiced} more stone${t.goal - t.practiced === 1 ? '' : 's'} today!`, 'happy', 4000);
  else buddy.say(s.name ? `Hi ${s.name}! Ready?` : 'Ready to explore?', 'happy', 4000);

  const stones = h('div', { class: 'goal-stones', role: 'progressbar', 'aria-label': `${t.practiced} of ${t.goal} today`, 'aria-valuemin': 0, 'aria-valuemax': t.goal, 'aria-valuenow': t.practiced },
    ...goalStones(t.practiced, t.goal).map((k) => h('span', { class: `goal-stone ${k}` })));


  const hero = h('section', { class: `card world-hero${t.goalMet ? ' met' : ''}` },
    h('div', { class: 'world-hero-top' }, buddy.el,
      h('div', { class: 'world-hero-side' },
        h('span', { class: 'today-count' }, t.goalMet ? 'Done for today' : `${t.practiced} of ${t.goal}`),
        streak ? h('span', { class: 'today-streak', 'aria-label': `${streak} day streak` }, `🔥 ${streak}`) : null,
        who ? h('span', { class: 'world-buddy-name' }, who) : null)),
    stones,
    t.goalMet
      ? h('div', { class: 'actions' }, h('a', { class: 'btn primary hero', href: '#/progress' }, 'See my stars'), h('a', { class: 'btn', href: '#/practice' }, 'Keep going'))
      : h('a', { class: 'btn primary hero', href: '#/practice' }, 'Play'));

  const islands = h('section', { class: 'islands' }, ...ISLANDS.map((isl) => {
    const p = islandProgress(stats, grade, isl);
    return h('a', { class: `island island-${isl.id}`, href: `#/world/${isl.id}`, 'aria-label': `${isl.name}, ${p.stars} of ${p.max} stars` },
      h('span', { class: 'island-art', html: islandArt(isl.id) }),
      h('span', { class: 'island-name' }, isl.name),
      h('span', { class: 'island-stars' }, `★ ${p.stars} / ${p.max}`),
      h('span', { class: 'island-bar' }, h('span', { style: `width:${p.max ? Math.round((p.stars / p.max) * 100) : 0}%` })));
  }));

  const last = (['cml', 'review'] as const).map((k) => ({ k, at: lastRound(state, grade, k)?.at ?? 0 })).sort((a, b) => b.at - a.at)[0];
  const lastRow = last.at ? savedScore(last.k) : undefined;
  const cogatStars = topicsForGrade(grade, 'cogat').reduce((n, tp) => n + (stats[tp.id]?.stars ?? 0), 0);

  return {
    title: 'Math Coach',
    el: h('div', { class: 'stack world' },
      gradeSwitch(),
      hero,
      islands,
      list([
        { label: 'Sticker book', value: state.stickers?.length || undefined, href: '#/stickers' },
        lastRow ? { label: 'Last round', value: lastRow.score, href: lastRow.href } : null,
        t.reviewDue ? { label: 'Review', value: t.reviewDue, href: '#/review' } : null,
        { label: 'CogAT', value: cogatStars ? `${cogatStars} ★` : undefined, href: '#/cogat' },
        { label: 'Test', value: t.testThisWeek ? '✓' : summary(s.test), href: '#/test' },
        { label: 'Learn', href: '#/learn' },
        { label: 'Progress', href: '#/progress' },
        { label: 'Parent dashboard', href: state.sync ? `#/parent/${state.sync.familyId}` : '#/settings/parent' }
      ]))
  };
}

/** #/world/<island>: the island's topics as big stepping stones, lit by stars; tap one to practise it. */
export function islandScreen(id: string): View {
  const isl = islandById(id) as Island | undefined;
  if (!isl) return worldScreen();
  const state = load();
  const grade = state.settings.grade;
  const p = islandProgress(state.stats[String(grade)] ?? {}, grade, isl);
  return {
    title: isl.name,
    el: h('div', { class: 'stack world' },
      h('section', { class: `card island-head island-${isl.id}` },
        h('span', { class: 'island-art', html: islandArt(isl.id) }),
        h('span', { class: 'island-stars' }, `★ ${p.stars} / ${p.max}`),
        h('a', { class: 'btn primary hero', href: `#/practice/island-${isl.id}` }, 'Play')),
      h('ol', { class: 'stone-path' }, ...p.topics.map(({ topic, stars }, i) =>
        h('li', { class: `stone-step${i % 2 ? ' right' : ''}` },
          h('a', { class: `stone${stars ? ' lit' : ''}`, href: `#/practice/${topic.id}`, 'aria-label': `${topic.title}, ${stars} of 3 stars` },
            h('span', { class: 'stone-title' }, topic.title),
            h('span', { class: 'stone-stars', 'aria-hidden': 'true' }, '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars)))))))
  };
}
