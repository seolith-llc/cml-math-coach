import type { Grade } from './types';
import { normalizeTest, type TestConfig } from './session';
import { GOALS, awardStars, localDay, streak } from './progress';

export interface TopicStat {
  attempts: number;
  correct: number;
  /** Exponentially weighted accuracy, 0..1. Recent answers count more. */
  mastery: number;
  streak: number;
  lastSeen: number;
  /** Earned stars 0–3 (never decrease). */
  stars?: number;
}

export interface ReviewItem {
  problemId: string;
  /** Leitner box 1..5. Higher boxes come back less often. */
  box: number;
  due: number;
  wrongAnswer?: string;
}

export interface MeetRecord {
  date: number;
  grade: Grade;
  score: number;
  total: number;
  seconds: number;
  /** Setup used (absent on records from before 2026-11-04 = a 6-question, 30-minute meet). */
  config?: TestConfig;
  topics: { topicId: string; correct: boolean }[];
}

export interface Settings {
  name: string;
  grade: Grade;
  /** Talking speed, 0.6–1.4. */
  rate: number;
  /** "natural:<aura speaker>" (cloud, falls back to the device offline) or "device:<voiceURI>" ("device:" = best available). */
  voice: string;
  /** Read questions, feedback and solutions aloud. */
  speak: boolean;
  /** Listen for answers automatically after each question is read. */
  handsFree: boolean;
  /** Last test setup (questions, feedback, clock). */
  test: TestConfig;
  /** Problems per day. */
  goal: number;
  /** Daily practice reminder on this device (web push), at a local hour. */
  reminder: { on: boolean; hour: number };
}

/** Settings stored by older versions (before 2026-11-03). */
interface LegacySettings {
  autoRead?: boolean;
  speakFeedback?: boolean;
  voiceEngine?: 'premium' | 'device';
  premiumVoice?: string;
  voiceURI?: string;
}

export function migrateSettings(raw: Partial<Settings> & LegacySettings, base: Settings): Settings {
  const { autoRead, speakFeedback, voiceEngine, premiumVoice, voiceURI, ...rest } = raw;
  const out: Settings = { ...base, ...rest };
  if (raw.speak === undefined && (autoRead !== undefined || speakFeedback !== undefined)) out.speak = autoRead !== false || speakFeedback !== false;
  if (raw.voice === undefined && voiceEngine) out.voice = voiceEngine === 'device' ? `device:${voiceURI ?? ''}` : `natural:${premiumVoice || 'luna'}`;
  out.test = normalizeTest(raw.test);
  out.goal = (GOALS as readonly number[]).includes(Number(raw.goal)) ? Number(raw.goal) : base.goal;
  const r = raw.reminder;
  out.reminder = { on: !!r?.on, hour: Number.isInteger(r?.hour) && r!.hour >= 6 && r!.hour <= 21 ? r!.hour : base.reminder.hour };
  return out;
}

/** One answered problem, kept for the parent dashboard (synced when enabled). */
export interface AttemptLog {
  ts: number;
  problemId: string;
  topicId: string;
  grade: Grade;
  level: number;
  /** Solved in the end (possibly after a hint or a retry). */
  correct: boolean;
  /** Solved on the first try with no hints. */
  firstTry: boolean;
  skipped?: boolean;
  hints?: number;
  seconds?: number;
  /** First wrong answer, if any. */
  answer?: string;
  mode: 'practice' | 'review' | 'meet';
}

export interface SyncState {
  familyId: string;
  /** Highest attempt timestamp the server has confirmed. */
  lastTs: number;
  lastSyncAt?: number;
  lastError?: string;
}

/** Which kind of round: CML practice, CogAT practice, or the Review queue. */
export type RoundKind = 'cml' | 'cogat' | 'review';

/** The last finished round of a kind, so its summary, explanations and retries can be reopened later. */
export interface SavedRound {
  kind: RoundKind;
  grade: Grade;
  /** When the round finished. */
  at: number;
  items: { problemId: string; ok: boolean; answer?: string; fixed?: boolean }[];
}

export interface AppState {
  version: 1;
  settings: Settings;
  stats: Record<string, Record<string, TopicStat>>; // grade -> topicId -> stat
  review: ReviewItem[];
  meets: MeetRecord[];
  activeDays: string[]; // yyyy-mm-dd
  log: AttemptLog[];
  sync?: SyncState;
  /** Last round per `${grade}:${kind}`. */
  rounds?: Record<string, SavedRound>;
}

const KEY = 'cml-coach-v1';

export const defaultState = (): AppState => ({
  version: 1,
  settings: { name: '', grade: 2, rate: 0.95, voice: 'natural:luna', speak: true, handsFree: false, test: normalizeTest(undefined), goal: 10, reminder: { on: false, hour: 17 } },
  stats: { '2': {}, '3': {} },
  review: [],
  meets: [],
  activeDays: [],
  log: []
});

