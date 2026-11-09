/**
 * End-of-round feedback: the score (plus anything fixed on a second try), one short line,
 * and right/total per question type. Child-first: specific, never loss-framed.
 */
export interface RoundEntry {
  topicId: string;
  title: string;
  /** Right on the first try during the round. */
  ok: boolean;
  /** Missed in the round, then got right when tried again. */
  fixed?: boolean;
}

export interface TypeRow { topicId: string; title: string; right: number; total: number }

export interface RoundFeedback {
  right: number;
  fixed: number;
  total: number;
  missed: number;
  line: string;
  byType: TypeRow[];
}

export function roundFeedback(items: RoundEntry[]): RoundFeedback {
  const total = items.length;
  const right = items.filter((i) => i.ok).length;
  const fixed = items.filter((i) => !i.ok && i.fixed).length;
  const missed = total - right - fixed;
  const map = new Map<string, TypeRow>();
  for (const i of items) {
    const r = map.get(i.topicId) ?? { topicId: i.topicId, title: i.title, right: 0, total: 0 };
    r.total++;
    if (i.ok) r.right++;
    map.set(i.topicId, r);
  }
  const byType = [...map.values()].sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total);
  // point at what is still missed (after any fixes), most-missed type first
  const left = new Map<string, number>();
  for (const i of items) if (!i.ok && !i.fixed) left.set(i.title, (left.get(i.title) ?? 0) + 1);
  const weakest = [...left.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const strong = [...byType].reverse().find((r) => r.right === r.total && r.total >= 2);
  const pct = total ? right / total : 0;

  const parts: string[] = [];
  if (fixed && !missed) parts.push(`You fixed ${fixed === 1 ? 'the one you missed' : `all ${fixed}`}!`);
  else if (fixed) parts.push(`You fixed ${fixed}. ${missed} to go.`);
  else if (pct === 1) parts.push('Every one right!');
  else if (pct >= 0.8) parts.push('Great round.');
  else if (pct >= 0.5) parts.push('Good work.');
  else parts.push('A tricky round.');
  if (strong && pct < 1) parts.push(`${strong.title}: all right.`);
  if (weakest) parts.push(`Watch the explanations for ${weakest}, then try again.`);
  return { right, fixed, total, missed, line: parts.join(' '), byType };
}

/** "7 of 10", or "7 → 9 of 10" once missed ones were fixed. */
export const scoreText = (f: RoundFeedback) => (f.fixed ? `${f.right} → ${f.right + f.fixed} of ${f.total}` : `${f.right} of ${f.total}`);
