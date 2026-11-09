import { describe, expect, it } from 'vitest';
import { roundFeedback, scoreText, type RoundEntry } from '../src/core/feedback';

const e = (topicId: string, ok: boolean, fixed = false): RoundEntry => ({ topicId, title: topicId, ok, fixed });

describe('end-of-round feedback', () => {
  it('scores first tries and shows fixes as an improvement', () => {
    const items = [e('a', true), e('a', true), e('b', false, true), e('b', false), e('c', true)];
    const f = roundFeedback(items);
    expect([f.right, f.fixed, f.missed, f.total]).toEqual([3, 1, 1, 5]);
    expect(scoreText(f)).toBe('3 → 4 of 5');
    expect(f.line).toContain('You fixed 1. 1 to go.');
  });

  it('praises a perfect round and never mentions a weak type', () => {
    const f = roundFeedback([e('a', true), e('b', true)]);
    expect(f.line).toBe('Every one right!');
    expect(scoreText(f)).toBe('2 of 2');
  });

  it('points at the weakest type, and names a strong one', () => {
    const f = roundFeedback([e('Paper folding', false), e('Paper folding', false), e('Number series', true), e('Number series', true), e('Matrices', true)]);
    expect(f.byType[0]).toMatchObject({ topicId: 'Paper folding', right: 0, total: 2 });
    expect(f.line).toContain('Number series: all right.');
    expect(f.line).toContain('Watch the explanations for Paper folding');
  });

  it('after fixes, points at the type that is still missed', () => {
    const f = roundFeedback([e('Paper folding', false, true), e('Paper folding', false, true), e('Matrices', false), e('Matrices', true)]);
    expect(f.line).toContain('Watch the explanations for Matrices');
    expect(f.line).not.toContain('Paper folding');
  });

  it('celebrates fixing everything that was missed', () => {
    const f = roundFeedback([e('a', true), e('b', false, true), e('c', false, true)]);
    expect(f.line).toBe('You fixed all 2!');
    expect(f.missed).toBe(0);
  });

  it('is never loss-framed', () => {
    for (const items of [[e('a', false)], [e('a', false), e('b', false), e('c', true)]]) expect(roundFeedback(items).line).not.toMatch(/lost|fail|bad|wrong|only/i);
  });
});