let memory: AppState | null = null;

export function load(): AppState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      const base = defaultState();
      memory = { ...base, ...parsed, settings: migrateSettings(parsed.settings ?? {}, base.settings), stats: { ...base.stats, ...parsed.stats } };
      if ('autoRead' in (parsed.settings ?? {}) || 'voiceEngine' in (parsed.settings ?? {})) save(memory); // persist the migration once
      return memory;
    }
  } catch {
    /* private mode or corrupted - fall through to defaults */
  }
  memory = defaultState();
  return memory;
}

export function save(state: AppState = load()): void {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked - keep in memory */
  }
}

export const roundKey = (grade: Grade, kind: RoundKind) => `${grade}:${kind}`;

export function saveRound(state: AppState, round: SavedRound): void {
  (state.rounds ??= {})[roundKey(round.grade, round.kind)] = round;
  save(state);
  // lets the parent dashboard sync pick up the round (and its fixes) promptly
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cml:progress'));
}

export const lastRound = (state: AppState, grade: Grade, kind: RoundKind): SavedRound | undefined => state.rounds?.[roundKey(grade, kind)];

/** Clears progress on this device. Keeps the parent-dashboard link so the online copy isn't orphaned. */
export function reset(): void {
  const sync = memory?.sync ?? load().sync;
  memory = defaultState();
  if (sync) memory.sync = { ...sync };
  save(memory);
}

/** Local calendar day (an evening session counts for today, not tomorrow's UTC date). */
export const today = (d: Date | number = new Date()) => localDay(d);

const DAY = 86_400_000;
const BOX_DAYS = [0, 0, 1, 3, 7, 14];

const LOG_MAX = 4000;

export type AttemptDetail = Omit<AttemptLog, 'ts' | 'topicId' | 'grade' | 'firstTry'> & { firstTry?: boolean };

/** What changed, so the screen can celebrate: a topic moved up a level, or today's goal was just met. */
export interface ProgressEvent {
  stars?: { topicId: string; stars: number };
  goalReached?: boolean;
}

export function recordAttempt(state: AppState, grade: Grade, topicId: string, correct: boolean, detail?: AttemptDetail): ProgressEvent {
  const day = today();
  const before = state.log.filter((a) => today(a.ts) === day).length;
  if (detail) {
    const last = state.log[state.log.length - 1];
    const ts = Math.max(Date.now(), (last?.ts ?? 0) + 1); // unique, increasing
    state.log.push({ ...detail, ts, topicId, grade, firstTry: detail.firstTry ?? correct });
    if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  }
  const g = (state.stats[String(grade)] ??= {});
  const s = (g[topicId] ??= { attempts: 0, correct: 0, mastery: 0.3, streak: 0, lastSeen: 0 });
  s.attempts++;
  if (correct) s.correct++;
  s.mastery = s.mastery * 0.75 + (correct ? 1 : 0) * 0.25;
  s.streak = correct ? s.streak + 1 : 0;
  s.lastSeen = Date.now();
  const up = awardStars(s);
  if (!state.activeDays.includes(day)) state.activeDays.push(day);
  save(state);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cml:progress'));
  const after = detail ? before + 1 : before;
  return {
    ...(up ? { stars: { topicId, stars: up } } : {}),
    ...(before < state.settings.goal && after >= state.settings.goal ? { goalReached: true } : {})
  };
}

/** Put a missed problem in the review queue (or move it back to box 1). */
export function addToReview(state: AppState, problemId: string, wrongAnswer?: string): void {
  const existing = state.review.find((r) => r.problemId === problemId);
  if (existing) {
    existing.box = 1;
    existing.due = Date.now();
    existing.wrongAnswer = wrongAnswer;
  } else state.review.push({ problemId, box: 1, due: Date.now(), wrongAnswer });
  save(state);
}

export function reviewResult(state: AppState, problemId: string, correct: boolean): void {
  const r = state.review.find((x) => x.problemId === problemId);
  if (!r) return;
  if (correct && r.box >= 5) {
    state.review = state.review.filter((x) => x !== r); // mastered
  } else {
    r.box = correct ? r.box + 1 : 1;
    r.due = Date.now() + BOX_DAYS[r.box] * DAY;
  }
  save(state);
}

export function dueReviews(state: AppState, grade: Grade): ReviewItem[] {
  const now = Date.now();
  return state.review.filter((r) => r.due <= now && r.problemId.split(':')[1] === String(grade));
}

/** Number of consecutive days with practice, ending today or yesterday. */
/** Consecutive practice days; one missed day a week is forgiven (see core/progress.ts). */
export function dayStreak(state: AppState): number {
  return streak(state.activeDays);
}
