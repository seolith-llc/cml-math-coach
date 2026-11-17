/**
 * Game vs Classic tester round (docs/GAME-MODE.md, phase 5). Pure: takes a family's synced round log
 * (snapshot.roundLog: look, music, right/fixed/total per finished round) and compares the looks,
 * and music on vs off within the game look. Used by scripts/status.mjs; tested in tests/experiment.test.ts.
 */
const DAY = 86_400_000;

/** @param {{at:number,look:string,music:string,total:number,right:number,fixed:number}[]} rounds */
function stats(rounds) {
  const total = rounds.reduce((n, r) => n + r.total, 0);
  const right = rounds.reduce((n, r) => n + r.right, 0);
  const days = new Set(rounds.map((r) => new Date(r.at).toISOString().slice(0, 10))).size;
  return {
    rounds: rounds.length,
    days,
    roundsPerDay: days ? Math.round((rounds.length / days) * 10) / 10 : 0,
    firstTryPct: total ? Math.round((right / total) * 100) : null,
    fixed: rounds.reduce((n, r) => n + r.fixed, 0)
  };
}

/** Compare the looks over the last `days` days. Too little data is flagged, not hidden. */
export function compareLooks(roundLog, now = Date.now(), days = 28) {
  const recent = (Array.isArray(roundLog) ? roundLog : []).filter(
    (r) => r && Number.isFinite(r.at) && r.at >= now - days * DAY && r.at <= now && r.total > 0 && r.right >= 0 && r.right <= r.total
  );
  const game = recent.filter((r) => r.look === 'game');
  const classic = recent.filter((r) => r.look !== 'game');
  const out = {
    classic: stats(classic),
    game: stats(game),
    musicOn: stats(game.filter((r) => r.music && r.music !== 'off')),
    musicOff: stats(game.filter((r) => !r.music || r.music === 'off'))
  };
  // Enough to say anything? At least 5 rounds over 3 days on each side of a comparison.
  const enough = (a, b) => a.rounds >= 5 && b.rounds >= 5 && a.days >= 3 && b.days >= 3;
  return { ...out, enoughLooks: enough(out.classic, out.game), enoughMusic: enough(out.musicOn, out.musicOff) };
}

const fmt = (s) => (s.rounds ? `${s.rounds} round${s.rounds === 1 ? '' : 's'} on ${s.days} day${s.days === 1 ? '' : 's'} (${s.roundsPerDay}/day), ${s.firstTryPct}% first try, ${s.fixed} fixed` : 'no rounds');

/** One readable block per family (no names: these logs are public). */
export function formatComparison(label, c) {
  return [
    `${label}`,
    `  Classic: ${fmt(c.classic)}`,
    `  Game:    ${fmt(c.game)}${c.enoughLooks ? '' : '   (not enough data yet to compare)'}`,
    `  Game with music: ${fmt(c.musicOn)} · without: ${fmt(c.musicOff)}${c.enoughMusic ? '' : '   (not enough yet)'}`
  ].join('\n');
}
