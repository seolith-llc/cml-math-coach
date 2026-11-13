import type { Topic } from '../../core/types';
import { DAYS, formatTime } from '../../core/answer';
import { ordinal } from '../../core/numberWords';
import { mis, misNum, num, segmentFigure, until } from './helpers';
import { calendarScene, daysAheadScene, elapsedScene, halfwayScene, handsTravelScene, lengthScene, midpointsScene, minutesScene, roastScene, segmentsScene, watchesScene } from '../scenes/money-time';

export const calendar: Topic = {
  id: 'calendar',
  title: 'Calendar days',
  category: 'Time & calendar',
  grades: [2, 3],
  strategy: 'Look for a pattern',
  guide: {
    idea: 'The days repeat every 7 days. If the 1st is a Saturday, then the 8th, 15th, 22nd and 29th are Saturdays too.',
    tips: ['Jump by 7s to land close to the day you want.', 'Then count the last few days one at a time.', 'For "N days from today", divide N by 7. Only the leftover days move the weekday.'],
    traps: ['Counting the starting day as day 1 of the jump (an off-by-one mistake).']
  },
  generate: ({ grade, level, rng }) => {
    const start = rng.int(0, 6);
    if (grade === 3 && level >= 2 && rng.chance(0.6)) {
      const n = rng.int(9, level === 3 ? 150 : 70);
      const ans = DAYS[(start + n) % 7];
      const off = DAYS[(start + n - 1) % 7];
      return {
        text: `If today is a **${DAYS[start]}**, what day of the week will it be **${n} days** from today?`,
        scene: daysAheadScene(start, n),
        answer: { kind: 'day', value: ans },
        hints: ['Every 7 days it is the same weekday again.', `${n} ÷ 7 = ${Math.floor(n / 7)} weeks with ${n % 7} left over.`, `Move ${n % 7} day${n % 7 === 1 ? '' : 's'} forward from ${DAYS[start]}.`],
        steps: [`${n} = ${Math.floor(n / 7)} × 7 + ${n % 7}.`, `After ${Math.floor(n / 7) * 7} days it is ${DAYS[start]} again.`, `${n % 7} more day${n % 7 === 1 ? '' : 's'}: ${ans}.`],
        misconceptions: off !== ans ? [mis({ kind: 'day', value: off }, 'Close! You are one day short. Today is day 0, and tomorrow is 1 day from today.')] : []
      };
    }
    const n = rng.int(8, 31);
    const ans = DAYS[(start + n - 1) % 7];
    const sames = [1, 8, 15, 22, 29].filter((d) => d <= n);
    const off = DAYS[(start + n) % 7];
    return {
      text: `If the 1st day of the month is a **${DAYS[start]}**, then the **${ordinal(n)} day** of that month is a ______.`,
      scene: calendarScene(start, n),
      answer: { kind: 'day', value: ans },
      hints: [`The ${sames.map(ordinal).join(', ')} are all ${DAYS[start]}s.`, `Count from the ${ordinal(sames[sames.length - 1])} to the ${ordinal(n)}.`],
      steps: [`${sames.map(ordinal).join(', ')} are ${DAYS[start]}s (add 7 each time).`, `${n} − ${sames[sames.length - 1]} = ${n - sames[sames.length - 1]} more day${n - sames[sames.length - 1] === 1 ? '' : 's'}.`, `The ${ordinal(n)} is a ${ans}.`],
      misconceptions: [mis({ kind: 'day', value: off }, `Off by one! The 1st is day one, so the ${ordinal(n)} is ${n - 1} days after it, not ${n}.`)]
    };
  }
};

