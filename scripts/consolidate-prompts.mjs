#!/usr/bin/env node
/**
 * Keeps docs/prompts-history organised as YYYY/MM/<timestamp>_<step>.md.
 * Any markdown file left loose in docs/prompts-history (or in the wrong month folder)
 * is moved into the folder for the year and month in its filename (YYYY-MM-DD...).
 * It also writes an index (docs/prompts-history/README.md) listing every entry by month.
 * Run it at the start of each new month: `npm run prompts:consolidate`.
 */
import { readdirSync, statSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'docs', 'prompts-history');
const STAMP = /^(\d{4})-(\d{2})-\d{2}/;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let moved = 0;
for (const file of walk(root)) {
  const name = file.split(/[\\/]/).pop();
  if (!name.endsWith('.md') || name === 'README.md') continue;
  const m = name.match(STAMP);
  if (!m) continue;
  const targetDir = join(root, m[1], m[2]);
  const target = join(targetDir, name);
  if (file !== target) {
    mkdirSync(targetDir, { recursive: true });
    renameSync(file, target);
    moved++;
  }
}

const entries = walk(root)
  .filter((f) => f.endsWith('.md') && !f.endsWith('README.md'))
  .map((f) => relative(root, f).split(/[\\/]/).join('/'))
  .sort();
const byMonth = new Map();
for (const e of entries) {
  const key = e.split('/').slice(0, 2).join('-');
  byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
}
let index = '# Prompt history\n\nEach request and response is saved as a time-stamped Markdown file, grouped by `YYYY/MM`.\nRun `npm run prompts:consolidate` at the start of each new month to file loose entries and rebuild this index.\n';
for (const [month, files] of [...byMonth.entries()].reverse()) {
  index += `\n## ${month}\n\n` + files.map((f) => `- [${f.split('/').pop().replace(/\.md$/, '')}](${f})`).join('\n') + '\n';
}
writeFileSync(join(root, 'README.md'), index);
console.log(`Consolidated prompt history: ${moved} file(s) moved, ${entries.length} indexed.`);
