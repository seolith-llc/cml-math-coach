import type { Topic } from '../../core/types';
import { digitSum, fmtN, misNum, num, until } from './helpers';

export const missingNumber: Topic = {
  id: 'missing-number',
  title: 'Find the missing number',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Work backwards',
  guide: {
    idea: 'A box □ is a number hiding from you. An equals sign means both sides are worth the same amount, like a balanced see-saw.',
    tips: [
      'Work out the side that has no box first.',
      'Then ask: what number makes the other side match?',
      'Check by putting your number in the box and reading it out loud.'
    ],
    traps: ['Adding when you should subtract. In 32 − □ = 28, the box is the gap between 32 and 28.', 'Forgetting to answer the real question when it asks for something like 43 + □.']
  },
  generate: ({ grade, level, rng }) => {
    const big = grade === 3 ? 90 : 60;
    if (level === 1) {
      const a = rng.int(20, big);
      const box = rng.int(3, Math.min(19, a - 5));
      const b = a - box;
      return {
        text: `If ${a} − □ = ${b}, what number goes in the □?`,
        answer: num(box),
        hints: [`Ask: ${a} take away what gives ${b}?`, `Find the difference between ${a} and ${b}.`],
        steps: [`${a} − ${b} = ${box}.`, `Check: ${a} − ${box} = ${b}. ✔`],
        misconceptions: misNum(box, [[a + b, `It looks like you added ${a} and ${b}. The box is the amount taken away to get from ${a} down to ${b}.`]])
      };
    }
    if (level === 2 || grade === 2) {
      const a = rng.int(20, big);
      const b = rng.int(5, a - 8);
      const left = a - b;
      const c = rng.int(2, left - 1);
      const box = left - c;
      return {
        text: `${a} − ${b} = ${c} + □. Find the number that belongs in the □.`,
        answer: num(box),
        hints: [`First work out the left side: ${a} − ${b}.`, `Now ask: ${c} plus what equals ${left}?`],
        steps: [`Left side: ${a} − ${b} = ${left}.`, `${c} + □ = ${left}, so □ = ${left} − ${c} = ${box}.`],
        misconceptions: misNum(box, [
          [left, `${left} is the value of the left side. But the right side already has ${c} in it, so the box must be smaller.`],
          [left + c, `You added ${c}. The box plus ${c} has to equal ${left}, so take ${c} away.`]
        ])
      };
    }
    // Grade 3 challenge: two-step
    const a = rng.int(30, 95);
    const box = rng.int(4, 19);
    const b = a - box;
    const c = rng.int(20, 80);
    return {
      text: `If ${a} − □ = ${b}, then how much is ${c} + □?`,
      answer: num(c + box),
      hints: ['Two steps: first find the box.', `${a} − □ = ${b} means □ = ${a} − ${b}.`],
      steps: [`□ = ${a} − ${b} = ${box}.`, `${c} + ${box} = ${c + box}.`],
      misconceptions: misNum(c + box, [[box, `Great, the box is ${box}! But the question asks for ${c} + □. Finish the last step.`]])
    };
  }
};

