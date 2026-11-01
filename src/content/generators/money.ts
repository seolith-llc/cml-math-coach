import type { Topic } from '../../core/types';
import { cents, mis, misNum, money, names, num, until } from './helpers';

const COIN = { penny: 1, nickel: 5, dime: 10, quarter: 25, 'half-dollar': 50 } as const;
type CoinName = keyof typeof COIN;
const plural = (c: CoinName, n: number) => (n === 1 ? c : c === 'penny' ? 'pennies' : `${c}s`);

export const coinCount: Topic = {
  id: 'coins',
  title: 'Counting coins & making change',
  category: 'Money',
  grades: [2, 3],
  strategy: 'Make a table',
  guide: {
    idea: 'Count the biggest coins first, then add the smaller ones. Penny 1¢, nickel 5¢, dime 10¢, quarter 25¢.',
    tips: ['Group coins of the same kind and multiply.', 'To find change, count up from the price to the money you paid.', 'Write money with a ¢ sign or with $ and a decimal point.'],
    traps: ['Mixing up nickels (5¢) and dimes (10¢).', 'Writing $1.5 when you mean $1.50.']
  },
  generate: ({ grade, level, rng }) => {
    const [x] = names(rng, 1);
    if (grade === 2 && level === 1) {
      const p = rng.int(0, 9), n = rng.int(1, 6), d = rng.int(1, 6);
      const total = p + 5 * n + 10 * d;
      return {
        text: `${x} has ${p} ${plural('penny', p)}, ${n} ${plural('nickel', n)} and ${d} ${plural('dime', d)}. How much money is that?`,
        answer: money(total),
        hints: ['Count the dimes first by tens.', 'Then count the nickels by fives, then the pennies.'],
        steps: [`Dimes: ${d} × 10¢ = ${10 * d}¢.`, `Nickels: ${n} × 5¢ = ${5 * n}¢.`, `Pennies: ${p}¢.`, `Total: ${cents(total)}.`],
        misconceptions: [mis(money(p + n + d), 'That counts coins, not money. Each kind of coin is worth a different amount.')]
      };
    }
    if (grade === 2) {
      const coins = 2 * rng.int(3, 8);
      const total = (coins / 2) * 25 + (coins / 2) * 10;
      return {
        text: `${x} has ${coins} coins. Half of them are quarters and half are dimes. How much money does ${x} have?`,
        answer: money(total),
        hints: [`Half of ${coins} is ${coins / 2}.`, `${coins / 2} quarters and ${coins / 2} dimes.`],
        steps: [`${coins / 2} quarters = ${cents((coins / 2) * 25)}.`, `${coins / 2} dimes = ${cents((coins / 2) * 10)}.`, `Total: ${cents(total)}.`]
      };
    }
    const q = rng.int(1, 4), d = rng.int(1, 6), n = rng.int(1, 4);
    const have = 25 * q + 10 * d + 5 * n;
    const cost = rng.int(Math.floor(have / 3), have - 3);
    const left = have - cost;
    return {
      text: `${x} had ${q} ${plural('quarter', q)}, ${d} ${plural('dime', d)} and ${n} ${plural('nickel', n)}. ${x} bought supplies that cost ${cents(cost)}. How much money does ${x} have left?`,
      answer: money(left),
      hints: ['First find how much money there was to start.', `Then subtract ${cents(cost)}.`],
      steps: [`${q} × 25¢ + ${d} × 10¢ + ${n} × 5¢ = ${cents(have)}.`, `${cents(have)} − ${cents(cost)} = ${cents(left)}.`],
      misconceptions: [mis(money(have), `That's how much ${x} started with. Now take away the ${cents(cost)}.`)]
    };
  }
};

