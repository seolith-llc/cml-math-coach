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
  rate: number;
  voiceURI?: string;
  autoRead: boolean;
  handsFree: boolean;
  /** Say feedback out loud. */
  speakFeedback: boolean;
}

export interface AppState {
  version: 1;
  settings: Settings;
  stats: Record<string, Record<string, TopicStat>>; // grade -> topicId -> stat
  review: ReviewItem[];
  meets: MeetRecord[];
  activeDays: string[]; // yyyy-mm-dd
}

const KEY = 'cml-coach-v1';

export const defaultState = (): AppState => ({
  version: 1,
  settings: { name: '', grade: 2, rate: 0.95, autoRead: true, handsFree: false, speakFeedback: true },
  stats: { '2': {}, '3': {} },
  review: [],
  meets: [],
  activeDays: []
});

let memory: AppState | null = null;

export function load(): AppState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      const base = defaultState();
      memory = { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings }, stats: { ...base.stats, ...parsed.stats } };
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

export function reset(): void {
  memory = defaultState();
  save(memory);
}

export const today = (d = new Date()) => d.toISOString().slice(0, 10);

const DAY = 86_400_000;
const BOX_DAYS = [0, 0, 1, 3, 7, 14];

export function recordAttempt(state: AppState, grade: Grade, topicId: string, correct: boolean): void {
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
