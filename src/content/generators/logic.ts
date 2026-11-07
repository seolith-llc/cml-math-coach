import type { Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { ordinal } from '../../core/numberWords';
import { SURNAMES, names, num, permutations, word } from './helpers';
import { orderScene, matchScene } from '../scenes/logic-puzzles';

/* ---------- ordering puzzles ---------- */

type Order = string[]; // index 0 = first
interface Clue {
  text: string;
  test: (o: Order) => boolean;
}

function orderClues(people: string[], verb: { after: string; before: string; first: string; last: string }): Clue[] {
  const pos = (o: Order, p: string) => o.indexOf(p);
  const out: Clue[] = [];
  for (const a of people) {
    out.push({ text: `${a} was not ${verb.first}.`, test: (o) => pos(o, a) !== 0 });
    out.push({ text: `${a} was not ${verb.last}.`, test: (o) => pos(o, a) !== o.length - 1 });
    for (const b of people) {
      if (a === b) continue;
      out.push({ text: `${a} ${verb.after} ${b}.`, test: (o) => pos(o, a) > pos(o, b) });
      out.push({ text: `${a} ${verb.before} ${b}.`, test: (o) => pos(o, a) < pos(o, b) });
      out.push({ text: `${a} ${verb.after.replace(/ after$/, "")} right after ${b}.`, test: (o) => pos(o, a) === pos(o, b) + 1 });
      out.push({ text: `${a} did not go right after ${b}.`, test: (o) => pos(o, a) !== pos(o, b) + 1 });
    }
  }
  return out;
}

/** Pick true clues until only one order fits, then drop clues that are not needed. */
function buildPuzzle<T>(rng: Rng, truth: T, all: T[], clues: { text: string; test: (o: T) => boolean }[]) {
  const truthy = rng.shuffle(clues.filter((c) => c.test(truth)));
  const chosen: typeof truthy = [];
  const fits = (cs: typeof truthy) => all.filter((o) => cs.every((c) => c.test(o)));
  for (const c of truthy) {
    if (fits([...chosen, c]).length < fits(chosen).length) chosen.push(c);
    if (fits(chosen).length === 1) break;
  }
  for (let i = chosen.length - 1; i >= 0; i--) {
    const without = chosen.filter((_, j) => j !== i);
    if (fits(without).length === 1) chosen.splice(i, 1);
  }
  return chosen;
}

export const orderingLogic: Topic = {
  id: 'logic-order',
  title: 'Who came first? (ordering)',
  category: 'Logic',
  grades: [2, 3],
  strategy: 'Use logical reasoning',
  guide: {
    idea: 'Draw blank spaces for 1st, 2nd, 3rd… and place people as each clue tells you.',
    tips: ['Start with the clue that tells you the most.', 'Write the names in pencil and move them as you go.', 'At the end, check that every clue is true.'],
    traps: ['"After" does not always mean "right after".', 'Forgetting to check every clue at the end.']
  },
  generate: ({ grade, level, rng }) => {
    const n = grade === 2 && level === 1 ? 3 : 4;
    const people = names(rng, n);
    const ctx = rng.pick([
      { story: `${people.join(', ').replace(/, ([^,]*)$/, ' and $1')} entered the movie theater one at a time.`, verb: { after: 'entered after', before: 'entered before', first: 'first', last: 'last' }, role: 'person to enter' },
      { story: `${people.join(', ').replace(/, ([^,]*)$/, ' and $1')} took turns bowling.`, verb: { after: 'bowled after', before: 'bowled before', first: 'first', last: 'last' }, role: 'bowler' },
      { story: `${people.join(', ').replace(/, ([^,]*)$/, ' and $1')} ran a race. There were no ties.`, verb: { after: 'finished after', before: 'finished before', first: 'first', last: 'last' }, role: 'runner to finish' }
    ]);
    const truth = rng.shuffle(people);
    const clues = buildPuzzle(rng, truth, permutations(people), orderClues(people, ctx.verb));
    const askPosition = grade === 3 && rng.chance(0.5);
    const target = askPosition ? rng.pick(people) : truth[0];
    const pos = truth.indexOf(target) + 1;
    return {
      scene: orderScene(truth, clues, permutations(people)),
      text: `${ctx.story} ${clues.map((c) => c.text).join(' ')} ${askPosition ? `In what place was ${target}? (1st, 2nd, …)` : `Who was the first ${ctx.role}?`}`,
      answer: askPosition ? num(pos) : word(target, people),
      hints: [`Draw ${n} spaces: ${Array.from({ length: n }, (_, i) => ordinal(i + 1)).join(', ')}.`, 'Use the "before" and "after" clues to put people in order.', 'Try each person in the open spot and check every clue.'],
      steps: [...clues.map((c) => `Clue: ${c.text}`), `The only order that fits: ${truth.join(', ')}.`, askPosition ? `${target} was ${ordinal(pos)}.` : `${truth[0]} was first.`]
    };
  }
};

/* ---------- matching puzzles ---------- */

export const matchingLogic: Topic = {
  id: 'logic-match',
  title: 'Who does what? (matching grid)',
  category: 'Logic',
  grades: [2, 3],
  strategy: 'Make a table',
  guide: {
    idea: 'Make a grid with people down the side and jobs across the top. Put an ✗ when a clue says NO.',
    tips: ['Each row and each column gets exactly one ✓.', 'If a row has every box ✗ except one, that last box is ✓.', 'Hidden clue: two people who "shop together" or "live next door" are different people.'],
    traps: ['Missing a hidden clue such as "X earns more than the teller", which tells you X is not the teller.']
  },
  generate: ({ rng }) => {
    const people = rng.sample(SURNAMES, 3).map((s) => `Mrs. ${s}`);
    const theme = rng.pick([
      { roles: ['Garden Club', 'Chess Club', 'Travel Club'], intro: 'Each of three women is in exactly one club: the Garden Club, the Chess Club or the Travel Club.', in: (r: string) => `in the ${r}`, the: (r: string) => `The woman in the ${r}`, ask: (p: string) => `Which club is ${p} in?` },
      { roles: ['teller', 'loan officer', 'manager'], intro: 'Three women at a bank are the teller, the loan officer and the manager, but not necessarily in that order.', in: (r: string) => `the ${r}`, the: (r: string) => `The ${r}`, ask: (p: string) => `What is ${p}'s job?` },
      { roles: ['drums', 'flute', 'violin'], intro: 'Three women in a band play the drums, the flute and the violin, but not necessarily in that order.', in: (r: string) => `the ${r} player`, the: (r: string) => `The ${r} player`, ask: (p: string) => `What instrument does ${p} play?` }
    ]);
    const truth = rng.shuffle(theme.roles); // truth[i] = role of people[i]
    const all = permutations(theme.roles);
    const roleOf = (a: string[], p: string) => a[people.indexOf(p)];
    const clues: { text: string; test: (a: string[]) => boolean }[] = [];
    for (const p of people)
      for (const r of theme.roles) {
        clues.push({ text: `${p} is not ${theme.in(r)}.`, test: (a) => roleOf(a, p) !== r });
        clues.push({ text: `${theme.the(r)} lives next door to ${p}.`, test: (a) => roleOf(a, p) !== r });
        clues.push({ text: `${theme.the(r)} and ${p} go shopping together.`, test: (a) => roleOf(a, p) !== r });
      }
    const chosen = buildPuzzle(rng, truth, all, clues);
    const target = rng.pick(people);
    return {
      scene: matchScene(people, theme.roles, truth, chosen, all),
      text: `${theme.intro} ${chosen.map((c) => c.text).join(' ')} ${theme.ask(target)}`,
      answer: word(roleOf(truth, target), theme.roles),
      hints: ['Draw a 3 × 3 grid: names down the side, choices across the top.', 'Put ✗ in each box a clue rules out. People who do things together are different people!', 'A row with two ✗s has its ✓ in the last box.'],
      steps: [...chosen.map((c) => `Clue: ${c.text}`), ...people.map((p) => `${p}: ${roleOf(truth, p)}.`)]
    };
  }
};