export const smallestAmount: Topic = {
  id: 'smallest-largest-amount',
  title: 'Smallest or largest amount',
  category: 'Money',
  grades: [2, 3],
  strategy: 'Use logical reasoning',
  guide: {
    idea: 'For the SMALLEST amount, take the cheapest coins first. For the LARGEST, take the most valuable ones first.',
    tips: ['Line up the coins from smallest to largest value.', 'Take coins from the right end of the line until you have enough.', 'Add up the coins you took.'],
    traps: ['Taking coins in any order.']
  },
  generate: ({ grade, rng }) => {
    const [x] = names(rng, 1);
    const p = rng.int(1, 5), n = rng.int(1, 4), d = rng.int(1, 5), q = grade === 3 ? rng.int(1, 3) : 0;
    const all: number[] = [...Array(p).fill(1), ...Array(n).fill(5), ...Array(d).fill(10), ...Array(q).fill(25)];
    const take = rng.int(Math.max(2, p + 1), all.length - 1);
    const smallest = rng.chance(0.6);
    const sorted = [...all].sort((a, b) => (smallest ? a - b : b - a));
    const picked = sorted.slice(0, take);
    const ans = picked.reduce((s, c) => s + c, 0);
    const list = [`${p} ${plural('penny', p)}`, `${n} ${plural('nickel', n)}`, `${d} ${plural('dime', d)}`];
    if (q) list.push(`${q} ${plural('quarter', q)}`);
    return {
      text: `${x} has ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]} in a pocket. ${x} pulls out ${take} coins. What is the ${smallest ? 'smallest' : 'largest'} amount of money ${x} could pull out?`,
      answer: money(ans),
      hints: [smallest ? 'Take the coins worth the least first.' : 'Take the coins worth the most first.', `Pick ${take} coins in that order and add them.`],
      steps: [`Take: ${picked.map((c) => c + '¢').join(' + ')}.`, `Total: ${cents(ans)}.`]
    };
  }
};

export const coinCombos: Topic = {
  id: 'coin-combinations',
  title: 'How many ways / amounts?',
  category: 'Money',
  grades: [2, 3],
  strategy: 'Make a list',
  guide: {
    idea: 'Make an organised list so you never miss a way or count one twice.',
    tips: ['Group by how many coins you use: 1 coin, 2 coins, 3 coins…', 'Or start with the most big coins, then swap one at a time.', 'When order matters, a nickel then a dime is different from a dime then a nickel.'],
    traps: ['Listing ways at random and missing some.', 'Forgetting to count using just one coin.']
  },
  generate: ({ grade, level, rng }) => {
    if (grade === 2 || level === 1) {
      const price = rng.pick(grade === 2 ? [15, 20, 25] : [20, 25, 30]);
      const ways = (c: number): number => (c < 0 ? 0 : c === 0 ? 1 : ways(c - 5) + ways(c - 10));
      const unordered = Math.floor(price / 10) + 1;
      const ans = ways(price);
      return {
        text: `A machine sells a snack for ${price}¢. It only takes nickels and dimes. A nickel then a dime is a DIFFERENT way from a dime then a nickel. How many different ways can you pay exactly ${price}¢?`,
        answer: num(ans),
        hints: ['Write D for dime and N for nickel.', `Start with as many dimes as possible. Then swap a dime for two nickels.`, 'For each mix of coins, count the different orders.'],
        steps: [`List them with N and D. For example 10¢: NN or D, which is 2 ways.`, `Ways(${price}) = ways(${price - 5}) + ways(${price - 10}), because the first coin is either N or D.`, `Total: ${ans} ways.`],
        misconceptions: misNum(ans, [[unordered, 'That counts the coin mixes. The order matters too, so count each different order.']])
      };
    }
    const set = rng.pick<CoinName[]>([
      ['penny', 'nickel', 'dime'],
      ['penny', 'nickel', 'dime', 'quarter'],
      ['nickel', 'dime', 'quarter'],
      ['nickel', 'dime', 'quarter', 'half-dollar']
    ]);
    const vals = set.map((c) => COIN[c]);
    const sums = new Set<number>();
    for (let mask = 1; mask < 1 << vals.length; mask++) {
      let s = 0;
      vals.forEach((v, i) => mask & (1 << i) && (s += v));
      sums.add(s);
    }
    const [x] = names(rng, 1);
    return {
      text: `${x} has ${set.length} coins: ${set.map((c) => `a ${c}`).join(', ').replace(/, ([^,]*)$/, ' and $1')}. How many different amounts of money can ${x} make using one or more of the coins?`,
      answer: num(sums.size),
      hints: ['Make a list grouped by number of coins.', `Using 1 coin: ${vals.join('¢, ')}¢.`, 'Now list every pair, every group of three, and so on.'],
      steps: [`1 coin: ${set.length} amounts.`, 'Then all pairs, all groups of 3, … each one makes a new amount.', `All amounts: ${[...sums].sort((a, b) => a - b).join(', ')}.`, `That is ${sums.size} amounts.`],
      misconceptions: misNum(sums.size, [[sums.size - set.length, 'Remember that using just ONE coin counts too.']])
    };
  }
};

