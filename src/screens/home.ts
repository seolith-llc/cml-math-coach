import { BUDDY_KINDS, dayStreak, dueReviews, lastRound, load, save, type AppState } from '../core/storage';
import { buddySvg } from '../content/buddies';
import { applyLook } from '../ui/dom';
import { savedScore } from './round';
import { today } from '../core/progress';
import { summary } from '../core/session';
import { topicsForGrade } from '../content/topics';
import { h, list } from '../ui/dom';
import { gradeSwitch } from '../ui/session';
import type { View } from '../app';

export function homeScreen(): View {
  const state = load();
  const s = state.settings;
  const grade = s.grade;
  const t = today({ log: state.log, goal: s.goal, reviewDue: dueReviews(state, grade).length, meets: state.meets.filter((m) => m.grade === grade) });
  const streak = dayStreak(state);
  const stats = state.stats[String(grade)] ?? {};
  const stars = topicsForGrade(grade).reduce((n, tp) => n + (stats[tp.id]?.stars ?? 0), 0);
  // The most recent of the last practice round and the last review round.
  const last = (['number', 'review'] as const).map((k) => ({ k, at: lastRound(state, grade, k)?.at ?? 0 })).sort((a, b) => b.at - a.at)[0];
  const lastRow = last.at ? savedScore(last.k) : undefined;
  const thinkingStars = topicsForGrade(grade, 'thinking').reduce((n, tp) => n + (stats[tp.id]?.stars ?? 0), 0);

  const segment = gradeSwitch();

  // Today: progress toward the daily goal. When it's met, say so and make "more" optional.
  const pct = Math.min(100, Math.round((t.practiced / t.goal) * 100));
  const todayCard = h('section', { class: `card today${t.goalMet ? ' met' : ''}` },
    h('div', { class: 'today-row' },
      h('span', { class: 'today-count' }, t.goalMet ? 'Done for today' : `${t.practiced} of ${t.goal}`),
      streak ? h('span', { class: 'today-streak', 'aria-label': `${streak} day streak` }, `🔥 ${streak}`) : null),
    h('div', { class: 'bar-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': t.goal, 'aria-valuenow': t.practiced }, h('span', { style: `width:${pct}%` })),
    h('a', { class: `btn ${t.goalMet ? '' : 'primary'} hero`, href: '#/practice' }, t.goalMet ? 'Keep going' : 'Practice'));

  return {
    title: 'Puzzle Trail',
    el: h('div', { class: 'stack' },
      segment,
      s.lookOffered ? null : lookOffer(state),
      todayCard,
      list([
        lastRow ? { label: 'Last round', value: lastRow.score, href: lastRow.href } : null,
        t.reviewDue ? { label: 'Review', value: t.reviewDue, href: '#/review' } : null,
        { label: 'Test', value: t.testThisWeek ? '✓' : summary(s.test), href: '#/test' },
        { label: 'Learn', value: stars ? `${stars} ★` : undefined, href: '#/learn' },
        { label: 'Thinking Puzzles', value: thinkingStars ? `${thinkingStars} ★` : undefined, href: '#/thinking' },
        { label: 'Progress', href: '#/progress' },
        // PIN-protected, so it's safe on the child's Home; set up in Settings when it isn't on yet.
        { label: 'Parent dashboard', href: state.sync ? `#/parent/${state.sync.familyId}` : '#/settings/parent' }
      ]))
  };
}

/** One-time choice on the classic Home: try the game look (then pick a buddy) or keep Classic. Changeable later in Settings → Look. */
function lookOffer(state: AppState): HTMLElement {
  const choose = (look: 'game' | 'classic') => {
    state.settings.look = look;
    state.settings.lookOffered = true;
    save(state);
    applyLook(look, state.settings.motion);
    window.dispatchEvent(new HashChangeEvent('hashchange')); // Home redraws: the world map (or the buddy picker) for Game
  };
  return h('section', { class: 'card look-offer' },
    h('div', { class: 'offer-buddies', 'aria-hidden': 'true', html: BUDDY_KINDS.map((k, i) => buddySvg(k, i % 2 ? 'happy' : 'idle')).join('') }),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary hero wide', type: 'button', onclick: () => choose('game') }, 'Game look'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => choose('classic') }, 'Classic')));
}