export const compareResults: Topic = {
  id: 'compare-results',
  title: 'How much more is one answer?',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Write a number sentence',
  guide: {
    idea: 'Solve each problem on its own, then find the difference between the two answers.',
    tips: ['Solve problem 1. Solve problem 2.', 'Bigger answer − smaller answer = how much more.', 'Check: smaller + difference = bigger.'],
    traps: ['Stopping after you find one of the answers.', 'Adding the two answers instead of subtracting.']
  },
  generate: ({ grade, level, rng }) => {
    const hi = grade === 3 ? (level === 3 ? 400 : 200) : 70;
    const make = () => {
      const a = rng.int(10, hi), b = rng.int(5, hi / 2);
      const c = rng.int(10, hi), d = rng.int(5, hi / 2);
      const op2 = grade === 3 && rng.chance(0.5) ? '-' : '+';
      const r1 = a + b;
      const r2 = op2 === '+' ? c + d : c - d;
      return { a, b, c, d, op2, r1, r2 };
    };
    const p = until(make, (p) => p.r2 > 0 && p.r1 !== p.r2);
    const diff = Math.abs(p.r1 - p.r2);
    const second = `${p.c} ${p.op2 === '+' ? '+' : '−'} ${p.d}`;
    return {
      text: `Look at the two problems: **${p.a} + ${p.b}** and **${second}**. The larger answer is ______ more than the smaller answer.`,
      answer: num(diff),
      hints: ['Work out both answers first.', `${p.a} + ${p.b} = ${p.r1}. Now do ${second}.`, 'Then subtract the smaller answer from the larger one.'],
      steps: [`${p.a} + ${p.b} = ${p.r1}.`, `${second} = ${p.r2}.`, `${Math.max(p.r1, p.r2)} − ${Math.min(p.r1, p.r2)} = ${diff}.`],
      misconceptions: misNum(diff, [
        [p.r1, `${p.r1} is the answer to the first problem. Now find how much more one answer is than the other.`],
        [p.r2, `${p.r2} is the answer to the second problem. Now subtract to compare the two answers.`],
        [p.r1 + p.r2, 'You added the two answers. "How much more" means subtract.']
      ])
    };
  }
};

export const sumDifference: Topic = {
  id: 'sum-difference',
  title: 'Sum and difference',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Guess and check',
  guide: {
    idea: 'If you know the sum of two numbers and how far apart they are, you can find them both.',
    tips: [
      'Take the difference away from the sum. What is left is two equal parts.',
      'Halve it to get the smaller number. Add the difference to get the larger one.',
      'Or guess and check: try a pair, then adjust.'
    ],
    traps: ['Just halving the sum. That only works when the numbers are equal.', 'Giving the smaller number when the question asks for the larger.']
  },
  generate: ({ grade, level, rng }) => {
    const small = grade === 2 ? rng.int(4, 20) : rng.int(10, level === 3 ? 120 : 50);
    const d = grade === 2 ? rng.int(2, 8) : rng.int(4, level === 3 ? 60 : 24);
    const large = small + d;
    const s = small + large;
    if (grade === 2 || (level === 1 && rng.chance(0.5))) {
      return {
        text: `The sum of two numbers is ${s}. One number is ${d} more than the other. What is the larger number?`,
        answer: num(large),
        hints: [`Take away the extra ${d} first: ${s} − ${d}.`, 'Split what is left into two equal parts.', `Add the ${d} back to one part.`],
        steps: [`${s} − ${d} = ${s - d}.`, `${s - d} ÷ 2 = ${small} is the smaller number.`, `${small} + ${d} = ${large}.`, `Check: ${small} + ${large} = ${s}. ✔`],
        misconceptions: misNum(large, [
          [small, `${small} is the smaller number. The question wants the larger one: ${small} + ${d}.`],
          [s / 2, 'Halving the sum makes the numbers equal, but they are different. Take the difference away first.']
        ])
      };
    }
    return {
      text: `The sum of two numbers is ${s}. The difference between the two numbers is ${d}. The larger of the two numbers is ______.`,
      answer: num(large),
      hints: ['Picture the larger number as the smaller number plus an extra piece.', `Remove the extra piece: ${s} − ${d} = ${s - d}.`, 'Halve that, then add the difference back.'],
      steps: [`${s} − ${d} = ${s - d}.`, `${s - d} ÷ 2 = ${small} (smaller).`, `${small} + ${d} = ${large} (larger).`],
      misconceptions: misNum(large, [
        [small, `${small} is the smaller number. Add ${d} to get the larger one.`],
        [s - d, `Good start! ${s - d} is two equal parts. Halve it, then add ${d}.`]
      ])
    };
  }
};

