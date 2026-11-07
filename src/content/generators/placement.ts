import type { AnswerSpec, Topic } from '../../core/types';
import type { Rng } from '../../core/rng';
import { slotName } from '../../core/answer';
import { misNum, num, permutations, until } from './helpers';
import { spotPalScene, nextPalScene, palindromeScene, cornerScene, boardScene } from '../scenes/logic-puzzles';

/* ======================= figures ======================= */

const open = (w: number, h: number, label: string) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}" class="figure" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" font-family="ui-rounded, system-ui, sans-serif">`;

/**
 * Board with numbered slots. Slots carry data-slot so the UI can make them tappable:
 * the digit text is `.slot-digit`, the small letter is `.slot-label`.
 */
function board(points: [number, number][], lines: number[][], fixed: Record<number, number>, w: number, h: number, label: string): string {
  let s = open(w, h, label);
  for (const line of lines) {
    const pts = line.map((i) => points[i].join(',')).join(' ');
    s += `<polyline points="${pts}" stroke-width="3" opacity="0.45"/>`;
  }
  points.forEach(([x, y], i) => {
    const given = fixed[i];
    s += `<g class="slot${given !== undefined ? ' fixed' : ''}" data-slot="${i}"${given !== undefined ? ` data-fixed="${given}"` : ''}>` +
      `<circle cx="${x}" cy="${y}" r="25" fill="var(--surface, #fff)" stroke-width="2.5"/>` +
      `<text class="slot-digit" x="${x}" y="${y + 9}" text-anchor="middle" font-size="26" font-weight="800" fill="currentColor" stroke="none">${given ?? ''}</text>` +
      `<text class="slot-label" x="${x + 21}" y="${y - 19}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" stroke="none" opacity="0.6">${slotName(i)}</text>` +
      `</g>`;
  });
  return s + '</svg>';
}

const CROSS: [number, number][] = [[130, 36], [36, 130], [130, 130], [224, 130], [130, 224]];
const CROSS_LINES = [[0, 2, 4], [1, 2, 3]];
const TRI: [number, number][] = [[150, 34], [100, 124], [44, 218], [150, 218], [256, 218], [200, 124]];
const TRI_LINES = [[0, 1, 2], [2, 3, 4], [4, 5, 0]];

/** Boxes for a palindrome template; blanks are shown empty. */
export function palindromeFigure(template: (number | null)[]): string {
  const bw = 40, gap = 8;
  const w = template.length * (bw + gap) + 12;
  let s = open(w, 64, 'palindrome boxes');
  template.forEach((d, i) => {
    const x = 6 + i * (bw + gap);
    s += `<rect x="${x}" y="8" width="${bw}" height="48" rx="8" stroke-width="2.5"/>`;
    if (d !== null) s += `<text x="${x + bw / 2}" y="42" text-anchor="middle" font-size="26" font-weight="800" fill="currentColor" stroke="none">${d}</text>`;
  });
  return s + '</svg>';
}

function cornerSquareFigure(sides: [number, number][]): string {
  const c: [number, number][] = [[40, 40], [260, 40], [260, 260], [40, 260]];
  let s = open(300, 300, 'a square with a mystery number in each corner');
  s += `<rect x="40" y="40" width="220" height="220" stroke-width="2.5" opacity="0.6"/>`;
  const t = (x: number, y: number, v: number | string) =>
    `<rect x="${x - 17}" y="${y - 17}" width="34" height="34" rx="6" fill="var(--surface, #fff)" stroke-width="2"/><text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="currentColor" stroke="none">${v}</text>`;
  // top, right, bottom, left — two numbers on each side
  const pos: [number, number][][] = [
    [[113, 40], [187, 40]],
    [[260, 113], [260, 187]],
    [[187, 260], [113, 260]],
    [[40, 187], [40, 113]]
  ];
  sides.forEach((pair, i) => pair.forEach((v, j) => (s += t(pos[i][j][0], pos[i][j][1], v))));
  c.forEach(([x, y]) => (s += `<circle cx="${x}" cy="${y}" r="22" fill="var(--surface, #fff)" stroke-width="2.5"/><text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor" stroke="none">?</text>`));
  return s + '</svg>';
}

/* ======================= palindromes ======================= */

const isPal = (n: number) => String(n) === String(n).split('').reverse().join('');

