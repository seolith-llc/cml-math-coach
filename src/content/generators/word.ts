import type { Topic } from '../../core/types';
import { cents, mis, misNum, money, names, num, until } from './helpers';

export const ages: Topic = {
  id: 'ages',
  title: 'Age problems',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Make a table',
  guide: {
    idea: 'Everyone gets older at the same speed. In 3 years EVERY person is 3 years older.',
    tips: ['Make a table with a column for "now", one for "before" and one for "later".', 'The difference between two ages never changes.', 'If 2 people each grow 1 year, their total grows by 2.'],
    traps: ['Adding the years to only one person.', 'Answering with the age NOW when the question asks about later.']
  },
  generate: ({ grade, level, rng }) => {
    const [x, y, z] = names(rng, 3);
    const kind = level === 1 ? 0 : rng.int(0, 2);
    if (kind === 0) {
      const young = rng.int(3, grade === 2 ? 10 : 20);
      const d = rng.int(2, 8);
      const old = young + d;
      return {
        text: `${x} is ${d} years older than ${y}. The sum of their ages is ${young + old}. How old is ${x}?`,
        answer: num(old),
        hints: [`Take away the extra ${d} years: ${young + old} − ${d}.`, 'Split what is left into two equal parts. That is the younger age.', `${x} is the older one.`],
        steps: [`${young + old} − ${d} = ${2 * young}.`, `${2 * young} ÷ 2 = ${young}, so ${y} is ${young}.`, `${x} is ${young} + ${d} = ${old}.`],
        misconceptions: misNum(old, [[young, `${young} is ${y}'s age. ${x} is ${d} years older.`]])
      };
    }
    if (kind === 1) {
      const people = grade === 3 ? 3 : 2;
      const ageList = Array.from({ length: people }, () => rng.int(4, 12));
      const yrs = rng.int(2, 9);
      const now = ageList.reduce((a, b) => a + b, 0);
      const total = now + people * yrs;
      const who = [x, y, z].slice(0, people);
      const intro = who.map((w, i) => `${w} is ${ageList[i]} years old`).join(people === 3 ? ', ' : ' and ');
      return {
        text: `${intro.replace(/, ([^,]*)$/, ' and $1')}. In ______ years their ages will add to ${total}.`,
        answer: num(yrs),
        hints: [`Right now their ages add to ${now}.`, `Each year, the total grows by ${people} (everyone gets 1 year older).`, `The total has to grow by ${total - now}.`],
        steps: [`Now: ${ageList.join(' + ')} = ${now}.`, `Needed growth: ${total} − ${now} = ${total - now}.`, `Each year adds ${people}, so ${total - now} ÷ ${people} = ${yrs} years.`],
        misconceptions: misNum(yrs, [[total - now, `Each year ALL ${people} people get older, so the total grows by ${people} a year, not 1.`]])
      };
    }
    const sib = rng.int(4, 9);
    const ago = rng.int(1, 4);
    const later = rng.int(2, 6);
    const ans = sib + ago + later;
    return {
      text: `${x}'s brother is ${sib} years old. ${ago} year${ago > 1 ? 's' : ''} ago ${x} was as old as the brother is now. ${later} years from now ${x} will be ______ years old.`,
      answer: num(ans),
      hints: [`${ago} years ago ${x} was ${sib}. How old is ${x} now?`, `Now add the ${later} years.`],
      steps: [`${x} now: ${sib} + ${ago} = ${sib + ago}.`, `In ${later} years: ${sib + ago} + ${later} = ${ans}.`],
      misconceptions: misNum(ans, [
        [sib + later, `That is the brother in ${later} years. ${x} is ${ago} year${ago > 1 ? 's' : ''} older than the brother.`],
        [sib + ago, `${sib + ago} is ${x}'s age now. Add the ${later} years.`]
      ])
    };
  }
};

