import type { Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { misNum, num, until } from './helpers';
import { familyCountScene, familyTableScene } from '../scenes/logic-puzzles';

const GIRLS = ['Jill', 'Ava', 'Maya', 'Sofia', 'Priya', 'Grace', 'Isla', 'Uma', 'Kiara', 'Wendy'];
const BOYS = ['Jack', 'Ben', 'Leo', 'Noah', 'Theo', 'Ravi', 'Hiro', 'Carlos', 'Jamal', 'Zane'];
const MAX = 15;
const kids = (n: number, word: 'boy' | 'girl') => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What one child sees: sisters and brothers NOT counting themselves. */
const view = (isGirl: boolean, boys: number, girls: number) =>
  isGirl ? { sisters: girls - 1, brothers: boys } : { sisters: girls, brothers: boys - 1 };

interface Clue {
  text: string;
  /** For direct-count clues: what it tells you straight away. */
  explain?: string;
  /** Does a family with these counts make the clue true? `selfCounts` = the common mistake of counting yourself. */
  test: (boys: number, girls: number, selfCounts?: boolean) => boolean;
}

const TIMES = ['', '', 'twice', 'three times'];

/** Every clue form that is true for this child, at the allowed level. */
function cluesFor(name: string, isGirl: boolean, boys: number, girls: number, level: number): Clue[] {
  const { sisters: s, brothers: b } = view(isGirl, boys, girls);
  const see = (B: number, G: number, self = false) => {
    if (isGirl ? G < 1 : B < 1) return undefined;
    return self ? { sisters: G, brothers: B } : view(isGirl, B, G);
  };
  const make = (text: string, rel: (s: number, b: number) => boolean): Clue => ({
    text,
    test: (B, G, self) => {
      const v = see(B, G, self);
      return !!v && v.sisters >= 0 && v.brothers >= 0 && rel(v.sisters, v.brothers);
    }
  });
  const out: Clue[] = [];
  if (level === 2) {
    // Direct counts. Paired with one relation clue from the other child (two relation clues of the
    // "as many / more than" kind only ever fix girls − boys, so they can't settle the family alone).
    const sis = make(`${name} has ${s} sister${s === 1 ? '' : 's'}.`, (x) => x === s);
    sis.explain = isGirl ? `${name} has ${s} sister${s === 1 ? '' : 's'}, plus ${name} herself: ${kids(s + 1, 'girl')}.` : `All the girls are ${name}'s sisters: ${kids(s, 'girl')}.`;
    const bro = make(`${name} has ${b} brother${b === 1 ? '' : 's'}.`, (_x, y) => y === b);
    bro.explain = isGirl ? `All the boys are ${name}'s brothers: ${kids(b, 'boy')}.` : `${name} has ${b} brother${b === 1 ? '' : 's'}, plus ${name} himself: ${kids(b + 1, 'boy')}.`;
    // "has 0 brothers" reads oddly to young children, so only use direct counts of 1 or more
    return [...(s > 0 ? [sis] : []), ...(b > 0 ? [bro] : [])];
  }
  if (s === b) out.push(make(`${name} has as many sisters as brothers.`, (x, y) => x === y));
  if (s > b) out.push(make(`${name} has ${s - b} more sister${s - b > 1 ? 's' : ''} than brothers.`, (x, y) => x - y === s - b));
  if (b > s) out.push(make(`${name} has ${b - s} more brother${b - s > 1 ? 's' : ''} than sisters.`, (x, y) => y - x === b - s));
  if (level >= 3) {
    for (const k of [2, 3]) {
      if (b > 0 && s === k * b) out.push(make(`${name} has ${TIMES[k]} as many sisters as brothers.`, (x, y) => x === k * y));
      if (s > 0 && b === k * s) out.push(make(`${name} has ${TIMES[k]} as many brothers as sisters.`, (x, y) => y === k * x));
    }
  }
  return out;
}

function solutions(clues: Clue[], self = false): [number, number][] {
  const out: [number, number][] = [];
  for (let B = 0; B <= MAX; B++) for (let G = 0; G <= MAX; G++) if (B + G > 0 && clues.every((c) => c.test(B, G, self))) out.push([B, G]);
  return out;
}

function puzzle(rng: Rng, level: number) {
  return until(
    () => {
      const boys = rng.int(1, level >= 3 ? 6 : 5);
      const girls = rng.int(1, level >= 3 ? 7 : 5);
      const girl = rng.pick(GIRLS);
      const boy = rng.pick(BOYS);
      let clues: Clue[];
      if (level === 2) {
        // one child gives a direct count, the other a relation
        const girlCounts = rng.chance(0.5);
        const direct = cluesFor(girlCounts ? girl : boy, girlCounts, boys, girls, 2);
        const rel = cluesFor(girlCounts ? boy : girl, !girlCounts, boys, girls, 3).filter((c) => !/times|twice/.test(c.text));
        clues = rel.length && direct.length ? [rng.pick(direct), rng.pick(rel)] : [];
      } else {
        const gClues = cluesFor(girl, true, boys, girls, level);
        const bClues = cluesFor(boy, false, boys, girls, level);
        // prefer the more interesting "times" clues at the challenge level
        const pick = (cs: Clue[]) => (cs.length > 1 && rng.chance(0.7) ? cs[cs.length - 1] : rng.pick(cs));
        clues = gClues.length && bClues.length ? [pick(gClues), pick(bClues)] : [];
      }
      return { boys, girls, girl, boy, clues };
    },
    (p) => {
      if (p.clues.length !== 2 || p.boys + p.girls < 3) return false;
      const sols = solutions(p.clues);
      return sols.length === 1 && sols[0][0] === p.boys && sols[0][1] === p.girls;
    },
    3000
  );
}

export const familyPuzzle: Topic = {
  id: 'brothers-sisters',
  title: 'Brothers & sisters puzzles',
  category: 'Logic',
  grades: [2, 3],
  strategy: 'Make a table',
  guide: {
    idea: 'Nobody is their own brother or sister! A girl counts every boy as a brother, but one fewer girl as a sister: she leaves herself out. A boy does the same with the boys.',
    tips: [
      'A girl has (girls − 1) sisters and (boys) brothers.',
      'A boy has (girls) sisters and (boys − 1) brothers.',
      'Make a table: try 1 boy, 2 boys, 3 boys… For each one, use the first clue to find the girls, then check the second clue.',
      'Draw the family as stick figures and cross out the child who is "talking".'
    ],
    traps: ['Counting the child as their own sister or brother.', 'Answering the number of boys when the question asks for all the children.']
  },
  generate: ({ grade, level, rng }) => {
    if (level === 1) {
      const boys = rng.int(1, grade === 2 ? 4 : 6);
      const girls = rng.int(1, grade === 2 ? 4 : 6);
      const askGirl = rng.chance(0.5);
      const name = askGirl ? rng.pick(GIRLS) : rng.pick(BOYS);
      const askSisters = rng.chance(0.5);
      const v = view(askGirl, boys, girls);
      const ans = askSisters ? v.sisters : v.brothers;
      const self = askGirl === askSisters; // asking about her own kind -> the trap
      const family = `The ${rng.pick(['Diaz', 'Kim', 'Patel', 'Brooks', 'Evans'])} family has ${boys} boy${boys > 1 ? 's' : ''} and ${girls} girl${girls > 1 ? 's' : ''}.`;
      return {
        scene: familyCountScene(boys, girls, name, askGirl, askSisters),
        text: `${family} ${name} is one of the ${askGirl ? 'girls' : 'boys'}. How many ${askSisters ? 'sisters' : 'brothers'} does ${name} have?`,
        answer: num(ans),
        hints: [`Is ${name} a girl or a boy? ${name} is not ${askGirl ? 'her' : 'his'} own ${askGirl ? 'sister' : 'brother'}.`, self ? `Leave ${name} out when you count the ${askGirl ? 'girls' : 'boys'}.` : `Every one of the ${askSisters ? 'girls' : 'boys'} counts.`],
        steps: self
          ? [`There are ${askGirl ? girls : boys} ${askGirl ? 'girls' : 'boys'}, and one of them is ${name}.`, `${name}'s ${askSisters ? 'sisters' : 'brothers'}: ${askGirl ? girls : boys} − 1 = ${ans}.`]
          : [`${name} is a ${askGirl ? 'girl' : 'boy'}, so all ${askSisters ? girls : boys} ${askSisters ? 'girls' : 'boys'} are ${askGirl ? 'her' : 'his'} ${askSisters ? 'sisters' : 'brothers'}.`, `Answer: ${ans}.`],
        misconceptions: misNum(ans, self
          ? [[ans + 1, `${name} is counted in there! Nobody is their own ${askSisters ? 'sister' : 'brother'}, so take 1 away.`]]
          : [[ans - 1, `${name} is a ${askGirl ? 'girl' : 'boy'}, so ${askGirl ? 'she' : 'he'} doesn't need to be left out of the ${askSisters ? 'girls' : 'boys'}. Count them all.`]])
      };
    }
    const p = puzzle(rng, grade === 2 ? Math.min(level, 2) : level);
    const total = p.boys + p.girls;
    const askWhat = rng.pick(['children', 'children', 'boys', 'girls'] as const);
    const ans = askWhat === 'children' ? total : askWhat === 'boys' ? p.boys : p.girls;
    // Level 2: the direct count gives one number; the relation gives the other.
    // Level 3: table of guesses. For each number of boys, the girl's clue fixes the girls; check the boy's clue.
    const rows: string[] = [];
    if (p.clues[0].explain) {
      rows.push(p.clues[0].explain, `Now use the other clue: "${p.clues[1].text}" That only works with ${kids(p.boys, 'boy')} and ${kids(p.girls, 'girl')}.`);
    }
    for (let B = 1; !p.clues[0].explain && B <= p.boys; B++) {
      const G = Array.from({ length: MAX + 1 }, (_, g) => g).find((g) => p.clues[0].test(B, g));
      if (G === undefined) {
        rows.push(`${kids(B, 'boy')}: ${p.girl}'s clue can't work. ✗`);
        continue;
      }
      const ok = p.clues[1].test(B, G);
      const bv = view(false, B, G);
      rows.push(`${kids(B, 'boy')}, ${kids(G, 'girl')}: ${p.boy} has ${bv.sisters} sister${bv.sisters === 1 ? '' : 's'} and ${bv.brothers} brother${bv.brothers === 1 ? '' : 's'} ${ok ? '✔' : '✗'}`);
    }
    // The classic mistake: letting each child count themselves.
    const selfSols = solutions(p.clues, true);
    const wrong = selfSols.length === 1 ? selfSols[0] : undefined;
    const wrongAns = wrong ? (askWhat === 'children' ? wrong[0] + wrong[1] : askWhat === 'boys' ? wrong[0] : wrong[1]) : NaN;
    const gv = view(true, p.boys, p.girls), bv = view(false, p.boys, p.girls);
    return {
      scene: familyTableScene(p.girl, p.boy, p.clues.map((c) => c.text), rows, p.boys, p.girls),
      text: `${p.boy} is ${p.girl}'s brother. ${p.clues[0].text} ${p.clues[1].text} How many ${askWhat} are in the family?`,
      answer: num(ans),
      hints: [
        `${p.girl} has (girls − 1) sisters, because she is not her own sister. ${p.boy} has (boys − 1) brothers.`,
        ...(p.clues[0].explain
          ? [`Start with the clue that gives a number straight away: "${p.clues[0].text}"`, 'Then use the other clue to find the rest of the family.']
          : [`Make a table. Try 1 boy, 2 boys, 3 boys… and use ${p.girl}'s clue to find the girls.`, `For each row, check ${p.boy}'s clue.`])
      ],
      steps: [
        `${p.girl} doesn't count herself, and ${p.boy} doesn't count himself.`,
        ...rows,
        `So the family has ${kids(p.boys, 'boy')} and ${kids(p.girls, 'girl')}${askWhat === 'children' ? `: ${total} children` : ''}.`,
        `Check: ${p.girl} has ${gv.sisters} sister${gv.sisters === 1 ? '' : 's'} and ${gv.brothers} brother${gv.brothers === 1 ? '' : 's'}; ${p.boy} has ${bv.sisters} sister${bv.sisters === 1 ? '' : 's'} and ${bv.brothers} brother${bv.brothers === 1 ? '' : 's'}. ✔`
      ],
      misconceptions: misNum(ans, [
        [wrongAns, `That works only if ${p.girl} counts herself as a sister and ${p.boy} counts himself as a brother. Leave the child who is talking out!`],
        ...(askWhat === 'children' ? ([[p.boys, `${p.boys} is just the boys. How many children altogether?`], [p.girls, `${p.girls} is just the girls. Add the boys too.`]] as [number, string][]) : [])
      ])
    };
  }
};
