import type { Topic } from '../../core/types';
import { fanFigure, gridFigure, misNum, num, vennFigure } from './helpers';
import { trianglesScene, rectanglesScene, vennScene, handshakesScene } from '../scenes/logic-puzzles';

const tri = (n: number) => (n * (n + 1)) / 2;

export const countTriangles: Topic = {
  id: 'count-triangles',
  title: 'Counting triangles',
  category: 'Counting',
  grades: [2, 3],
  strategy: 'Number the sections',
  guide: {
    idea: 'Number every small section. Then count the triangles made of 1 section, then 2 sections joined together, then 3, and so on.',
    tips: ['Write a number in each small piece.', 'List the shapes like this: 1, 2, 3, then 1&2, 2&3, then 1&2&3…', 'Pattern: with n side-by-side pieces there are 1 + 2 + … + n shapes.'],
    traps: ['Counting only the small triangles.', 'Forgetting the big outside triangle.']
  },
  generate: ({ grade, level, rng }) => {
    const s = grade === 2 ? rng.int(2, level === 1 ? 3 : 4) : rng.int(3, level === 3 ? 6 : 5);
    const cross = grade === 3 && level >= 2 && rng.chance(0.4);
    const ans = cross ? 2 * tri(s) : tri(s);
    return {
      scene: trianglesScene(s, cross),
      text: `How many triangles are there in the figure? (Hint: number the sections.)`,
      figure: fanFigure(s, cross),
      speech: `Look at the figure. A big triangle is cut by lines from the top corner into ${s} sections${cross ? ', and one line goes straight across' : ''}. How many triangles are there in all?`,
      answer: num(ans),
      hints: ['Number the sections 1, 2, 3, … from left to right.', `Count single sections (${s}), then pairs that sit side by side (${s - 1}), then groups of 3…`, ...(cross ? ['The line across makes a smaller copy on top. Count the top part the same way.'] : [])],
      steps: [
        `Single sections: ${s}.`,
        ...Array.from({ length: s - 1 }, (_, k) => `${k + 2} sections together: ${s - k - 1}.`),
        `Total: ${Array.from({ length: s }, (_, k) => s - k).join(' + ')} = ${tri(s)}.`,
        ...(cross ? [`The top part has ${tri(s)} triangles too, so ${tri(s)} × 2 = ${ans}.`] : [])
      ],
      misconceptions: misNum(ans, [[s, 'Those are only the small triangles. Sections next to each other make bigger triangles too.'], [s + 1, 'Good start! You still need the triangles made of 2 or more sections joined together.']])
    };
  }
};

export const countRectangles: Topic = {
  id: 'count-rectangles',
  title: 'Counting rectangles & squares',
  category: 'Counting',
  grades: [2, 3],
  strategy: 'Number the sections',
  guide: {
    idea: 'For a row of n boxes there are 1 + 2 + … + n rectangles. For a grid, multiply the row count by the column count.',
    tips: ['Number the small boxes.', 'Count rectangles of each size, one size at a time.', 'Squares are rectangles too!'],
    traps: ['Counting only the smallest boxes.']
  },
  generate: ({ grade, level, rng }) => {
    const rows = grade === 2 ? 1 : rng.int(1, level === 3 ? 3 : 2);
    const cols = rng.int(2, grade === 2 ? 4 : 4);
    const squares = grade === 3 && level === 3 && rows > 1 && rng.chance(0.5);
    let ans = tri(rows) * tri(cols);
    let sq = 0;
    for (let k = 1; k <= Math.min(rows, cols); k++) sq += (rows - k + 1) * (cols - k + 1);
    if (squares) ans = sq;
    return {
      scene: rectanglesScene(rows, cols, squares),
      text: squares ? `The figure is a grid of equal squares. How many squares of any size are in it?` : `How many rectangles are there in the figure? (Squares count too.)`,
      figure: gridFigure(rows, cols),
      speech: `The figure is a grid with ${rows} row${rows > 1 ? 's' : ''} and ${cols} columns of boxes. ${squares ? 'How many squares of any size are there?' : 'How many rectangles are there in all? Squares count too.'}`,
      answer: num(ans),
      hints: squares
        ? ['Count the 1 × 1 squares first.', 'Then count the 2 × 2 squares. Where can a 2 × 2 block fit?']
        : [`In one row of ${cols} boxes there are ${Array.from({ length: cols }, (_, k) => cols - k).join(' + ')} = ${tri(cols)} rectangles.`, ...(rows > 1 ? [`There are ${tri(rows)} ways to choose a band of rows, so multiply.`] : [])],
      steps: squares
        ? Array.from({ length: Math.min(rows, cols) }, (_, k) => `${k + 1} × ${k + 1} squares: ${(rows - k) * (cols - k)}.`).concat([`Total: ${sq}.`])
        : [`Across: ${tri(cols)} ways.`, ...(rows > 1 ? [`Down: ${tri(rows)} ways.`, `${tri(cols)} × ${tri(rows)} = ${ans}.`] : [`Total: ${ans}.`])],
      misconceptions: misNum(ans, [[rows * cols, 'Those are only the smallest boxes. Boxes joined together make bigger rectangles.']])
    };
  }
};