export const transfer: Topic = {
  id: 'transfer',
  title: 'Giving and moving',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Act it out',
  guide: {
    idea: 'When something moves from one group to another, one group loses and the other gains the same amount. The total stays the same.',
    tips: ['Act it out, or draw two boxes and move the items.', 'The total never changes when things just move.', '"Twice as many" means split the total into 3 equal parts: 1 part and 2 parts.'],
    traps: ['Taking items from one side but forgetting to add them to the other.']
  },
  generate: ({ grade, level, rng }) => {
    const [x, y, z] = names(rng, 3);
    if (level === 1 || (grade === 2 && rng.chance(0.5))) {
      const b = rng.int(5, 15);
      const c = rng.int(2, 5);
      const d = rng.int(1, 4);
      const a = b + 2 * c + d + rng.int(3, 15);
      const ans = a - c - d - (b + c);
      return {
        text: `${x} had ${a} marbles and ${y} had ${b} marbles. ${x} gave ${c} marbles to ${y} and ${d} marbles to ${z}. Now ${x} has ______ more marbles than ${y}.`,
        answer: num(ans),
        hints: [`How many does ${x} have after giving away ${c} and ${d}?`, `${y} GOT ${c} marbles. How many does ${y} have now?`, 'Subtract to compare.'],
        steps: [`${x}: ${a} − ${c} − ${d} = ${a - c - d}.`, `${y}: ${b} + ${c} = ${b + c}.`, `${a - c - d} − ${b + c} = ${ans}.`],
        misconceptions: misNum(ans, [
          [a - b, 'That compares them BEFORE anything was given away. Act out the giving first.'],
          [a - c - d - b, `Don't forget ${y} received ${c} marbles too!`]
        ])
      };
    }
    const p = until(
      () => {
        const f = rng.int(4, grade === 2 ? 12 : 25); // final count in A
        const k = rng.int(2, f);
        return { f, k, a: f + k, b: 2 * f - k };
      },
      (p) => p.b > 0 && p.a !== p.b
    );
    const total = p.a + p.b;
    return {
      text: `There are ${p.a} people in Room A and ${p.b} people in Room B. If ______ people were moved from Room A to Room B, there would be twice as many people in Room B as in Room A.`,
      answer: num(p.k),
      hints: [`The total stays ${total}.`, `Twice as many means 3 equal parts: Room A gets 1 part, Room B gets 2.`, `${total} ÷ 3 = ${total / 3}. That is how many end up in Room A.`],
      steps: [`Total: ${p.a} + ${p.b} = ${total}.`, `${total} ÷ 3 = ${p.f}. Room A ends with ${p.f}, Room B with ${2 * p.f}.`, `Move ${p.a} − ${p.f} = ${p.k} people.`],
      misconceptions: misNum(p.k, [[p.f, `${p.f} is how many end up in Room A. How many must LEAVE Room A to get there?`]])
    };
  }
};

export const multiStep: Topic = {
  id: 'multi-step',
  title: 'Multi-step stories',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Write a number sentence',
  guide: {
    idea: 'Break a long story into small steps. Find one number at a time.',
    tips: ['Underline each number and what it describes.', '"More than" means add; "fewer" or "less than" means subtract.', 'Read the question again at the end. Total? Difference? One item?'],
    traps: ['Answering only one step of the problem.', 'Mixing up which thing "more than" refers to.']
  },
  generate: ({ grade, rng }) => {
    const [x] = names(rng, 1);
    if (grade === 3 && rng.chance(0.5)) {
      const first = rng.int(150, 900) + rng.pick([0, 25, 50, 75]);
      const more = rng.int(3, 30) * 5 + 50;
      const less = rng.int(1, 18) * 5 + 10;
      const second = first + more;
      const third = second - less;
      const total = first + second + third;
      return {
        text: `${x} bought 3 things. The first cost ${cents(first)}. The second cost ${cents(more)} more than the first. The third cost ${cents(less)} less than the second. How much did ${x} pay for all 3?`,
        answer: money(total),
        hints: ['Find the price of the second item first.', 'Use the second price to find the third.', 'Add all three prices.'],
        steps: [`Second: ${cents(first)} + ${cents(more)} = ${cents(second)}.`, `Third: ${cents(second)} − ${cents(less)} = ${cents(third)}.`, `Total: ${cents(first)} + ${cents(second)} + ${cents(third)} = ${cents(total)}.`],
        misconceptions: [mis(money(first + more + less), 'Those are the price CHANGES, not the prices. Work out each item\'s price first.')]
      };
    }
    const things = rng.pick([
      ['circle', 'square', 'triangle', 'cookies'],
      ['red', 'blue', 'green', 'balloons'],
      ['oak', 'maple', 'pine', 'trees']
    ]);
    const base = rng.int(8, grade === 2 ? 20 : 45);
    const more = rng.int(2, 9);
    const fewer = rng.int(2, Math.min(9, base - 2));
    const total = base + (base + more) + (base - fewer);
    const verb = things[3] === 'trees' ? 'planted' : things[3] === 'cookies' ? 'baked' : 'blew up';
    return {
      text: `${x} ${verb} ${things[0]}, ${things[1]} and ${things[2]} ${things[3]}. There were ${more} more ${things[1]} ${things[3]} than ${things[0]} ${things[3]}, and ${fewer} fewer ${things[2]} ${things[3]} than ${things[0]} ${things[3]}. There were ${base} ${things[0]} ${things[3]}. How many ${things[3]} were there altogether?`,
      answer: num(total),
      hints: [`${things[1]}: ${base} + ${more}.`, `${things[2]}: ${base} − ${fewer}.`, 'Add all three kinds.'],
      steps: [`${things[0]}: ${base}.`, `${things[1]}: ${base} + ${more} = ${base + more}.`, `${things[2]}: ${base} − ${fewer} = ${base - fewer}.`, `Total: ${base} + ${base + more} + ${base - fewer} = ${total}.`],
      misconceptions: misNum(total, [
        [base + more + fewer, `${more} and ${fewer} are the differences, not the amounts. Find how many of each kind first.`],
        [3 * base + more + fewer, `"Fewer" means subtract ${fewer}, not add it.`]
      ])
    };
  }
};