export const elapsedTime: Topic = {
  id: 'elapsed-time',
  title: 'Clocks & elapsed time',
  category: 'Time & calendar',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'Jump along a time line: whole hours first, then minutes. Be careful when you cross 12:00 (A.M. changes to P.M.).',
    tips: ['Add the hours first, then the minutes.', 'If the minutes reach 60 or more, swap 60 minutes for 1 hour.', 'Halfway between two times: find the gap and split it in half.'],
    traps: ['Writing 10:75. Minutes only go up to 59.', 'Forgetting that A.M. turns into P.M. after 12 noon.']
  },
  generate: ({ grade, level, rng }) => {
    const v = level === 1 ? 0 : rng.int(0, grade === 3 && level === 3 ? 2 : 1);
    if (v === 0) {
      const start = rng.int(7, 11) * 60 + rng.int(0, 11) * 5;
      const addH = rng.int(1, grade === 2 ? 3 : 4);
      const addM = grade === 2 ? rng.pick([0, 30, 15]) : rng.int(1, 11) * 5;
      const end = start + addH * 60 + addM;
      const dur = addM === 30 && grade === 2 ? `${addH} ½ hours` : `${addH} hour${addH > 1 ? 's' : ''}${addM ? ` and ${addM} minutes` : ''}`;
      return {
        text: `It is now **${formatTime(start)}** What time will it be **${dur}** from now?`,
        scene: elapsedScene(start, addH, addM),
        speech: `It is now ${formatTime(start).replace('A.M.', 'A M')}. What time will it be ${dur.replace('½', 'and a half')} from now?`,
        answer: { kind: 'time', minutes: end, ampm: true },
        hints: [`Add ${addH} hour${addH > 1 ? 's' : ''} first.`, addM ? `Then add ${addM} minutes. Remember, 60 minutes make an hour.` : 'Watch out for crossing 12 noon.'],
        steps: [`${formatTime(start)} + ${addH} h = ${formatTime(start + addH * 60)}.`, ...(addM ? [`+ ${addM} min = ${formatTime(end)}.`] : [])],
        misconceptions: end >= 720 && start < 720 ? [mis({ kind: 'time', minutes: end - 720, ampm: true }, 'Right clock time, but after 12 noon it is P.M., not A.M.')] : []
      };
    }
    if (v === 1) {
      const t1 = rng.int(1, 10) * 60 + 12 * 60 + rng.pick([0, 15, 30]);
      const gap = 2 * rng.int(5, 30);
      const mid = t1 + gap / 2;
      const wait = rng.int(2, gap / 2 - 1);
      const now = mid - wait;
      return {
        text: `In **${wait} minutes** it will be **halfway** between ${formatTime(t1)} and ${formatTime(t1 + gap)} What time is it now?`,
        scene: halfwayScene(t1, gap, wait),
        answer: { kind: 'time', minutes: now, ampm: false },
        hints: [`Find halfway first. The gap is ${gap} minutes.`, `Halfway is ${gap / 2} minutes after ${formatTime(t1)}.`, `Now go BACK ${wait} minutes.`],
        steps: [`Halfway: ${formatTime(t1)} + ${gap / 2} min = ${formatTime(mid)}.`, `${wait} minutes earlier: ${formatTime(now)}.`],
        misconceptions: [mis({ kind: 'time', minutes: mid + wait, ampm: false }, `It will be halfway IN ${wait} minutes, so right now is ${wait} minutes BEFORE halfway.`), mis({ kind: 'time', minutes: mid, ampm: false }, 'That is the halfway time. The question asks what time it is now.')]
      };
    }
    // two watches drifting apart
    const p = until(() => ({ f: rng.int(1, 4), s: rng.int(1, 4) }), ({ f, s }) => 60 % (f + s) === 0 && 60 / (f + s) <= 20);
    const hours = 60 / (p.f + p.s);
    const start = rng.int(1, 11) * 60 + 12 * 60;
    const end = (start + hours * 60) % 1440;
    return {
      text: `Two watches are both set correctly at ${formatTime(start)} One **gains ${p.f} minute${p.f > 1 ? 's' : ''}** every hour. The other **loses ${p.s} minute${p.s > 1 ? 's' : ''}** every hour. At what real time will the fast watch be exactly 1 hour ahead of the slow watch?`,
      scene: watchesScene(p.f, p.s, start, hours),
      answer: { kind: 'time', minutes: end, ampm: true },
      hints: [`Each hour they move ${p.f} + ${p.s} = ${p.f + p.s} minutes further apart.`, `How many hours until they are 60 minutes apart?`],
      steps: [`They drift ${p.f + p.s} minutes apart every hour.`, `60 ÷ ${p.f + p.s} = ${hours} hours.`, `${formatTime(start)} + ${hours} hours = ${formatTime(end)}.`]
    };
  }
};

