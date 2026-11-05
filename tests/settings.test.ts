import { describe, expect, it } from 'vitest';
import { defaultState, migrateSettings } from '../src/core/storage';
import { voiceOptions } from '../src/voice/speech';

const base = defaultState().settings;

describe('settings', () => {
  it('migrates the pre-2026-11-03 voice settings', () => {
    expect(migrateSettings({ name: 'Sam', autoRead: false, speakFeedback: false, voiceEngine: 'premium', premiumVoice: 'thalia' } as never, base))
      .toEqual({ ...base, name: 'Sam', speak: false, voice: 'natural:thalia' });
    expect(migrateSettings({ autoRead: true, speakFeedback: false, voiceEngine: 'device', voiceURI: 'com.apple.voice.premium.en-US.Zoe' } as never, base))
      .toMatchObject({ speak: true, voice: 'device:com.apple.voice.premium.en-US.Zoe' });
    expect(migrateSettings({ voiceEngine: 'device' } as never, base).voice).toBe('device:');
  });
  it('leaves new-format settings alone and fills defaults', () => {
    expect(migrateSettings({ voice: 'natural:orion', speak: false }, base)).toEqual({ ...base, voice: 'natural:orion', speak: false });
    expect(migrateSettings({}, base)).toEqual(base);
  });
  it('adds the daily goal and reminder with safe values', () => {
    expect(base.goal).toBe(10);
    expect(base.reminder).toEqual({ on: false, hour: 17 });
    expect(migrateSettings({ goal: 7, reminder: { on: true, hour: 3 } } as never, base)).toMatchObject({ goal: 10, reminder: { on: true, hour: 17 } });
    expect(migrateSettings({ goal: 15, reminder: { on: true, hour: 19 } } as never, base)).toMatchObject({ goal: 15, reminder: { on: true, hour: 19 } });
  });
  it('adds and cleans the test setup', () => {
    expect(base.test).toEqual({ count: 6, feedback: 'test', clock: 'total', totalMinutes: 30, eachSeconds: 120 });
    expect(migrateSettings({ test: { count: 11, clock: 'each', eachSeconds: 95 } } as never, base).test)
      .toEqual({ count: 10, feedback: 'test', clock: 'each', totalMinutes: 30, eachSeconds: 90 });
  });
  it('maps the voice setting to speech options', () => {
    expect(voiceOptions('natural:orion', 1.1)).toEqual({ rate: 1.1, engine: 'premium', premiumVoice: 'orion' });
    expect(voiceOptions('device:urn:voice:a:b', 1)).toEqual({ rate: 1, engine: 'device', voiceURI: 'urn:voice:a:b' });
    expect(voiceOptions('device:', 1)).toEqual({ rate: 1, engine: 'device', voiceURI: undefined });
  });
});