export const headsLegs: Topic = {
  id: 'heads-legs',
  title: 'Heads and legs',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Guess and check',
  guide: {
    idea: 'Pretend every animal is a chicken (2 legs). Every extra leg pair you still need belongs to a pig.',
    tips: ['If all were chickens: heads × 2 legs.', 'Extra legs = real legs − that number.', 'Each pig adds 2 extra legs, so pigs = extra legs ÷ 2.', 'Check: count all the legs again.'],
    traps: ['Answering with the chickens when the question asks for the pigs.', 'Dividing the extra legs by 4 instead of 2.']
  },
  generate: ({ grade, level, rng }) => {
    const [x] = names(rng, 1);
    if (level === 1) {
      const dogs = rng.int(1, 6), cats = rng.int(1, 5), hens = rng.int(1, 6);
      const legs = 4 * dogs + 4 * cats + 2 * hens;
      return {
        text: `${x} sees ${dogs} dog${dogs > 1 ? 's' : ''}, ${cats} cat${cats > 1 ? 's' : ''} and ${hens} chicken${hens > 1 ? 's' : ''} in the yard. How many legs are there altogether?`,
        answer: num(legs),
        hints: ['Dogs and cats have 4 legs. Chickens have 2.', `${dogs + cats} four-legged animals and ${hens} chickens.`],
        steps: [`Dogs and cats: ${dogs + cats} × 4 = ${4 * (dogs + cats)}.`, `Chickens: ${hens} × 2 = ${2 * hens}.`, `Total: ${legs} legs.`],
        misconceptions: misNum(legs, [[dogs + cats + hens, 'That counts heads. Each animal has 2 or 4 legs.']])
      };
    }
    const variant = grade === 3 ? rng.int(0, 2) : rng.int(0, 1);
    const sets = [
      { a: 'chickens', b: 'pigs', la: 2, lb: 4, head: 'heads', leg: 'feet' },
      { a: 'bicycles', b: 'tricycles', la: 2, lb: 3, head: 'seats', leg: 'wheels' },
      { a: 'tables with 4 chairs', b: 'tables with 5 chairs', la: 4, lb: 5, head: 'tables', leg: 'chairs' }
    ];
    const s = sets[variant];
    const heads = rng.int(5, grade === 2 ? 15 : 24);
    const bCount = rng.int(1, heads - 1);
    const aCount = heads - bCount;
    const legs = aCount * s.la + bCount * s.lb;
    const per = s.lb - s.la;
    const text =
      variant === 2
        ? `A room has ${heads} tables. Each table has either 4 or 5 chairs. There are ${legs} chairs in the room. How many tables have 5 chairs?`
        : variant === 1
          ? `In a bike shop there are only bicycles and tricycles. There are ${heads} seats and ${legs} wheels. How many tricycles are there?`
          : `A farmer has chickens and pigs. The farmer counts ${heads} heads and ${legs} feet. How many pigs are there?`;
    return {
      text,
      answer: num(bCount),
      hints: [
        `Pretend every one of the ${heads} is ${s.a.startsWith('tables') ? 'a table with 4 chairs' : s.a.replace(/s$/, '')}.`,
        `That gives ${heads} × ${s.la} = ${heads * s.la} ${s.leg}. You need ${legs - heads * s.la} more.`,
        `Each ${s.b.replace(/s(?= with)|s$/, '')} adds ${per} more ${s.leg}.`
      ],
      steps: [
        `If all ${heads} were ${s.a}: ${heads} × ${s.la} = ${heads * s.la} ${s.leg}.`,
        `Extra: ${legs} − ${heads * s.la} = ${legs - heads * s.la}.`,
        `Each ${s.b.replace(/s(?= with)|s$/, '')} adds ${per}: ${legs - heads * s.la} ÷ ${per} = ${bCount}.`,
        `Check: ${aCount} × ${s.la} + ${bCount} × ${s.lb} = ${legs}. ✔`
      ],
      misconceptions: misNum(bCount, [[aCount, `${aCount} is the number of ${s.a}. The question asks about the ${s.b}.`]])
    };
  }
};