export const productSum: Topic = {
  id: 'product-sum',
  title: 'Multiply to __, add to __',
  category: 'Number sense',
  grades: [3],
  strategy: 'Make a list',
  guide: {
    idea: 'List every pair of numbers that multiply to the target. Then check which pair adds to the other number.',
    tips: ['Start with 1 × the number and work up.', 'Write each pair down so you do not miss any.', 'Check the sum of every pair.'],
    traps: ['Stopping at the first pair you think of.', 'Mixing up multiply and add.']
  },
  generate: ({ level, rng }) => {
    const p = until(
      () => {
        const a = rng.int(2, level === 3 ? 15 : 10);
        const b = rng.int(2, level === 3 ? 15 : 10);
        return { a, b };
      },
      ({ a, b }) => a !== b
    );
    const prod = p.a * p.b, sum = p.a + p.b;
    const pairs: string[] = [];
    for (let i = 1; i * i <= prod; i++) if (prod % i === 0) pairs.push(`${i} × ${prod / i} (sum ${i + prod / i})`);
    return {
      text: `Find 2 numbers that multiply to ${prod} and add to ${sum}.`,
      answer: { kind: 'set', values: [p.a, p.b] },
      hints: [`List the pairs that multiply to ${prod}: 1 × ${prod}, 2 × …`, `Now add each pair. Which one makes ${sum}?`],
      steps: ['Pairs: ' + pairs.join(', ') + '.', `${Math.min(p.a, p.b)} and ${Math.max(p.a, p.b)} multiply to ${prod} and add to ${sum}.`]
    };
  }
};

export const distanceAway: Topic = {
  id: 'distance-away',
  title: 'How far away? (number line)',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'Draw a number line. "7 away from 10" can be 7 steps left (3) OR 7 steps right (17).',
    tips: ['Check both directions for each clue.', 'The answer is the number that fits every clue.', 'In "twice as far" problems, cut the gap into equal pieces.'],
    traps: ['Only checking one direction.', 'Forgetting there can be a second answer beyond the far end.']
  },
  generate: ({ grade, level, rng }) => {
    if (grade === 3 && level >= 2) {
      const x = rng.int(2, 20);
      const gap = 3 * rng.int(2, 6);
      const y = x + gap;
      const inner = x + (2 * gap) / 3;
      const outer = y + gap;
      return {
        text: `There are 2 numbers that are twice as far from ${x} as they are from ${y}. What are the 2 numbers?`,
        answer: { kind: 'set', values: [inner, outer] },
        hints: [`The gap from ${x} to ${y} is ${gap}. Cut it into 3 equal pieces.`, `One number is 1 piece from ${y} and 2 pieces from ${x}.`, `For the other, go past ${y} by the whole gap of ${gap}.`],
        steps: [`${y} − ${x} = ${gap}. Three pieces of ${gap / 3}.`, `${inner} is ${gap / 3} from ${y} and ${(2 * gap) / 3} from ${x}. ✔`, `${outer} is ${gap} from ${y} and ${2 * gap} from ${x}. ✔`]
      };
    }
    const p = until(
      () => {
        const n = rng.int(5, grade === 2 ? 30 : 60);
        const a = rng.int(2, 9), b = rng.int(2, 9);
        const x = n + (rng.chance(0.5) ? a : -a);
        const y = n + (rng.chance(0.5) ? b : -b);
        return { n, a, b, x, y };
      },
      ({ a, b, x, y }) => {
        if (x === y || x < 0 || y < 0) return false;
        const fromX = [x - a, x + a];
        const fromY = [y - b, y + b];
        return fromX.filter((v) => fromY.includes(v)).length === 1;
      }
    );
    return {
      text: `What number is ${p.a} away from ${p.x} and ${p.b} away from ${p.y}?`,
      answer: num(p.n),
      hints: [`Numbers ${p.a} away from ${p.x}: ${p.x - p.a} and ${p.x + p.a}.`, `Numbers ${p.b} away from ${p.y}: ${p.y - p.b} and ${p.y + p.b}.`, 'Which number is in both lists?'],
      steps: [`${p.a} away from ${p.x}: ${p.x - p.a} or ${p.x + p.a}.`, `${p.b} away from ${p.y}: ${p.y - p.b} or ${p.y + p.b}.`, `The number in both lists is ${p.n}.`]
    };
  }
};

