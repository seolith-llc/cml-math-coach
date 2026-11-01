/** Grade levels supported by the coach. */
export type Grade = 2 | 3;

/** 1 = warm-up, 2 = contest level, 3 = challenge. */
export type Level = 1 | 2 | 3;

/** How an answer should be interpreted and compared. */
export type AnswerSpec =
  | { kind: 'number'; value: number; unit?: string }
  /** Money stored in cents; display decides between ¢ and $. */
  | { kind: 'money'; cents: number }
  /** Clock time in minutes after midnight (0..1439). `ampm` false = ignore AM/PM. */
  | { kind: 'time'; minutes: number; ampm?: boolean }
  | { kind: 'day'; value: string }
  /** Multiple choice; value is the letter of the right option. */
  | { kind: 'choice'; value: string; options: string[] }
  /** One of a fixed list of names / words. */
  | { kind: 'word'; value: string; options: string[] }
  /** Unordered set of numbers ("8 and 3"). */
  | { kind: 'set'; values: number[] };

/** A likely wrong answer and the coaching message that explains the mix-up. */
export interface Misconception {
  answer: AnswerSpec;
  feedback: string;
}

export interface Problem {
  id: string;
  topicId: string;
  grade: Grade;
  level: Level;
  /** Text shown on screen. May contain simple **bold** markup. */
  text: string;
  /** Optional spoken version when the written one has symbols that read badly. */
  speech?: string;
  /** Optional inline SVG figure (uses currentColor so it themes). */
  figure?: string;
  answer: AnswerSpec;
  /** Progressive hints, gentlest first. */
  hints: string[];
  /** Worked solution, one step per line. */
  steps: string[];
  misconceptions?: Misconception[];
}

export type Strategy =
  | 'Draw a picture'
  | 'Work backwards'
  | 'Guess and check'
  | 'Make a list'
  | 'Make a table'
  | 'Look for a pattern'
  | 'Use logical reasoning'
  | 'Number the sections'
  | 'Write a number sentence'
  | 'Act it out';

export interface TopicGuide {
  /** Short kid-friendly explanation of the idea. */
  idea: string;
  /** Strategy steps to remember. */
  tips: string[];
  /** Common traps. */
  traps: string[];
}

export interface Topic {
  id: string;
  title: string;
  category: Category;
  grades: Grade[];
  strategy: Strategy;
  guide: TopicGuide;
  generate: (ctx: GenContext) => Omit<Problem, 'id' | 'topicId' | 'grade' | 'level'>;
}

export type Category =
  | 'Number sense'
  | 'Word problems'
  | 'Money'
  | 'Time & calendar'
  | 'Measurement'
  | 'Logic'
  | 'Counting'
  | 'Puzzles';

export interface GenContext {
  grade: Grade;
  level: Level;
  rng: import('./rng').Rng;
}