export const unitRate: Topic = {
  id: 'unit-rate',
  title: 'Same rate (proportion)',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Make a table',
  guide: {
    idea: 'Find the cost of one small group, then build up to the amount you need.',
    tips: ['Look for a group size that fits into both amounts (12 and 16 both share groups of 4).', 'Work out the price of one group.', 'Multiply by the number of groups you need.'],
    traps: ['Adding the difference in items to the price. 4 more items does not mean 4 more cents!']
  },
  generate: ({ grade, level, rng }) => {
    const things = rng.pick(['pieces of candy', 'apples', 'pencils', 'stickers', 'balloons']);
    const g = rng.int(2, grade === 2 ? 4 : 6);
    const q = rng.int(grade === 2 ? 5 : 7, grade === 2 ? 25 : 40);
    const i = rng.int(2, 4);
    const j = until(() => rng.int(2, level === 3 ? 12 : 6), (v) => v !== i);
    const n = g * i, m = g * j;
    const ans = q * j;
    return {
      text: `If ${n} ${things} cost ${cents(q * i)}, then ${m} ${things} would cost ______.`,
      answer: money(ans),
      hints: [`Put the ${things} in groups of ${g}.`, `${n} is ${i} groups, so one group costs ${cents(q * i)} ÷ ${i}.`, `${m} is ${j} groups.`],
      steps: [`${n} = ${i} groups of ${g}. One group: ${cents(q * i)} ÷ ${i} = ${cents(q)}.`, `${m} = ${j} groups of ${g}.`, `${j} × ${cents(q)} = ${cents(ans)}.`],
      misconceptions: [mis(money(q * i + (m - n)), `The price doesn't go up by 1 cent per ${things.replace(/s$/, '')}. Find the price of a group first.`)].filter(
        (x) => (x.answer as { cents: number }).cents !== ans
      )
    };
  }
};