export const digitCount: Topic = {
  id: 'digit-count',
  title: 'Counting digits',
  category: 'Counting',
  grades: [2, 3],
  strategy: 'Make a list',
  guide: {
    idea: 'Count the digit in the ones place and the tens place separately. Then add the two counts.',
    tips: ['Ones place first: 4, 14, 24, …', 'Then the tens place: 40, 41, … 49.', 'A number like 44 counts TWICE.'],
    traps: ['Counting 44 only once.', 'Forgetting the first or last number in the range.']
  },
  generate: ({ grade, level, rng }) => {
    const d = rng.int(1, 9);
    const start = grade === 2 ? rng.int(1, 5) * 10 : rng.int(1, 7) * 10;
    const len = grade === 2 ? rng.pick([20, 30, 40]) : rng.pick([30, 40, 50, level === 3 ? 90 : 40]);
    const end = start + len;
    let count = 0, numbersWith = 0;
    for (let i = start; i <= end; i++) {
      const c = String(i).split('').filter((x) => +x === d).length;
      count += c;
      if (c) numbersWith++;
    }
    let ones = 0, tens = 0;
    for (let i = start; i <= end; i++) {
      if (i % 10 === d) ones++;
      if (Math.floor(i / 10) % 10 === d) tens++;
    }
    return {
      text: `How many times does the digit ${d} appear in the whole numbers from ${start} to ${end}?`,
      answer: num(count),
      hints: [`Count ${d}s in the ones place first.`, `Now count ${d}s in the tens place.`, `Don't forget ${d}${d} has two of them!`],
      steps: [`Ones place: ${ones} times.`, `Tens place: ${tens} times.`, `Total: ${ones} + ${tens} = ${count}.`],
      misconceptions: misNum(count, [[numbersWith, `You counted the numbers that have a ${d}. But ${d}${d} has two ${d}s, so count it twice.`]])
    };
  }
};

export const roundUp: Topic = {
  id: 'place-value',
  title: 'Place value & next round number',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Look for a pattern',
  guide: {
    idea: 'Numbers ending in two zeros are the hundreds: 100, 200, …, 38,500, 38,600.',
    tips: ['Look at the hundreds digit.', 'The next number ending in 00 is the next hundred up.', 'Say it out loud with commas so you read the big number correctly.'],
    traps: ['Rounding DOWN when the question says "next".', 'Changing the thousands digit by mistake.']
  },
  generate: ({ grade, level, rng }) => {
    const n = grade === 2 ? rng.int(120, 9899) : rng.int(10_100, level === 3 ? 989_899 : 98_899);
    const zeros = grade === 3 && level === 3 && rng.chance(0.5) ? 3 : 2;
    const unit = 10 ** zeros;
    const fixed = n % unit === 0 ? n + 7 : n;
    const ans = Math.ceil((fixed + 1) / unit) * unit;
    return {
      text: `What is the next whole number after ${fmtN(fixed)} that ends in ${zeros === 2 ? 'two' : 'three'} zeros?`,
      answer: num(ans),
      hints: [`Numbers ending in ${zeros === 2 ? '00' : '000'} go up by ${fmtN(unit)}.`, `Which ${zeros === 2 ? 'hundred' : 'thousand'} comes right after ${fmtN(fixed)}?`],
      steps: [`${fmtN(fixed)} is between ${fmtN(ans - unit)} and ${fmtN(ans)}.`, `The next one is ${fmtN(ans)}.`],
      misconceptions: misNum(ans, [[ans - unit, `${fmtN(ans - unit)} comes BEFORE ${fmtN(fixed)}. We want the next one after it.`]])
    };
  }
};