export const pricePuzzle: Topic = {
  id: 'price-puzzle',
  title: 'Price puzzles',
  category: 'Money',
  grades: [2, 3],
  strategy: 'Use logical reasoning',
  guide: {
    idea: 'Compare two shopping lists. Whatever is different between them explains the difference in price.',
    tips: ['Line the two lists up next to each other.', 'If one list is double the other, double its price too.', 'Find the one item that is different, and its price is the difference.'],
    traps: ['Dividing the total by the number of items. The items have different prices.']
  },
  generate: ({ grade, level, rng }) => {
    if (grade === 2 || level === 1) {
      const a = rng.int(20, 60), b = rng.int(30, 90);
      const fruit = rng.pick([['orange', 'grapefruit'], ['apple', 'mango'], ['pear', 'melon']]);
      return {
        text: `Two ${fruit[0]}s cost ${cents(2 * a)}. One ${fruit[0]} and one ${fruit[1]} cost ${cents(a + b)}. How much does one ${fruit[1]} cost?`,
        answer: money(b),
        hints: [`One ${fruit[0]} costs half of ${cents(2 * a)}.`, `Take that away from ${cents(a + b)}.`],
        steps: [`1 ${fruit[0]} = ${cents(2 * a)} ÷ 2 = ${cents(a)}.`, `1 ${fruit[1]} = ${cents(a + b)} − ${cents(a)} = ${cents(b)}.`],
        misconceptions: [mis(money(a + b - 2 * a), `Remember: only ONE ${fruit[0]} is in the second pair.`)].filter((m) => (m.answer as { cents: number }).cents !== b && a + b - 2 * a > 0)
      };
    }
    if (level === 3 && rng.chance(0.5)) {
      const rate = rng.int(4, 9) * 10 + rng.pick([0, 2, 5]);
      const fee = rng.int(3, 9) * 10 + rng.pick([0, 1, 5]);
      const h1 = rng.int(1, 3), h2 = h1 + rng.int(1, 3);
      const t1 = fee + h1 * rate, t2 = fee + h2 * rate;
      return {
        text: `A repair person charges an hourly rate plus one "visit" fee. For ${h1} hour${h1 > 1 ? 's' : ''} the bill is $${t1}. For ${h2} hours the bill is $${t2}. How many dollars is the visit fee?`,
        answer: num(fee, 'dollars'),
        hints: [`The difference between the bills is ${h2 - h1} extra hour${h2 - h1 > 1 ? 's' : ''}.`, 'Find the cost of 1 hour, then take the hours away from one bill.'],
        steps: [`$${t2} − $${t1} = $${t2 - t1} for ${h2 - h1} hour${h2 - h1 > 1 ? 's' : ''}.`, `1 hour = $${rate}.`, `$${t1} − ${h1} × $${rate} = $${fee}.`],
        misconceptions: misNum(fee, [[rate, `$${rate} is the price of one hour. The question asks for the visit fee.`]])
      };
    }
    const p = until(
      () => {
        const b = rng.int(15, 60), q = rng.int(20, 70), x1 = rng.int(1, 3), y1 = rng.int(2, 4), y2 = rng.int(1, 2 * y1 - 1);
        return { b, q, x1, y1, y2 };
      },
      (p) => p.b !== p.q && 2 * p.y1 !== p.y2
    );
    const t1 = p.x1 * p.b + p.y1 * p.q, t2 = 2 * p.x1 * p.b + p.y2 * p.q;
    const diffPears = 2 * p.y1 - p.y2;
    return {
      text: `${p.x1} banana${p.x1 > 1 ? 's' : ''} and ${p.y1} pears cost ${cents(t1)}. ${2 * p.x1} bananas and ${p.y2} pear${p.y2 > 1 ? 's' : ''} cost ${cents(t2)}. How much does 1 pear cost?`,
      answer: money(p.q),
      hints: [`Double the first list: ${2 * p.x1} bananas and ${2 * p.y1} pears cost ${cents(2 * t1)}.`, `Now both lists have ${2 * p.x1} bananas. Compare the pears.`],
      steps: [`Double list 1: ${2 * p.x1} bananas + ${2 * p.y1} pears = ${cents(2 * t1)}.`, `Difference: ${diffPears} pear${diffPears > 1 ? 's' : ''} = ${cents(2 * t1)} − ${cents(t2)} = ${cents(2 * t1 - t2)}.`, `1 pear = ${cents(p.q)}.`]
    };
  }
};