export const venn: Topic = {
  id: 'venn',
  title: 'Venn diagrams',
  category: 'Counting',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'Each number tells how many are in that exact region. To count everyone in a circle, add ALL the regions inside it, including the overlaps.',
    tips: ['Put your finger on the circle and trace around it.', 'Add every number you see inside it.', '"Both A and B" means only the part where A and B overlap.'],
    traps: ['Adding only the part of the circle that does not overlap.']
  },
  generate: ({ grade, level, rng }) => {
    const r = Array.from({ length: 7 }, (_, i) => rng.int(i < 3 ? 5 : 1, grade === 2 ? (i < 3 ? 30 : 9) : i < 3 ? 45 : 15));
    const labels: [string, string, string] = ['Soccer', 'Band', 'Chorus'];
    const [a, b, c, ab, ac, bc, abc] = r;
    const q = level === 1 ? 0 : rng.int(0, grade === 3 ? 2 : 1);
    const setName = rng.int(0, 2);
    const circles = [
      { name: labels[0], parts: [a, ab, ac, abc] },
      { name: labels[1], parts: [b, ab, bc, abc] },
      { name: labels[2], parts: [c, ac, bc, abc] }
    ];
    if (q === 0) {
      const ci = circles[setName];
      const ans = ci.parts.reduce((s, v) => s + v, 0);
      return {
        scene: vennScene(labels, r, [[0, 3, 4, 6], [1, 3, 5, 6], [2, 4, 5, 6]][setName], `Trace around ${ci.name} and add every number inside it.`),
        text: `The circles show the students in each club. How many students are in ${ci.name}?`,
        figure: vennFigure(labels, r),
        speech: `Look at the three circles: Soccer, Band and Chorus. How many students are in ${ci.name}?`,
        answer: num(ans),
        hints: [`Trace around the ${ci.name} circle.`, `Add all 4 numbers inside it: ${ci.parts.join(', ')}.`],
        steps: [`Inside ${ci.name}: ${ci.parts.join(' + ')} = ${ans}.`],
        misconceptions: misNum(ans, [[ci.parts[0], `${ci.parts[0]} are ONLY in ${ci.name}. The overlap parts are in ${ci.name} too.`]])
      };
    }
    if (q === 1) {
      const pairs = [
        { names: [labels[0], labels[1]], parts: [ab, abc] },
        { names: [labels[0], labels[2]], parts: [ac, abc] },
        { names: [labels[1], labels[2]], parts: [bc, abc] }
      ];
      const pr = pairs[setName];
      const ans = pr.parts[0] + pr.parts[1];
      return {
        scene: vennScene(labels, r, [[3, 6], [4, 6], [5, 6]][setName], `Find where ${pr.names[0]} and ${pr.names[1]} overlap, including the very middle.`),
        text: `How many students are in BOTH ${pr.names[0]} and ${pr.names[1]}?`,
        figure: vennFigure(labels, r),
        speech: `Look at the three circles. How many students are in both ${pr.names[0]} and ${pr.names[1]}?`,
        answer: num(ans),
        hints: [`Find where ${pr.names[0]} and ${pr.names[1]} overlap.`, 'The middle part (in all three) is inside that overlap too.'],
        steps: [`${pr.names[0]} and ${pr.names[1]} overlap: ${pr.parts[0]} + ${pr.parts[1]} (the centre) = ${ans}.`],
        misconceptions: misNum(ans, [[pr.parts[0], 'Do not forget the very middle part. Those students are in all three clubs, so they are in both of these.']])
      };
    }
    const exactlyOne = a + b + c;
    return {
      scene: vennScene(labels, r, [0, 1, 2], 'Exactly one club means the parts with no overlap.'),
      text: `How many students are in exactly ONE club?`,
      figure: vennFigure(labels, r),
      speech: 'Look at the three circles. How many students are in exactly one club?',
      answer: num(exactlyOne),
      hints: ['Exactly one club means the parts with no overlap.', 'There are 3 such parts.'],
      steps: [`${a} + ${b} + ${c} = ${exactlyOne}.`],
      misconceptions: misNum(exactlyOne, [[r.reduce((s, v) => s + v, 0), 'That is everyone. Exactly one club means only the parts that do not overlap.']])
    };
  }
};

export const handshakes: Topic = {
  id: 'handshakes',
  title: 'Handshakes & games',
  category: 'Counting',
  grades: [3],
  strategy: 'Make a list',
  guide: {
    idea: 'If everyone shakes hands with everyone else once, the first person shakes with all the others, the next shakes with one fewer new people, and so on.',
    tips: ['Act it out with a small group first (3 people = 3 handshakes).', 'Add: (n−1) + (n−2) + … + 1.', 'A handshake between Ava and Ben is the same as one between Ben and Ava.'],
    traps: ['Counting each handshake twice.']
  },
  generate: ({ level, rng }) => {
    const n = rng.int(4, level === 3 ? 12 : 8);
    const ans = (n * (n - 1)) / 2;
    const ctx = rng.pick([
      { t: `${n} friends meet at a party. Each friend shakes hands with every other friend exactly once. How many handshakes are there?` },
      { t: `${n} teams are in a tournament. Each team plays every other team exactly once. How many games are played?` }
    ]);
    return {
      scene: handshakesScene(n, ctx.t.includes('teams')),
      text: ctx.t,
      answer: num(ans),
      hints: [`The first one meets ${n - 1} others.`, `The next has only ${n - 2} new ones left.`, 'Keep going and add them up.'],
      steps: [`${Array.from({ length: n - 1 }, (_, k) => n - 1 - k).join(' + ')} = ${ans}.`],
      misconceptions: misNum(ans, [[n * (n - 1), 'You counted each one twice. Ava–Ben is the same as Ben–Ava, so halve it.'], [n * n, 'Nobody shakes hands with themselves, and each pair only counts once.']])
    };
  }
};