export const patterns: Topic = {
  id: 'patterns',
  title: 'Number patterns',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Look for a pattern',
  guide: {
    idea: 'Find the rule by looking at the jumps between numbers.',
    tips: ['Write the jump between each pair of numbers.', 'Is the jump the same every time? Is it growing? Does it repeat?', 'Use the rule to check every number.'],
    traps: ['Looking at only the first two numbers.', 'Not checking your rule against the rest.']
  },
  generate: ({ grade, level, rng }) => {
    if (level >= 2 && rng.chance(0.5)) {
      // growing jumps
      const start = rng.int(1, 20);
      const j0 = rng.int(1, grade === 3 ? 5 : 3);
      const seq = [start];
      for (let i = 0; i < 5; i++) seq.push(seq[seq.length - 1] + j0 + i);
      const shown = seq.slice(0, 5);
      const ans = seq[5];
      const jumps = shown.slice(1).map((v, i) => v - shown[i]);
      return {
        text: `What number comes next? ${shown.join(', ')}, ______`,
        answer: num(ans),
        hints: ['Find the jump between each pair of numbers.', `The jumps are ${jumps.join(', ')}. What comes next?`],
        steps: [`Jumps: ${jumps.join(', ')}. Each jump is 1 bigger than the one before.`, `Next jump: ${j0 + 4}. ${shown[4]} + ${j0 + 4} = ${ans}.`],
        misconceptions: misNum(ans, [[shown[4] + jumps[3], 'The jumps are growing. The next jump is one more than the last one.']])
      };
    }
    const p = until(
      () => {
        const start = rng.int(2, 40);
        const step = rng.int(2, grade === 3 ? 9 : 5);
        const terms = [0, 1, 2, 3].map((i) => start + i * step);
        const gapIdx = rng.int(0, 2);
        const intruder = rng.int(terms[gapIdx] + 1, terms[gapIdx + 1] - 1);
        return { terms, intruder, step };
      },
      ({ terms, intruder }) => {
        const list = [...terms, intruder].sort((a, b) => a - b);
        let good = 0;
        for (let i = 0; i < list.length; i++) {
          const rest = list.filter((_, j) => j !== i);
          const d = rest[1] - rest[0];
          if (d > 0 && rest.every((v, k) => k === 0 || v - rest[k - 1] === d)) good++;
        }
        return good === 1 && !terms.includes(intruder);
      }
    );
    const list = [...p.terms, p.intruder].sort((a, b) => a - b);
    return {
      text: `Four of these numbers form a pattern. Which number does not belong? ${list.join(', ')}`,
      answer: num(p.intruder),
      hints: ['Find the jump between the numbers.', `Try a jump of ${p.step}. Which number doesn't fit?`],
      steps: [`${p.terms.join(', ')} go up by ${p.step} each time.`, `${p.intruder} does not fit the pattern.`]
    };
  }
};

