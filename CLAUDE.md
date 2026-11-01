# CML Math Coach — working agreements

## Prompt history (standing instruction)
- Save **every** request and response as a time-stamped Markdown file under
  `docs/prompts-history/YYYY/MM/YYYY-MM-DDTHH-MM-SSZ_stepNNN.md` (UTC).
- Each file has: step id, timestamp, the user request (verbatim), and a summary of the response
  (decisions, files changed, verification, next steps).
- At the start of each new month run `npm run prompts:consolidate`. It files any loose entries
  into `YYYY/MM` and rebuilds `docs/prompts-history/README.md`.
- Step ids come from the user's `#stepNNN` tag. Continue the sequence when no tag is given.

## Project rules
- Never commit the original CML contest papers (copyrighted). Write original problems only.
- Problem generators must stay deterministic for a given seed (problem ids encode `topic:grade:level:seed`).
- Run `npm test` and `npm run build` before committing.
