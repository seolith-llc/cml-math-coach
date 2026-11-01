import type { Strategy } from '../core/types';

/** George Pólya's four steps from "How to Solve It", in kid-friendly words. */
export const FOUR_STEPS = [
  { title: '1. Understand', text: 'Read the problem twice. What do you know? What is the question really asking? Say it in your own words.' },
  { title: '2. Plan', text: 'Pick a strategy: draw a picture, make a list, guess and check, work backwards…' },
  { title: '3. Solve', text: 'Carry out your plan carefully. Write down your work so you can check it.' },
  { title: '4. Look back', text: 'Does your answer make sense? Put it back into the problem to check. Did you answer the question that was asked?' }
];

export const STRATEGIES: Record<Strategy, string> = {
  'Draw a picture': 'Sketch the story: a number line, boxes, a clock or circles. Pictures make hidden facts easy to see.',
  'Work backwards': 'If you know how the story ends, start at the end and undo each step.',
  'Guess and check': 'Make a smart guess, check it, then make your next guess better. Keep a list of your guesses.',
  'Make a list': 'Write possibilities in an organised order so you do not miss any or count any twice.',
  'Make a table': 'Put information in rows and columns. Great for ages, prices and "who did what" puzzles.',
  'Look for a pattern': 'Look at how numbers change from one to the next. Repeating patterns help with calendars and sequences.',
  'Use logical reasoning': 'Use each clue to rule things out. What MUST be true? What CANNOT be true?',
  'Number the sections': 'For counting shapes, number each small piece. Then list shapes made of 1 piece, 2 pieces, 3 pieces…',
  'Write a number sentence': 'Turn the words into maths: "3 more than" means + 3, "twice as many" means × 2.',
  'Act it out': 'Use coins, blocks or people to act out the story step by step.'
};

/** Contest-day advice for 30-minute, 6-question meets. */
export const CONTEST_TIPS = [
  'You have about 5 minutes for each question. If you are stuck for 2 minutes, move on and come back later.',
  'Underline the question part, for example "how many MORE", "the LARGER number", "how many PIGS".',
  'Write answers with the right units: ¢ or $, inches, hours, a day of the week.',
  'Easier questions usually come first. Do not rush them, because careless mistakes cost the same as hard ones.',
  'Use the last minutes to check: put your answer back into the story.',
  'Neat work helps you find your own mistakes.'
];
