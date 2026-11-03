import type { Grade } from './types';

export interface TopicStat {
  attempts: number;
  correct: number;
  /** Exponentially weighted accuracy, 0..1. Recent answers count more. */
  mastery: number;
  streak: number;
  lastSeen: number;
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

export interface AppState {
  version: 1;
  settings: Settings;
  stats: Record<string, Record<string, TopicStat>>; // grade -> topicId -> stat
  review: ReviewItem[];
  meets: MeetRecord[];
  activeDays: string[]; // yyyy-mm-dd
  log: AttemptLog[];
  sync?: SyncState;
}

const KEY = 'cml-coach-v1';

export const defaultState = (): AppState => ({
  version: 1,
  settings: { name: '', grade: 2, rate: 0.95, voice: 'natural:luna', speak: true, handsFree: false },
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

/** Clears progress on this device. Keeps the parent-dashboard link so the online copy isn't orphaned. */
export function reset(): void {
  const sync = memory?.sync ?? load().sync;
  memory = defaultState();
  if (sync) memory.sync = { ...sync };
  save(memory);
}

export const today = (d = new Date()) => d.toISOString().slice(0, 10);

const DAY = 86_400_000;
const BOX_DAYS = [0, 0, 1, 3, 7, 14];

const LOG_MAX = 4000;

export type AttemptDetail = Omit<AttemptLog, 'ts' | 'topicId' | 'grade' | 'firstTry'> & { firstTry?: boolean };

export function recordAttempt(state: AppState, grade: Grade, topicId: string, correct: boolean, detail?: AttemptDetail): void {
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
  const d = today();
  if (!state.activeDays.includes(d)) state.activeDays.push(d);
  save(state);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cml:progress'));
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
export function dayStreak(state: AppState): number {
  const set = new Set(state.activeDays);
  let n = 0;
  const d = new Date();
  if (!set.has(today(d))) d.setDate(d.getDate() - 1);
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