export const numberRiddle: Topic = {
  id: 'number-riddle',
  title: 'Who am I? Number riddles',
  category: 'Number sense',
  grades: [2, 3],
  strategy: 'Make a list',
  guide: {
    idea: 'Each clue cuts down the list of numbers that could be the answer.',
    tips: ['Start with the clue that gives the shortest list.', 'Cross out numbers that fail any clue.', 'Check your answer against EVERY clue.'],
    traps: ['Using only some of the clues.', '"Groups of 5 with 2 left over" means the number ends in 2 or 7.']
  },
  generate: ({ grade, rng }) => {
    const r = until(
      () => {
        const n = rng.int(10, grade === 2 ? 60 : 99);
        const g = rng.int(3, grade === 2 ? 5 : 6);
        const left = n % g;
        const s = digitSum(n);
        const limit = Math.min(100, Math.ceil((n + 1) / 10) * 10 + rng.int(0, 2) * 10);
        const fits = (k: number) => k % g === left && digitSum(k) === s && k < limit;
        let count = 0;
        for (let k = 10; k < 100; k++) if (fits(k)) count++;
        return { n, g, left, s, limit, count };
      },
      (x) => x.count === 1
    );
    const leftText = r.left === 0 ? 'there are none left over' : `there ${r.left === 1 ? 'is 1' : `are ${r.left}`} left over`;
    const cands: number[] = [];
    for (let k = 10; k < r.limit; k++) if (k % r.g === r.left) cands.push(k);
    return {
      text: `I am a two-digit number less than ${r.limit}. If you put me in groups of ${r.g}, ${leftText}. The sum of my digits is ${r.s}. Who am I?`,
      answer: num(r.n),
      hints: [`List numbers under ${r.limit} that make groups of ${r.g} with ${r.left} left over.`, `Now check which of those has digits adding to ${r.s}.`],
      steps: [`Groups of ${r.g} with ${r.left} left: ${cands.join(', ')}.`, `Only ${r.n} has digits adding to ${r.s} (${String(r.n).split('').join(' + ')} = ${r.s}).`]
    };
  }
};

export const temperature: Topic = {
  id: 'above-below-zero',
  title: 'Above and below zero',
  category: 'Measurement',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'Think of a thermometer, or an elevator going past the ground floor. Zero is the ground floor.',
    tips: ['Count from the start down to zero.', 'Then count from zero to the end.', 'Add the two parts.'],
    traps: ['Subtracting when the change crosses zero.']
  },
  generate: ({ grade, level, rng }) => {
    if (grade === 3 && level >= 2 && rng.chance(0.5)) {
      const depth = rng.int(20, 90) * 100 + rng.pick([0, 50]);
      const up = rng.int(5, Math.floor(depth / 100) - 5) * 10 * rng.pick([10, 1]) || 1000;
      const now = depth - up;
      return {
        text: `An underwater lab is ${fmtN(depth)} feet below the surface. It is raised ${fmtN(up)} feet. Now it is ______ feet below the surface.`,
        answer: num(now),
        hints: ['Being raised means it gets closer to the surface.', `So the depth gets smaller: ${fmtN(depth)} − ${fmtN(up)}.`],
        steps: [`${fmtN(depth)} − ${fmtN(up)} = ${fmtN(now)} feet below the surface.`],
        misconceptions: misNum(now, [[depth + up, 'Raised means it goes UP, toward the surface, so it is less deep. Subtract.']])
      };
    }
    const above = rng.int(3, grade === 2 ? 15 : 30);
    const below = rng.int(2, grade === 2 ? 10 : 20);
    const drop = above + below;
    const falling = rng.chance(0.5);
    const text = falling
      ? `Overnight the temperature dropped from ${above}° to ${below}° below zero. How many degrees did it drop?`
      : `In the morning it was ${below}° below zero. By afternoon it was ${above}°. How many degrees did it rise?`;
    return {
      text,
      answer: num(drop),
      hints: ['Picture a thermometer with 0 in the middle.', falling ? `From ${above}° down to 0° is ${above}°. Then keep going.` : `From ${below}° below zero up to 0° is ${below}°. Then keep going.`],
      steps: falling
        ? [`${above}° down to 0° is ${above}°.`, `0° down to ${below}° below zero is ${below}° more.`, `${above} + ${below} = ${drop}°.`]
        : [`${below}° below zero up to 0° is ${below}°.`, `0° up to ${above}° is ${above}° more.`, `${below} + ${above} = ${drop}°.`],
      misconceptions: misNum(drop, [[Math.abs(above - below), 'The change crosses zero. Count the part above zero and the part below zero, then add them.']])
    };
  }
};

