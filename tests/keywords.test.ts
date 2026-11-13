import { describe, expect, it } from 'vitest';
import { TOPICS, makeProblem } from '../src/content/topics';
import type { Grade, Level } from '../src/core/types';

/* Key words: every CML problem marks their key quantities and conditions with **bold**, which the Neon highlight
   (settings.highlight) turns into a fluorescent marker. The voice never reads the markers (prepareForSpeech). */
describe('bold key words', () => {
  for (const topic of TOPICS) {
    it(`${topic.id}: ${topic.track === 'cogat' ? 'bold (the stimulus words) is well-formed' : 'every problem marks its key words'}`, () => {
      for (const grade of [2, 3] as Grade[]) for (const level of [1, 2, 3] as Level[]) for (let s = 1; s <= 20; s++) {
        const p = makeProblem(topic, grade, level, s * 7919);
        const marks = (p.text.match(/\*\*/g) ?? []).length;
        expect(marks % 2, `${p.id}: unbalanced ** in "${p.text}"`).toBe(0);
        expect(p.text, `${p.id}: empty bold`).not.toMatch(/\*\*\s*\*\*/);
        if (p.speech) expect(p.speech, `${p.id}: speech must stay plain`).not.toContain('**');
        // CogAT bolds only its stimulus words (verbal items), so it isn't required to mark key words
        if (topic.track !== 'cogat') expect(marks, `${p.id}: no key word in "${p.text}"`).toBeGreaterThan(0);
      }
    });
  }
});