function templatePuzzle(rng: Rng, k: number) {
  const digits = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], k).sort((a, b) => a - b);
  const len = 2 * k - 1;
  const half = (p: number) => Math.min(p, len - 1 - p);
  const truthHalf = rng.shuffle(digits);
  const full = Array.from({ length: len }, (_, p) => truthHalf[half(p)]);
  const candidates = permutations(digits);
  const reveal = new Map<number, number>();
  const fits = () => candidates.filter((c) => [...reveal].every(([p, d]) => c[half(p)] === d));
  for (const p of rng.shuffle([...Array(len).keys()])) {
    if (fits().length === 1) break;
    const before = fits().length;
    reveal.set(p, full[p]);
    if (fits().length === before) reveal.delete(p);
  }
  // drop any reveal that is not needed
  for (const p of [...reveal.keys()]) {
    const d = reveal.get(p)!;
    reveal.delete(p);
    if (fits().length !== 1) reveal.set(p, d);
  }
  const template = full.map((d, p) => (reveal.has(p) ? d : null));
  return { digits, full, template, half };
}

export const palindromes: Topic = {
  id: 'palindromes',
  title: 'Palindromes',
  category: 'Puzzles',
  grades: [2, 3],
  strategy: 'Look for a pattern',
  guide: {
    idea: 'A palindrome reads the same forwards and backwards, like 22, 252, 3,443 or 10,601. The first digit matches the last, the second matches the second-to-last, and so on.',
    tips: [
      'Draw lines joining matching places: 1st ↔ last, 2nd ↔ 2nd-to-last…',
      'A digit you can see also belongs in its mirror place.',
      'With an odd number of digits, the middle digit has no partner, so it appears only once.',
      'To find the next palindrome, copy the left half onto the right, then make the middle bigger if needed.'
    ],
    traps: ['Forgetting to use every digit you were given.', 'Writing a number that is not the same backwards. Always read it backwards to check.']
  },
  generate: ({ grade, level, rng }) => {
    if (level === 1) {
      const digits = grade === 2 ? rng.int(3, 4) : rng.int(4, 5);
      const pal = until(
        () => {
          const half = Array.from({ length: Math.ceil(digits / 2) }, (_, i) => rng.int(i === 0 ? 1 : 0, 9));
          return +[...half, ...half.slice(0, Math.floor(digits / 2)).reverse()].join('');
        },
        (n) => new Set(String(n)).size > 1
      );
      const s = String(pal).split('');
      const wrong = new Set<number>();
      let guard = 0;
      while (wrong.size < 3 && guard++ < 200) {
        const t = [...s];
        const i = rng.int(0, t.length - 2);
        if (rng.chance(0.5)) [t[i], t[i + 1]] = [t[i + 1], t[i]];
        else t[rng.int(1, t.length - 1)] = String(rng.int(0, 9));
        const n = +t.join('');
        if (t[0] !== '0' && !isPal(n) && n !== pal) wrong.add(n);
      }
      const options = rng.shuffle([pal, ...wrong]).map((n) => n.toLocaleString('en-US'));
      const letter = String.fromCharCode(97 + options.indexOf(pal.toLocaleString('en-US')));
      const answer: AnswerSpec = { kind: 'choice', value: letter, options };
      return {
        scene: spotPalScene(options, options.indexOf(pal.toLocaleString('en-US'))),
        text: `A palindrome is a number that reads the same forward or backward. Which of these is a palindrome? ${options.map((o, i) => `(${String.fromCharCode(97 + i)}) ${o}`).join('   ')}`,
        speech: `A palindrome is a number that reads the same forward or backward. Which of these is a palindrome? ${options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}.`).join(' ')}`,
        answer,
        hints: ['Read each number backwards, digit by digit.', 'Check the first digit against the last digit first. That rules out most choices quickly.'],
        steps: [...options.map((o) => `${o} backwards is ${o.replace(/,/g, '').split('').reverse().join('')}${o === pal.toLocaleString('en-US') ? ', the same ✔' : ', which is different'}.`), `Answer: (${letter}) ${pal.toLocaleString('en-US')}.`]
      };
    }
    if (grade === 3 && level === 3 && rng.chance(0.5)) {
      const n = rng.int(1000, 9800);
      let next = n + 1;
      while (!isPal(next)) next++;
      const firstTry = +(String(n).slice(0, 2) + String(n).slice(0, 2).split('').reverse().join(''));
      return {
        scene: nextPalScene(n, firstTry, next),
        text: `A palindrome reads the same forward or backward, like 4,334. What is the smallest palindrome that is greater than ${n.toLocaleString('en-US')}?`,
        answer: num(next),
        hints: [`Copy the first two digits of ${n} onto the end, backwards: ${firstTry}.`, `Is ${firstTry} bigger than ${n}? If not, make the middle digits 1 bigger and try again.`],
        steps: [
          `Mirror the left half: ${String(n).slice(0, 2)} → ${firstTry}.`,
          firstTry > n ? `${firstTry} is bigger than ${n}, so it is the answer.` : `${firstTry} is not bigger than ${n}, so increase the middle: ${next}.`,
          `Check: ${next} backwards is ${String(next).split('').reverse().join('')}. ✔`
        ],
        misconceptions: misNum(next, [[firstTry, `${firstTry} is a palindrome, but it is not greater than ${n}. Make the middle bigger.`]])
      };
    }
    const k = grade === 2 ? 3 : 4;
    const p = templatePuzzle(rng, k);
    const shown = p.template.map((d) => (d === null ? '_' : d)).join(' ');
    const mirrors = p.template
      .map((d, i) => (d !== null && p.template[p.full.length - 1 - i] === null ? `${d} also goes in place ${p.full.length - i}` : ''))
      .filter(Boolean);
    return {
      scene: palindromeScene(p.template, p.full, p.digits),
      text: `A palindrome is a number that reads the same forward or backward, like 252 or 3,443. Using all ${k} digits ${p.digits.join(', ')}, complete the ${p.full.length}-digit palindrome: **${shown}**`,
      speech: `A palindrome reads the same forward or backward, like 2 5 2. Using all ${k} digits ${p.digits.join(', ')}, complete the ${p.full.length} digit palindrome. The boxes show: ${p.template.map((d) => (d === null ? 'blank' : d)).join(', ')}. Say every digit, from left to right.`,
      figure: palindromeFigure(p.template),
      answer: { kind: 'digits', value: p.full.join('') },
      hints: [
        'The 1st and last digits match, and so do the 2nd and 2nd-to-last.',
        mirrors.length ? `Copy each digit to its mirror place: ${mirrors[0]}.` : 'The middle digit appears only once.',
        `Every one of ${p.digits.join(', ')} must appear. Which digit is still missing?`
      ],
      steps: [
        `Mirror pairs: places 1 & ${p.full.length}, 2 & ${p.full.length - 1}${k > 3 ? `, 3 & ${p.full.length - 2}` : ''}. The middle is place ${k}.`,
        ...mirrors.map((m) => m.charAt(0).toUpperCase() + m.slice(1) + '.'),
        `Use the last unused digit in the remaining places.`,
        `Palindrome: ${p.full.join('')}. Backwards it is the same. ✔`
      ]
    };
  }
};

/* ======================= digit placement ======================= */

function solveLayout(digits: number[], lines: number[][], rng: Rng) {
  const byTarget = new Map<number, number[][]>();
  for (const perm of permutations(digits)) {
    const sums = lines.map((l) => l.reduce((s, i) => s + perm[i], 0));
    if (sums.every((v) => v === sums[0])) byTarget.set(sums[0], [...(byTarget.get(sums[0]) ?? []), perm]);
  }
  const target = rng.pick([...byTarget.keys()]);
  const sols = byTarget.get(target)!;
  return { target, solution: rng.pick(sols), count: sols.length };
}

export const digitPlacement: Topic = {
  id: 'digit-placement',
  title: 'Digit placement & magic sums',
  category: 'Puzzles',
  grades: [2, 3],
  strategy: 'Use logical reasoning',
  guide: {
    idea: 'Some circles sit on two lines at once, so they get counted twice. Find those "shared" spots first and the rest gets easy.',
    tips: [
      'Add ALL the digits. Then add up what all the lines need together.',
      'The difference between those two totals comes from the shared spots.',
      'Put the shared digits in first, then pair up the rest so each line reaches the target.',
      'Check every line at the end.'
    ],
    traps: ['Using a digit twice, or leaving one out.', 'Only checking one of the lines.']
  },
  generate: ({ grade, level, rng }) => {
    if (level === 1) {
      const T = rng.int(grade === 2 ? 12 : 14, grade === 2 ? 18 : 24);
      const x = until(() => rng.int(1, 9), (v) => T - 2 * v >= 2 && T - 2 * v <= 16);
      const m = T - 2 * x;
      const sides = Array.from({ length: 4 }, () => {
        const a = until(() => rng.int(0, 9), (v) => m - v >= 0 && m - v <= 9 && v !== m - v);
        return [a, m - a] as [number, number];
      });
      return {
        scene: cornerScene(sides, T, x),
        text: `Find the one number that can be placed in all 4 corners of the square so that each side adds to ${T}.`,
        speech: `Look at the square. Each side has two numbers and two corners. The same mystery number goes in all 4 corners. Which number makes each side add to ${T}? The sides have ${sides.map((p) => `${p[0]} and ${p[1]}`).join('; ')}.`,
        figure: cornerSquareFigure(sides),
        answer: num(x),
        hints: [`Each side has 2 corners, so the side total = 2 × corner + the two numbers.`, `On the top side: ${sides[0][0]} + ${sides[0][1]} = ${m}. What is left to make ${T}?`],
        steps: [`Top side: ${sides[0][0]} + ${sides[0][1]} = ${m}.`, `${T} − ${m} = ${T - m} must come from 2 corners.`, `${T - m} ÷ 2 = ${x}.`, `Check: every side's two numbers add to ${m}, and ${m} + ${x} + ${x} = ${T}. ✔`],
        misconceptions: misNum(x, [[T - m, `${T - m} is what BOTH corners on a side add up to. Each corner is half of that.`]])
      };
    }
    const triangle = grade === 3 && level === 3;
    if (triangle) {
      const digits = [1, 2, 3, 4, 5, 6];
      const { target, solution } = solveLayout(digits, TRI_LINES, rng);
      const corners = solution[0] + solution[2] + solution[4];
      return {
        scene: boardScene(TRI, TRI_LINES, target, solution, [0, 2, 4], [`1 + 2 + 3 + 4 + 5 + 6 = 21. The three sides together need 3 × ${target} = ${3 * target}.`, `The corners are counted twice, so they add to ${3 * target} − 21 = ${3 * target - 21}.`]),
        text: `Place each of the digits 1 to 6 in a different circle so that the three numbers along each side of the triangle add to ${target}.`,
        speech: `Place each digit from 1 to 6 in a different circle, so the three numbers on each side of the triangle add to ${target}. Tap a circle, then a digit. Or say the digits for circles A to F in order.`,
        figure: board(TRI, TRI_LINES, {}, 300, 252, 'a triangle with six circles'),
        answer: { kind: 'placement', digits, lines: TRI_LINES, target, solution },
        hints: [
          `1 + 2 + 3 + 4 + 5 + 6 = 21. The three sides together need 3 × ${target} = ${3 * target}.`,
          `The corner circles are counted twice, so the corners add to ${3 * target} − 21 = ${3 * target - 21}.`,
          'Pick three digits for the corners with that sum, then fill in the middles.'
        ],
        steps: [`All digits: 21. All sides: 3 × ${target} = ${3 * target}.`, `Corners (counted twice) add to ${3 * target - 21}.`, `One answer: corners ${solution[0]}, ${solution[2]}, ${solution[4]} (sum ${corners}); middles ${solution[1]}, ${solution[3]}, ${solution[5]}.`, ...TRI_LINES.map((l) => `${l.map((i) => solution[i]).join(' + ')} = ${target} ✔`)]
      };
    }
    const start = grade === 2 ? rng.int(1, 2) : rng.int(1, 4);
    const digits = [0, 1, 2, 3, 4].map((i) => start + i);
    const { target, solution } = solveLayout(digits, CROSS_LINES, rng);
    const total = digits.reduce((a, b) => a + b, 0);
    const middle = 2 * target - total;
    return {
      scene: boardScene(CROSS, CROSS_LINES, target, solution, [2], [`${digits.join(' + ')} = ${total}. Both lines together need ${2 * target}.`, `The middle is counted twice, so it is ${2 * target} − ${total} = ${middle}.`]),
      text: `Place each of the 5 digits ${digits.join(', ')} in a different circle so that the sum of the 3 numbers in each direction (across and down) is ${target}.`,
      speech: `Place each of the digits ${digits.join(', ')} in a different circle, so the 3 numbers across add to ${target} and the 3 numbers down add to ${target}. Tap a circle, then a digit. Or say the digits for circles A to E in order.`,
      figure: board(CROSS, CROSS_LINES, {}, 260, 260, 'five circles in a plus shape'),
      answer: { kind: 'placement', digits, lines: CROSS_LINES, target, solution },
      hints: [
        `The middle circle (C) is in BOTH lines.`,
        `All five digits add to ${total}. Both lines together need ${target} + ${target} = ${2 * target}.`,
        `The middle digit is counted twice, so it is ${2 * target} − ${total} = ${middle}.`
      ],
      steps: [
        `${digits.join(' + ')} = ${total}. Two lines need ${2 * target}.`,
        `Middle = ${2 * target} − ${total} = ${middle}.`,
        `Pair the other digits so each pair adds to ${target - middle}: ${solution[0]} & ${solution[4]}, ${solution[1]} & ${solution[3]}.`,
        `One answer: A=${solution[0]}, B=${solution[1]}, C=${solution[2]}, D=${solution[3]}, E=${solution[4]}. (The pairs can swap places.)`
      ],
      misconceptions: []
    };
  }
};
