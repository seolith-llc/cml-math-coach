import { describe, expect, it } from 'vitest';
import { checkAnswer, parseMoney, parseTime } from '../src/core/answer';
import { numberToWords, parseNumbers } from '../src/core/numberWords';

describe('parseNumbers', () => {
  it.each([
    ['42', [42]],
    ['forty two', [42]],
    ['forty-two', [42]],
    ['one hundred and five', [105]],
    ['three hundred forty two', [342]],
    ['16,900', [16900]],
    ['sixteen thousand nine hundred', [16900]],
    ['two thousand five', [2005]],
    ['8 and 3', [8, 3]],
    ['eight and three', [8, 3]],
    ['second', [2]],
    ['the 2nd', [2]],
    ['I want to go', []],
    ['zero', [0]],
    ['twenty one', [21]],
    ['five five', [5, 5]]
  ])('%s -> %j', (input, expected) => {
    expect(parseNumbers(input)).toEqual(expected);
  });
  it('round-trips numberToWords for 0..20000 (sampled)', () => {
    for (let n = 0; n <= 20000; n += 37) expect(parseNumbers(numberToWords(n))).toEqual([n]);
  });
});

describe('checkAnswer', () => {
  it('numbers with filler words', () => {
    expect(checkAnswer({ kind: 'number', value: 73 }, 'I think the answer is seventy three').correct).toBe(true);
    expect(checkAnswer({ kind: 'number', value: 73 }, '74').correct).toBe(false);
    expect(checkAnswer({ kind: 'number', value: 73 }, 'banana').understood).toBe(false);
  });
  it('money in several forms', () => {
    const spec = { kind: 'money', cents: 125 } as const;
    for (const s of ['$1.25', '1.25', '125 cents', 'one dollar and twenty five cents', '1 dollar 25']) expect(checkAnswer(spec, s).correct, s).toBe(true);
    expect(checkAnswer({ kind: 'money', cents: 23 }, '23').correct).toBe(true);
    expect(checkAnswer({ kind: 'money', cents: 23 }, '23 cents').correct).toBe(true);
    expect(checkAnswer({ kind: 'money', cents: 300 }, '3 dollars').correct).toBe(true);
    expect(parseMoney('$2')).toEqual([200]);
  });
  it('times', () => {
    const spec = { kind: 'time', minutes: 16 * 60 + 2, ampm: false } as const;
    for (const s of ['4:02', '4:02 pm', 'four oh two', '402']) expect(checkAnswer(spec, s).correct, s).toBe(true);
    const strict = { kind: 'time', minutes: 13 * 60 + 10, ampm: true } as const;
    expect(checkAnswer(strict, '1:10 p.m.').correct).toBe(true);
    expect(checkAnswer(strict, '1:10 a.m.').correct).toBe(false);
    expect(checkAnswer(strict, 'one ten').correct).toBe(true);
    expect(parseTime('10 to 3').minutes.length).toBeGreaterThan(0);
  });
  it('days, words, choices, sets', () => {
    expect(checkAnswer({ kind: 'day', value: 'Monday' }, "it's monday").correct).toBe(true);
    expect(checkAnswer({ kind: 'word', value: 'Mrs. Chen', options: ['Mrs. Chen', 'Mrs. Diaz', 'Mrs. Kim'] }, 'Chen').correct).toBe(true);
    expect(checkAnswer({ kind: 'word', value: 'Travel Club', options: ['Garden Club', 'Chess Club', 'Travel Club'] }, 'the travel club').correct).toBe(true);
    expect(checkAnswer({ kind: 'choice', value: 'b', options: ['1', '2', '3'] }, 'letter b').correct).toBe(true);
    expect(checkAnswer({ kind: 'choice', value: 'b', options: ['1', '2', '3'] }, 'bee').correct).toBe(true);
    expect(checkAnswer({ kind: 'set', values: [3, 8] }, 'eight and three').correct).toBe(true);
    expect(checkAnswer({ kind: 'set', values: [3, 8] }, '8').correct).toBe(false);
  });
});

import { parseCommand } from '../src/voice/recognition';
import { prepareForSpeech } from '../src/voice/speech';

describe('voice helpers', () => {
  it('parses commands but not answers', () => {
    expect(parseCommand('Repeat')).toBe('repeat');
    expect(parseCommand('give me a hint')).toBe('hint');
    expect(parseCommand('show me the answer')).toBe('explain');
    expect(parseCommand("I don't know")).toBe('skip');
    expect(parseCommand('42')).toBeUndefined();
    expect(parseCommand('Monday')).toBeUndefined();
  });
  it('prepares maths for speech', () => {
    expect(prepareForSpeech('$1.25 and 45¢')).toBe('1 dollars and 25 cents and 45 cents'.replace('1 dollars', '1 dollar'));
    expect(prepareForSpeech('32 − □ = 28')).toBe('32 minus box equals 28');
    expect(prepareForSpeech('4:02 P.M.')).toBe('4:02 P M');
  });
});
