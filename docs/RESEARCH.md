# Research notes

## Puzzle families
- Short answers (a number, an amount of money, a time, a name, a weekday), a few multiple choice, 6 questions in 30 minutes for a timed challenge.
- Families (all generated, all original): missing number and box equations, comparing two computations, sum and difference, ages, transfers ("twice as many"),
  multi-step stories, heads and legs, unit rate, coins (value, change, ways, distinct amounts, smallest amount), calendar day-of-week,
  elapsed time and halfway times, unit conversion, number-line segments, ordering and matching logic, counting triangles and rectangles,
  Venn diagrams, digit counting, number riddles, letter-digit puzzles, made-up operations (Grade 3), shape equations, packages (Grade 3),
  balance problems, palindromes and magic arrangements. These are common puzzle genres, not taken from any paper or test.
- Grade 3 reuses Grade 2 ideas with larger numbers and one more step: grade-specific number ranges and three difficulty levels.
- Placement puzzles accept **any** valid arrangement. Two "as many / more than" clues only fix *girls − boys*, so Grade 2 pairs one direct
  count with one relation, and Grade 3 adds "twice / three times" clues, which make two-relation puzzles solvable.

## Pedagogy
- **Pólya's 4 steps** (Understand, Plan, Solve, Look back) and a fixed set of named strategies give children a shared language.
- **Retrieval practice + spacing** (Leitner boxes) improves long-term retention compared with massed practice.
- **Immediate, specific feedback** on misconceptions works better than plain right/wrong marking.
- **Adaptive difficulty** keeps the learner in the "just hard enough" zone. Mastery is an exponentially weighted moving average of first-try correctness.

## Voice technology (Web Speech API)
- Speech synthesis is supported in all major browsers.
- Speech recognition: Chrome/Edge (server-based, `webkitSpeechRecognition`) and Safari 14.1+/iOS 14.5+ (prefixed).
  Firefox has it behind a flag. Chrome has started shipping on-device recognition (`processLocally`), which isn't used yet.
- Chrome may cut off long utterances, so the app speaks sentence by sentence. Recognition needs a secure context (HTTPS or localhost).

## iPad / iOS notes
- Speech recognition works in Safari tabs but is not exposed to Home Screen web apps (WebKit bug 225298).
- iOS needs a user gesture before the first speech synthesis, so the app unlocks it on the first tap.

## Sources
- https://bugs.webkit.org/show_bug.cgi?id=225298
- https://developer.apple.com/forums/thread/748048
- https://www.mersnj.us/Page/6014 (school overview of Number Puzzles)
- https://news.harker.org/grade-3-students-win-math-league-regional-award/
- https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api
- https://www.testmuai.com/learning-hub/speech-recognition-api-browser-support/
- https://www.w3.org/events/meetings/7253e1ff-d84f-48b9-85b0-e7e0d956e4de