export const workRate: Topic = {
  id: 'work-rate',
  title: 'Groups, pieces and jobs',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'Find the whole amount first, then share or group it a new way.',
    tips: ['Find the total length or total work.', 'Then divide it into the new size of piece.', 'More people or more time means MORE work done.'],
    traps: ['Forgetting that BOTH the people and the weeks changed.']
  },
  generate: ({ grade, rng }) => {
    const v = grade === 2 ? rng.int(0, 1) : rng.int(0, 2);
    if (v === 0) {
      const sheds = rng.int(1, 3), weeks = rng.int(2, 7), people = rng.int(2, 4), times = rng.int(2, 3);
      const ans = sheds * people * times;
      return {
        text: `If 1 person can build ${sheds} shed${sheds > 1 ? 's' : ''} in ${weeks} weeks, how many sheds can ${people} people build in ${weeks * times} weeks?`,
        answer: num(ans),
        hints: [`In ${weeks} weeks, ${people} people build ${people} × ${sheds}.`, `${weeks * times} weeks is ${times} times as long.`],
        steps: [`${people} people in ${weeks} weeks: ${people} × ${sheds} = ${people * sheds} sheds.`, `${weeks * times} weeks = ${times} × ${weeks} weeks.`, `${people * sheds} × ${times} = ${ans} sheds.`],
        misconceptions: misNum(ans, [[people * sheds, `That is for ${weeks} weeks. They have ${times} times as long.`], [sheds * times, `That is 1 person. There are ${people} people working.`]])
      };
    }
    if (v === 1) {
      const p = until(
        () => {
          const a = rng.int(2, 6), n = rng.int(3, 12), b = rng.int(2, 8);
          return { a, n, b, L: a * n };
        },
        ({ a, b, L }) => a !== b && L % b === 0 && L <= 60
      );
      const ans = p.L / p.b;
      return {
        text: `A board can be cut into exactly ${p.n} pieces that are each ${p.a} feet long. The same board could instead be cut into ______ pieces that are each ${p.b} feet long.`,
        answer: num(ans),
        hints: ['How long is the whole board?', `${p.n} × ${p.a} = ? Now cut that into ${p.b}-foot pieces.`],
        steps: [`Board: ${p.n} × ${p.a} = ${p.L} feet.`, `${p.L} ÷ ${p.b} = ${ans} pieces.`]
      };
    }
    const p = until(
      () => {
        const n = rng.int(5, 12), k = rng.int(1, 3), e = rng.int(1, 6);
        return { n, k, e, x: ((n - k) * e) / k };
      },
      ({ x, k, n }) => Number.isInteger(x) && x > 2 && k < n - 2
    );
    return {
      text: `There is the same number of peaches in each of ${p.n} baskets. If all the peaches were taken out of ${p.k} basket${p.k > 1 ? 's' : ''}, exactly ${p.e} more peaches could be put into each of the other baskets. How many peaches were in each basket to begin with?`,
      answer: num(p.x),
      hints: [`The peaches from ${p.k} basket${p.k > 1 ? 's' : ''} get shared among ${p.n - p.k} baskets.`, `Each of the ${p.n - p.k} baskets gets ${p.e}, so ${(p.n - p.k) * p.e} peaches were moved.`],
      steps: [`Moved peaches: ${p.n - p.k} × ${p.e} = ${(p.n - p.k) * p.e}.`, `They came from ${p.k} basket${p.k > 1 ? 's' : ''}: ${(p.n - p.k) * p.e} ÷ ${p.k} = ${p.x}.`]
    };
  }
};

export const backwards: Topic = {
  id: 'work-backwards',
  title: 'Work backwards stories',
  category: 'Word problems',
  grades: [2, 3],
  strategy: 'Work backwards',
  guide: {
    idea: 'When you know how a story ENDS, undo each step in reverse order.',
    tips: ['Start at the end.', 'Undo each step: adding becomes subtracting, and subtracting becomes adding.', 'Then run the story forward to check.'],
    traps: ['Undoing the steps in the wrong order.']
  },
  generate: ({ grade, rng }) => {
    const [x, y] = names(rng, 2);
    if (grade === 3 && rng.chance(0.5)) {
      const had = rng.int(12, 60), extra = rng.int(2, 6) * 5;
      const gave = had + extra;
      const now = had + gave;
      return {
        text: `${x} gave ${y} $${extra} more than ${y} already had. Now ${y} has $${now}. How much money did ${x} give to ${y}?`,
        answer: num(gave, 'dollars'),
        hints: [`${y} now has: what ${y} had + (what ${y} had + $${extra}).`, `Take away the $${extra}: what is left is two equal parts.`],
        steps: [`$${now} − $${extra} = $${now - extra} = two times what ${y} had.`, `${y} had $${had}.`, `${x} gave $${had} + $${extra} = $${gave}.`],
        misconceptions: misNum(gave, [[had, `$${had} is what ${y} had at the start. ${x} gave $${extra} more than that.`], [now - extra, `$${now - extra} is double what ${y} had. Halve it, then add $${extra}.`]])
      };
    }
    const start = rng.int(15, grade === 2 ? 50 : 200);
    const a = rng.int(3, 15), b = rng.int(3, 20), c = rng.int(2, 10);
    const end = start - a + b - c;
    const item = rng.pick(['stickers', 'cards', 'shells', 'marbles']);
    return {
      text: `${x} had some ${item}. ${x} gave away ${a}, then found ${b} more, then lost ${c}. Now ${x} has ${end}. How many ${item} did ${x} start with?`,
      answer: num(start),
      hints: ['Start from the end and go backwards.', `Undo "lost ${c}" by adding ${c}. Undo "found ${b}" by subtracting ${b}.`],
      steps: [`${end} + ${c} = ${end + c}.`, `${end + c} − ${b} = ${end + c - b}.`, `${end + c - b} + ${a} = ${start}.`, `Check: ${start} − ${a} + ${b} − ${c} = ${end}. ✔`],
      misconceptions: misNum(start, [[end - a + b - c, 'You ran the story forward again. To go back in time, do the opposite of each step.']])
    };
  }
};

