import type { Category, Topic } from '../core/types';
import { load } from '../core/storage';
import { statFor } from '../core/mastery';
import { starText } from '../core/progress';
import { makeProblem, topicById, topicsForGrade } from '../content/topics';
import { CONTEST_TIPS, FOUR_STEPS, STRATEGIES } from '../content/strategies';
import { speak, stopSpeaking } from '../voice/speech';
import { group, h, iconButton, list, rich, svg } from '../ui/dom';
import { scenePlayer } from '../ui/player';
import { choicePicker } from '../ui/choicePicker';
import { sceneFor } from '../core/explain';
import type { View } from '../app';

const CATEGORY_ORDER: Category[] = ['Number sense', 'Word problems', 'Money', 'Time & calendar', 'Measurement', 'Logic', 'Counting', 'Puzzles'];

export function learnScreen(): View {
  const state = load();
  const grade = state.settings.grade;
  const byCat = new Map<Category, Topic[]>();
  for (const t of topicsForGrade(grade)) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]);
  return {
    title: 'Learn',
    el: h('div', { class: 'stack' },
      list([{ label: 'How to solve any problem', href: '#/learn/strategies' }]),
      ...CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) =>
        list(byCat.get(c)!.map((t) => ({ label: t.title, value: h('span', { class: 'stars' }, starText(statFor(state, grade, t.id)?.stars ?? 0)), href: `#/learn/${t.id}` })), c)))
  };
}

export function topicScreen(id: string): View {
  const t = topicById(id);
  if (!t) return learnScreen();
  const grade = load().settings.grade;
  const g = t.grades.includes(grade) ? grade : t.grades[0];
  const example = makeProblem(t, g, 2, 20261101 + id.length);
  const player = scenePlayer(sceneFor(example));
  const lesson = [t.guide.idea, ...t.guide.tips, ...t.guide.traps].join(' ');
  return {
    title: t.title,
    el: h('div', { class: 'stack' },
      group(null,
        h('div', { class: 'lead-row' }, h('p', { class: 'lead' }, t.guide.idea), iconButton('speaker', 'Read aloud', () => void speak(lesson))),
        h('ul', { class: 'bullets' }, ...t.guide.tips.map((x) => h('li', {}, x)))),
      group('Watch out', h('ul', { class: 'bullets' }, ...t.guide.traps.map((x) => h('li', {}, x)))),
      group('Example',
        h('div', { class: 'lead-row' }, h('p', { class: 'question' }, rich(example.text)), iconButton('speaker', 'Read aloud', () => void speak(example.speech ?? example.text))),
        example.figure ? svg(example.figure) : null,
        example.answer.kind === 'choice' && example.answer.pictures ? choicePicker(example.answer, () => {}).el : null,
        player.el),
      h('a', { class: 'btn primary hero', href: `#/practice/${t.id}` }, 'Practice')),
    destroy: () => { player.destroy(); stopSpeaking(); }
  };
}

export function strategiesScreen(): View {
  return {
    title: 'How to solve',
    el: h('div', { class: 'stack' },
      list(FOUR_STEPS.map((s) => ({ label: h('span', {}, h('strong', {}, s.title.replace(/^\d\.\s*/, '')), h('br'), h('span', { class: 'sub' }, s.text)) })), 'Four steps',
        iconButton('speaker', 'Read aloud', () => void speak(FOUR_STEPS.map((s) => `${s.title.replace(/^\d\.\s*/, '')}. ${s.text}`).join(' ')))),
      list(Object.entries(STRATEGIES).map(([k, v]) => ({ label: h('span', {}, h('strong', {}, k), h('br'), h('span', { class: 'sub' }, v)) })), 'Strategies',
        iconButton('speaker', 'Read aloud', () => void speak(Object.entries(STRATEGIES).map(([k, v]) => `${k}. ${v}`).join(' ')))),
      list(CONTEST_TIPS.map((x) => ({ label: x })), 'On contest day')),
    destroy: stopSpeaking
  };
}