export const timeUnits: Topic = {
  id: 'time-units',
  title: 'Hours, minutes & clock hands',
  category: 'Time & calendar',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: '1 hour = 60 minutes. On a clock face the numbers are 5 minutes apart for the minute hand, and 1 hour apart for the hour hand.',
    tips: ['¼ hour = 15 minutes, ½ hour = 30 minutes, ¾ hour = 45 minutes.', 'Turn hours into minutes by multiplying by 60.', '"20 minutes for each pound" means 3 pounds take 1 hour.'],
    traps: ['Thinking an hour has 100 minutes.']
  },
  generate: ({ grade, level, rng }) => {
    const v = grade === 2 ? rng.int(0, 1) : rng.int(0, 2);
    if (v === 0) {
      const mins = rng.int(2, 11) * 5;
      return {
        text: `How many hours does it take the hour hand to travel as far around the clock as the minute hand travels in **${mins} minutes**?`,
        scene: handsTravelScene(mins),
        answer: num(mins / 5),
        hints: [`In ${mins} minutes the minute hand moves past ${mins / 5} numbers on the clock.`, 'The hour hand moves 1 number every hour.'],
        steps: [`${mins} minutes moves the minute hand ${mins} ÷ 5 = ${mins / 5} numbers.`, `The hour hand takes ${mins / 5} hours to move ${mins / 5} numbers.`],
        misconceptions: misNum(mins / 5, [[mins, 'Think about the numbers on the clock. The minute hand moves 5 minutes for each number.']])
      };
    }
    if (v === 1) {
      const h = rng.int(1, grade === 2 ? 3 : 5);
      const q = grade === 2 ? rng.pick([0, 2]) : rng.int(1, 3);
      const frac = ['', ' ¼', ' ½', ' ¾'][q];
      const ans = h * 60 + q * 15;
      return {
        text: `1 hour = 60 minutes. How many minutes are there in **${h}${frac} hours**?`,
        scene: minutesScene(h, q * 15),
        speech: `One hour is 60 minutes. How many minutes are there in ${h}${['', ' and a quarter', ' and a half', ' and three quarters'][q]} hours?`,
        answer: num(ans),
        hints: [`${h} hours = ${h} × 60 minutes.`, ...(q ? [`${frac.trim()} hour = ${q * 15} minutes.`] : [])],
        steps: [`${h} × 60 = ${h * 60}.`, ...(q ? [`${h * 60} + ${q * 15} = ${ans} minutes.`] : [])],
        misconceptions: misNum(ans, [[h * 100 + q * 25, 'An hour has 60 minutes, not 100.']])
      };
    }
    const per = rng.pick([10, 15, 20, 30]);
    const perHour = 60 / per;
    const hours = rng.int(2, level === 3 ? 8 : 5);
    const lbs = perHour * hours;
    return {
      text: `A turkey needs to roast for **${per} minutes** for each pound it weighs. A **${lbs}-pound** turkey should roast for ______ hours.`,
      scene: roastScene(per, lbs),
      answer: num(hours),
      hints: [`How many ${per}-minute blocks fit in 1 hour?`, `So ${perHour} pounds take 1 hour.`],
      steps: [`60 ÷ ${per} = ${perHour}, so ${perHour} pounds roast in 1 hour.`, `${lbs} ÷ ${perHour} = ${hours} hours.`],
      misconceptions: misNum(hours, [[lbs * per, `${lbs * per} is the number of MINUTES. Change it to hours.`]])
    };
  }
};

