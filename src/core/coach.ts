import type { Problem } from './types';
import { checkAnswer, diagnose, formatAnswer } from './answer';
import type { Rng } from './rng';

export type Verdict = 'correct' | 'wrong' | 'unclear';

export interface Feedback {
  verdict: Verdict;
  message: string;
  /** True once the learner has used all tries and should see the worked solution. */
  reveal: boolean;
  /** The alternative we judged, so the UI can show "I heard …". */
  heard?: string;
}

const PRAISE = ['Correct! Great thinking.', 'Yes! You got it.', 'Excellent work!', 'That is right. Nice job!', 'Perfect! You are on fire.', 'Correct! Your strategy worked.'];
const RETRY = ['Not quite. Let\'s try again.', 'Close, but not yet.', 'Hmm, check that one again.', 'Good try! Have another go.'];

/**
 * Coaching policy for one problem. The first wrong answer gets a targeted message
 * (or a hint). After `maxTries` wrong answers the worked solution is revealed.
 */
export class Coach {
  tries = 0;
  hintsUsed = 0;
  solved = false;
  firstTryCorrect = false;
  wrongAnswers: string[] = [];

  constructor(public problem: Problem, private rng: Rng, public maxTries = 2) {}

  nextHint(): string | undefined {
    if (this.hintsUsed >= this.problem.hints.length) return undefined;
    return this.problem.hints[this.hintsUsed++];
  }

  /** `alternatives` = typed text, or several speech-recognition hypotheses. */
  answer(alternatives: string[]): Feedback {
    const alts = alternatives.map((a) => a.trim()).filter(Boolean);
    const results = alts.map((a) => ({ a, r: checkAnswer(this.problem.answer, a) }));
    const hit = results.find((x) => x.r.correct);
    if (hit) {
      this.solved = true;
      this.firstTryCorrect = this.tries === 0 && this.hintsUsed === 0;
      this.tries++;
      const praise = this.rng.pick(PRAISE);
      return { verdict: 'correct', message: this.hintsUsed || this.tries > 1 ? `${praise} You kept going, and that is how champions learn.` : praise, reveal: false, heard: hit.a };
    }
    const understood = results.find((x) => x.r.understood);
    if (!understood) {
      return { verdict: 'unclear', message: 'Sorry, I did not catch an answer. Try again, or type it in.', reveal: false, heard: alts[0] };
    }
    this.tries++;
    this.wrongAnswers.push(understood.a);
    const diag = diagnose(this.problem, understood.a);
    if (this.tries >= this.maxTries) {
      return {
        verdict: 'wrong',
        message: `${diag ? diag + ' ' : ''}The answer is ${formatAnswer(this.problem.answer)}. Let's walk through it together.`,
        reveal: true,
        heard: understood.a
      };
    }
    const hint = diag ? undefined : this.nextHint();
    return {
      verdict: 'wrong',
      message: diag ? `${diag} Try again!` : `${this.rng.pick(RETRY)}${hint ? ' Hint: ' + hint : ''}`,
      reveal: false,
      heard: understood.a
    };
  }
}
