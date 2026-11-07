import type { Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { columnFigure, misNum, num, until } from './helpers';
import { cryptScene, recipeScene, shapeScene, packagesScene, balanceScene } from '../scenes/logic-puzzles';

/* ---------------- cryptarithms ---------------- */

interface Crypt {
  top: string;
  bottom: string;
  result: string;
  op: '+' | '-';
  letters: Record<string, number>;
}

function substitute(s: string, map: Record<string, number>): string {
  return s.replace(/[A-Z]/g, (ch) => String(map[ch]));
}

function solutions(c: Omit<Crypt, 'letters'>, letters: string[]): Record<string, number>[] {
  const out: Record<string, number>[] = [];
  const rec = (i: number, map: Record<string, number>) => {
    if (i === letters.length) {
      const t = substitute(c.top, map), b = substitute(c.bottom, map), r = substitute(c.result, map);
      if ([t, b, r].some((x) => x.length > 1 && x[0] === '0')) return;
      if ((c.op === '+' ? +t + +b : +t - +b) === +r) out.push({ ...map });
      return;
    }
    for (let d = 0; d <= 9; d++) {
      if (Object.values(map).includes(d)) continue;
      rec(i + 1, { ...map, [letters[i]]: d });
    }
  };
  rec(0, {});
  return out;
}

function makeCrypt(rng: Rng, grade: 2 | 3, twoLetters: boolean): Crypt {
  return until(
    () => {
      const op: '+' | '-' = rng.chance(0.5) ? '+' : '-';
      const top = rng.int(100, 999);
      const bottom = grade === 2 ? rng.int(10, 99) : rng.int(10, rng.chance(0.5) ? 99 : 899);
      const result = op === '+' ? top + bottom : top - bottom;
      const strs = [String(top), String(bottom), String(result)];
      const digits = strs.join('').split('');
      const counts: Record<string, number> = {};
      digits.forEach((d) => (counts[d] = (counts[d] ?? 0) + 1));
      const repeated = Object.keys(counts).filter((d) => counts[d] >= 2);
      const chosen = twoLetters ? rng.sample(Object.keys(counts), 2) : repeated.length ? [rng.pick(repeated)] : [];
      const letters = ['A', 'B'].slice(0, chosen.length);
      const map: Record<string, number> = {};
      chosen.forEach((d, i) => (map[letters[i]] = +d));
      const mask = (s: string) => s.split('').map((ch) => (chosen.includes(ch) ? letters[chosen.indexOf(ch)] : ch)).join('');
      const c: Crypt = { top: mask(strs[0]), bottom: mask(strs[1]), result: mask(strs[2]), op, letters: map };
      return { c, letters, result };
    },
    ({ c, letters, result }) => {
      if (!letters.length || result < 10) return false;
      const masked = (c.top + c.bottom + c.result).replace(/[0-9]/g, '').length;
      if (masked < (letters.length === 2 ? 3 : 2)) return false;
      if (!/[A-Z]/.test(c.top + c.bottom)) return false;
      return solutions(c, letters).length === 1;
    },
    2000
  ).c;
}

const spell = (s: string) => s.split('').join(' ');

export const cryptarithm: Topic = {
  id: 'cryptarithm',
  title: 'Letter-digit puzzles',
  category: 'Puzzles',
  grades: [2, 3],
  strategy: 'Guess and check',
  guide: {
    idea: 'Each letter stands for one digit, and the same letter is always the same digit. Work column by column, starting with the ones.',
    tips: ['Start with the ones column. What digit plus or minus itself gives that ending?', 'Remember to carry (regroup) into the next column.', 'Try a digit, then check the WHOLE problem.'],
    traps: ['Forgetting the carry from the ones column.', 'Checking only one column.']
  },
  generate: ({ grade, level, rng }) => {
    const two = grade === 3 && level === 3;
    const c = makeCrypt(rng, grade, two);
    const vals = c.letters;
    const ask = two ? vals.A + vals.B : vals.A;
    return {
      scene: cryptScene(c.top, c.bottom, c.result, c.op, vals),
      text: two
        ? 'In the problem, A and B are different digits. Each time a letter appears it stands for the same digit. What is A + B?'
        : 'In the problem, "A" stands for the same digit every time it appears. What digit does A stand for?',
      figure: columnFigure(c.top, c.bottom, c.op, c.result),
      speech: `${two ? 'A and B are different digits.' : 'A stands for the same digit every time.'} The top number is ${spell(c.top)}. ${c.op === '+' ? 'Plus' : 'Minus'} ${spell(c.bottom)}. The answer is ${spell(c.result)}. ${two ? 'What is A plus B?' : 'What digit is A?'}`,
      answer: num(ask),
      hints: ['Look at the ones column first.', 'Try a digit for A and check every column.', ...(two ? ['After you find one letter, the other one becomes easier.'] : [])],
      steps: [
        `Try digits in the ones column until it works.`,
        ...Object.entries(vals).map(([k, v]) => `${k} = ${v}.`),
        `Check: ${substitute(c.top, vals)} ${c.op === '+' ? '+' : '−'} ${substitute(c.bottom, vals)} = ${substitute(c.result, vals)}. ✔`,
        ...(two ? [`A + B = ${vals.A} + ${vals.B} = ${ask}.`] : [])
      ]
    };
  }
};

/* ---------------- made-up operations ---------------- */

const OPS = [
  { show: 'a ★ b means (a + b) − (a − b)', f: (a: number, b: number) => a + b - (a - b), ok: (a: number, b: number) => a >= b, calc: (a: number, b: number) => `(${a} + ${b}) − (${a} − ${b}) = ${a + b} − ${a - b} = ${2 * b}` },
  { show: 'a ★ b means (a × b) − (a + b)', f: (a: number, b: number) => a * b - (a + b), ok: (a: number, b: number) => a * b >= a + b, calc: (a: number, b: number) => `(${a} × ${b}) − (${a} + ${b}) = ${a * b} − ${a + b} = ${a * b - a - b}` },
  { show: 'a ★ b means (10 + a) − (5 − b)', f: (a: number, b: number) => 10 + a - (5 - b), ok: (_a: number, b: number) => b <= 5, calc: (a: number, b: number) => `(10 + ${a}) − (5 − ${b}) = ${10 + a} − ${5 - b} = ${10 + a - 5 + b}` },
  { show: 'a ★ b means a × 2 + b', f: (a: number, b: number) => a * 2 + b, ok: () => true, calc: (a: number, b: number) => `${a} × 2 + ${b} = ${2 * a} + ${b} = ${2 * a + b}` },
  { show: 'a ★ b means (a + b) × 2', f: (a: number, b: number) => (a + b) * 2, ok: () => true, calc: (a: number, b: number) => `(${a} + ${b}) × 2 = ${a + b} × 2 = ${2 * (a + b)}` }
];

export const customOp: Topic = {
  id: 'custom-operation',
  title: 'Made-up operations (★)',
  category: 'Puzzles',
  grades: [3],
  strategy: 'Write a number sentence',
  guide: {
    idea: 'A made-up symbol is a recipe. Put the first number where "a" is and the second number where "b" is, then follow the recipe.',
    tips: ['Copy the recipe, then swap a and b for the numbers.', 'Do the brackets first.', 'Follow the worked example to check you understand.'],
    traps: ['Swapping a and b around.', 'Ignoring the brackets.']
  },
  generate: ({ level, rng }) => {
    const op = rng.pick(OPS);
    const pickPair = () => until(() => ({ a: rng.int(2, 12), b: rng.int(1, 9) }), ({ a, b }) => op.ok(a, b));
    const ex = pickPair();
    const q1 = until(pickPair, (q) => q.a !== ex.a || q.b !== ex.b);
    const example = `For example, ${ex.a} ★ ${ex.b} = ${op.calc(ex.a, ex.b)}.`;
    if (level === 3) {
      const q2 = until(pickPair, (q) => op.f(q.a, q.b) !== op.f(q1.a, q1.b));
      const [hi, lo] = op.f(q1.a, q1.b) > op.f(q2.a, q2.b) ? [q1, q2] : [q2, q1];
      const ans = op.f(hi.a, hi.b) - op.f(lo.a, lo.b);
      return {
        scene: recipeScene(op.show, [hi, lo].map((q) => ({ a: q.a, b: q.b, calc: op.calc(q.a, q.b) })), `${op.f(hi.a, hi.b)} − ${op.f(lo.a, lo.b)} = ${ans}`),
        text: `${op.show}. ${example} How much larger is ${hi.a} ★ ${hi.b} than ${lo.a} ★ ${lo.b}?`,
        speech: `${op.show.replace('★', 'star')}. ${example.replace(/★/g, 'star')} How much larger is ${hi.a} star ${hi.b} than ${lo.a} star ${lo.b}?`,
        answer: num(ans),
        hints: ['Work out each ★ separately.', 'Then subtract.'],
        steps: [`${hi.a} ★ ${hi.b} = ${op.calc(hi.a, hi.b)}.`, `${lo.a} ★ ${lo.b} = ${op.calc(lo.a, lo.b)}.`, `Difference: ${ans}.`]
      };
    }
    const ans = op.f(q1.a, q1.b);
    return {
      scene: recipeScene(op.show, [{ a: q1.a, b: q1.b, calc: op.calc(q1.a, q1.b) }]),
      text: `${op.show}. ${example} What is ${q1.a} ★ ${q1.b}?`,
      speech: `${op.show.replace('★', 'star')}. ${example.replace(/★/g, 'star')} What is ${q1.a} star ${q1.b}?`,
      answer: num(ans),
      hints: [`Put ${q1.a} in place of a and ${q1.b} in place of b.`, 'Work out the brackets first.'],
      steps: [`${q1.a} ★ ${q1.b} = ${op.calc(q1.a, q1.b)}.`],
      misconceptions: op.ok(q1.b, q1.a) ? misNum(ans, [[op.f(q1.b, q1.a), 'Careful, it looks like a and b were swapped. The first number is a.']]) : []
    };
  }
};

/* ---------------- shape equations ---------------- */

export const shapeEquations: Topic = {
  id: 'shape-equations',
  title: 'Shape equations',
  category: 'Puzzles',
  grades: [2, 3],
  strategy: 'Guess and check',
  guide: {
    idea: 'Each shape hides a number. The same shape is always the same number. Find the one you can, then use it to unlock the others.',
    tips: ['Start with the equation that has only one unknown.', 'Swap each number you find into the other equations.', 'Read the question carefully. It might ask for a sum or difference, not one shape.'],
    traps: ['Stopping after finding one shape.']
  },
  generate: ({ grade, level, rng }) => {
    const v = level === 1 ? 0 : grade === 3 ? rng.int(1, 2) : 1;
    if (v === 0) {
      const sq = rng.int(3, 15), k = rng.int(1, sq - 1);
      return {
        scene: shapeScene([`■ − ${k} = ${sq - k}`], [[`Square take away ${k} leaves ${sq - k}, so square is ${sq - k} + ${k} = ${sq}.`, `■ = ${sq}`]], `■ + ■ = ${2 * sq}`),
        text: `If ■ − ${k} = ${sq - k}, how much is ■ + ■?`,
        answer: num(2 * sq),
        hints: [`■ take away ${k} leaves ${sq - k}. So ■ = ${sq - k} + ${k}.`, 'Now add ■ to itself.'],
        steps: [`■ = ${sq - k} + ${k} = ${sq}.`, `■ + ■ = ${sq} + ${sq} = ${2 * sq}.`],
        misconceptions: misNum(2 * sq, [[sq, `Yes, ■ is ${sq}! Now find ■ + ■.`]])
      };
    }
    if (v === 1) {
      const p = until(() => ({ s: rng.int(1, 9), c: rng.int(1, 9), t: rng.int(1, 15) }), ({ s, c, t }) => t > c && s !== c);
      return {
        scene: shapeScene([`■ + ● = ${p.s + p.c}`, `● + ▲ = ${p.c + p.t}`], [[`Square is ${p.s}, so circle is ${p.s + p.c} − ${p.s} = ${p.c}.`, `● = ${p.c}`], [`Then triangle is ${p.c + p.t} − ${p.c} = ${p.t}.`, `▲ = ${p.t}`]], `▲ − ● = ${p.t - p.c}`),
        text: `■ + ● = ${p.s + p.c} and ● + ▲ = ${p.c + p.t}. If ■ = ${p.s}, then ▲ − ● = ______.`,
        answer: num(p.t - p.c),
        hints: [`Use ■ = ${p.s} in the first equation to find ●.`, 'Then use ● in the second equation to find ▲.'],
        steps: [`● = ${p.s + p.c} − ${p.s} = ${p.c}.`, `▲ = ${p.c + p.t} − ${p.c} = ${p.t}.`, `▲ − ● = ${p.t} − ${p.c} = ${p.t - p.c}.`],
        misconceptions: misNum(p.t - p.c, [[p.t, `▲ = ${p.t}, nice! The question asks for ▲ − ●.`], [p.c, `● = ${p.c}. Keep going: find ▲, then ▲ − ●.`]])
      };
    }
    const a = rng.int(6, 40), b = rng.int(1, a - 1);
    return {
      scene: shapeScene([`■ + ▲ = ${a + b}`, `■ − ▲ = ${a - b}`], [[`Add the two lines. The triangles cancel out: square plus square is ${a + b} + ${a - b} = ${2 * a}.`, `■ + ■ = ${2 * a}`]], `■ = ${a}`),
      text: `■ + ▲ = ${a + b} and ■ − ▲ = ${a - b}. What number is ■?`,
      answer: num(a),
      hints: ['■ is bigger than ▲ by ' + (a - b) + '.', `Add both equations: ■ + ■ = ${a + b} + ${a - b}.`],
      steps: [`Adding: ■ + ▲ + ■ − ▲ = ${2 * a}, so ■ + ■ = ${2 * a}.`, `■ = ${a}. (And ▲ = ${b}.)`],
      misconceptions: misNum(a, [[b, `${b} is ▲. The question asks for ■.`]])
    };
  }
};

/* ---------------- packages (what can't be bought) ---------------- */

export const packages: Topic = {
  id: 'packages',
  title: 'Packages & combinations',
  category: 'Puzzles',
  grades: [3],
  strategy: 'Make a table',
  guide: {
    idea: 'Make a list of every total you CAN make using the package sizes. The missing number is the one you can\'t make.',
    tips: ['List multiples of the big package: 0, 9, 18, 27…', 'Add small packages to each one.', 'Check every number in the range.'],
    traps: ['Thinking a number can\'t be made before trying every mix.']
  },
  generate: ({ rng }) => {
    const p = until(
      () => {
        const a = rng.int(3, 6), b = rng.int(a + 2, 11);
        const L = rng.int(1, 3) * 10;
        const can = (n: number) => {
          for (let i = 0; i * b <= n; i++) if ((n - i * b) % a === 0) return true;
          return false;
        };
        const bad: number[] = [];
        for (let n = L + 1; n < L + 10; n++) if (!can(n)) bad.push(n);
        return { a, b, L, bad, can };
      },
      ({ bad, a, b }) => bad.length === 1 && a !== b && gcd(a, b) === 1
    );
    const thing = rng.pick(['tennis balls', 'markers', 'cupcakes', 'crayons']);
    return {
      scene: packagesScene(p.a, p.b, p.L, p.bad[0]),
      text: `${thing[0].toUpperCase() + thing.slice(1)} come in packages of ${p.a} and packages of ${p.b}. What is the only number of ${thing} between ${p.L} and ${p.L + 10} that you can NOT buy exactly without breaking a package?`,
      answer: num(p.bad[0]),
      hints: [`Multiples of ${p.b}: ${[0, 1, 2, 3].map((i) => i * p.b).join(', ')}…`, `Add packages of ${p.a} to each of them and see which numbers you reach.`],
      steps: [
        ...Array.from({ length: 9 }, (_, i) => p.L + 1 + i)
          .filter((n) => n !== p.bad[0])
          .slice(0, 4)
          .map((n) => {
            for (let i = 0; i * p.b <= n; i++) if ((n - i * p.b) % p.a === 0) return `${n} = ${i} × ${p.b} + ${(n - i * p.b) / p.a} × ${p.a}.`;
            return '';
          }),
        `…every number except ${p.bad[0]} can be made, so the answer is ${p.bad[0]}.`
      ]
    };
  }
};

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/* ---------------- balance / weights ---------------- */

export const balance: Topic = {
  id: 'balance',
  title: 'Balance & weights',
  category: 'Puzzles',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'A balance is like an equals sign. You can swap things for other things that weigh the same, or take the same thing off both sides.',
    tips: ['Replace a thing with what it equals.', 'Take the same thing off both sides and it still balances.', 'Simplify step by step.'],
    traps: ['Taking something off only one side.']
  },
  generate: ({ grade, rng }) => {
    if (grade === 2) {
      const w = rng.int(2, 9), m = rng.int(2, 4), n = rng.int(2, 4);
      const circle = (m - 1) * w;
      return {
        scene: balanceScene(['▲', '●'], Array(m).fill('▲'), [
          { say: `Take one triangle off both sides. A circle weighs as much as ${m - 1} triangle${m > 2 ? 's' : ''}: ${m - 1} × ${w} = ${circle} ounces.`, left: ['●'], right: Array(m - 1).fill('▲') },
          { say: `${n} circles weigh ${n} × ${circle} = ${n * circle} ounces.`, left: Array(n).fill('●'), right: Array(n * (m - 1)).fill('▲'), reveal: true }
        ], `▲ = ${w} ounces`),
        text: `A ▲ weighs ${w} ounces. A ▲ and a ● together weigh as much as ${m} ▲'s. How much do ${n} ●'s weigh?`,
        answer: num(n * circle, 'ounces'),
        hints: [`Take one ▲ off both sides: ● weighs as much as ${m - 1} ▲'s.`, `So ● = ${m - 1} × ${w}.`],
        steps: [`▲ + ● = ${m} ▲'s, so ● = ${m - 1} ▲'s = ${m - 1} × ${w} = ${circle} ounces.`, `${n} ●'s = ${n} × ${circle} = ${n * circle} ounces.`],
        misconceptions: misNum(n * circle, [[circle, `${circle} ounces is ONE ●. The question asks for ${n} of them.`]])
      };
    }
    const c = rng.int(3, 7), k = rng.int(2, 4);
    const onions = c + k, potatoes = c - 1;
    return {
      scene: balanceScene([...Array(onions).fill('●'), ...Array(potatoes).fill('■')], Array(c).fill('◆'), [
        { say: 'Swap each cabbage for 1 onion and 1 potato.', left: [...Array(onions).fill('●'), ...Array(potatoes).fill('■')], right: [...Array(c).fill('●'), ...Array(c).fill('■')] },
        { say: `Take ${c} onions and ${potatoes} potatoes off both sides: ${k} onions balance 1 potato.`, left: Array(k).fill('●'), right: ['■'], reveal: true }
      ], '● onion   ■ potato   ◆ cabbage'),
      text: `${onions} onions and ${potatoes} potatoes weigh as much as ${c} cabbages. One cabbage weighs as much as 1 onion and 1 potato. How many onions weigh as much as 1 potato?`,
      answer: num(k),
      hints: [`Swap each cabbage for 1 onion + 1 potato: ${c} cabbages = ${c} onions + ${c} potatoes.`, `Now take ${c} onions and ${potatoes} potatoes off both sides.`],
      steps: [`${onions} onions + ${potatoes} potatoes = ${c} onions + ${c} potatoes.`, `Take away ${c} onions and ${potatoes} potatoes from both sides: ${k} onions = 1 potato.`],
      misconceptions: misNum(k, [[c, `${c} is the number of cabbages. Swap the cabbages for onions and potatoes first.`]])
    };
  }
};