export const lengthUnits: Topic = {
  id: 'length-units',
  title: 'Yards, feet & inches',
  category: 'Measurement',
  grades: [2, 3],
  strategy: 'Write a number sentence',
  guide: {
    idea: '1 foot = 12 inches. 1 yard = 3 feet = 36 inches.',
    tips: ['Change everything into the smallest unit first.', 'Then add.'],
    traps: ['Adding 1 + 2 + 3 without changing the units first.']
  },
  generate: ({ grade, rng }) => {
    const y = rng.int(1, grade === 2 ? 2 : 4), f = rng.int(1, 2), i = rng.int(1, 11);
    const ans = 36 * y + 12 * f + i;
    return {
      text: `1 yard = 3 feet and 1 foot = 12 inches. How many inches are there altogether in **${y} yard${y > 1 ? 's' : ''} + ${f} feet + ${i} inches**?`.replace('1 feet', '1 foot'),
      scene: lengthScene(y, f, i),
      answer: num(ans, 'inches'),
      hints: [`${y} yard${y > 1 ? 's' : ''} = ${y * 3} feet = ${y * 36} inches.`, `${f} ${f > 1 ? 'feet' : 'foot'} = ${f * 12} inches.`],
      steps: [`${y} yd = ${36 * y} in.`, `${f} ft = ${12 * f} in.`, `${36 * y} + ${12 * f} + ${i} = ${ans} inches.`],
      misconceptions: misNum(ans, [[y + f + i, 'Change every part into inches before adding.'], [12 * (y + f) + i, 'A yard is 3 feet, which is 36 inches, not 12.']])
    };
  }
};

export const segments: Topic = {
  id: 'segments',
  title: 'Distances on a line',
  category: 'Measurement',
  grades: [2, 3],
  strategy: 'Draw a picture',
  guide: {
    idea: 'When segments overlap, the overlap gets counted twice. Use subtraction to find the missing piece.',
    tips: ['Copy the picture and write each length on it.', 'Find a piece you can work out, then use it to find the next one.', 'A midpoint splits a segment into two equal halves.'],
    traps: ['Adding all the numbers you can see.']
  },
  generate: ({ grade, level, rng }) => {
    if (level >= 2 && rng.chance(0.5)) {
      const pr = 2 * rng.int(4, grade === 2 ? 12 : 30), rt = 2 * rng.int(4, grade === 2 ? 12 : 30);
      const ans = pr / 2 + rt / 2;
      return {
        text: `Point Q is halfway between P and R. Point S is halfway between R and T. P to R is **${pr} inches** and R to T is **${rt} inches**. What is the distance from Q to S?`,
        scene: midpointsScene(pr, rt),
        figure: segmentFigure(['P', 'Q', 'R', 'S', 'T'], [0, pr / 2, pr, pr + rt / 2, pr + rt], [{ from: 0, to: 2, label: `${pr}"` }, { from: 2, to: 4, label: `${rt}"` }], []),
        answer: num(ans, 'inches'),
        hints: [`Q to R is half of ${pr}.`, `R to S is half of ${rt}.`],
        steps: [`QR = ${pr} ÷ 2 = ${pr / 2}.`, `RS = ${rt} ÷ 2 = ${rt / 2}.`, `QS = ${pr / 2} + ${rt / 2} = ${ans}.`],
        misconceptions: misNum(ans, [[pr + rt, 'That is P to T. Q and S are the halfway points, so use the halves.']])
      };
    }
    const ab = rng.int(2, 9), bc = rng.int(5, grade === 2 ? 15 : 30), cd = rng.int(4, grade === 2 ? 15 : 30);
    const bd = bc + cd, ac = ab + bc;
    const unit = grade === 2 ? '"' : ' mi';
    return {
      text: `The distance from A to B is **${ab}${unit}**, from B to D is **${bd}${unit}** and from A to C is **${ac}${unit}**, as shown. What is the distance from **C to D**?`,
      scene: segmentsScene(ab, bc, cd, unit),
      figure: segmentFigure(['A', 'B', 'C', 'D'], [0, ab, ac, ac + cd], [{ from: 0, to: 1, label: `${ab}${unit}` }, { from: 1, to: 3, label: `${bd}${unit}` }], [{ from: 0, to: 2, label: `${ac}${unit}` }]),
      answer: num(cd),
      hints: [`First find B to C: A to C take away A to B.`, `Then C to D is B to D take away B to C.`],
      steps: [`BC = ${ac} − ${ab} = ${bc}.`, `CD = ${bd} − ${bc} = ${cd}.`],
      misconceptions: misNum(cd, [[bd - ac, 'B to D and A to C start at different points. Find B to C first.'], [ab + bd + ac, 'Adding every number counts some parts twice. Find B to C first.']])
    };
  }
};

