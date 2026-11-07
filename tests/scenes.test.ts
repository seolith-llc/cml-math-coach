import { describe, expect, it } from 'vitest';
import { TOPICS, makeProblem } from '../src/content/topics';
import { sceneFor, stepsScene } from '../src/core/explain';
import { SceneBuilder, text } from '../src/core/scene';
import type { Grade, Level } from '../src/core/types';

const SEEDS = 40;

describe('every topic has an animated explanation', () => {
  for (const topic of TOPICS) {
    for (const grade of topic.grades) {
      for (const level of [1, 2, 3] as Level[]) {
        it(`${topic.id} G${grade} L${level}`, () => {
          for (let s = 1; s <= SEEDS; s++) {
            const p = makeProblem(topic, grade as Grade, level, s * 7919);
            const ctx = p.id;
            expect(p.scene, `${ctx} has no custom scene`).toBeDefined();
            const scene = p.scene!;
            expect(scene.steps.length, ctx).toBeGreaterThan(1);
            expect(scene.steps.some((st) => st.reveal), `${ctx} never reveals`).toBe(true);
            expect(scene.steps[0].reveal, `${ctx} gives it away on the first frame`).toBeFalsy();
            for (const st of scene.steps) {
              expect(st.say.trim(), ctx).not.toBe('');
              expect(st.say, ctx).not.toMatch(/NaN|undefined|Infinity|\[object/);
              const ids = st.shapes.map((sh) => sh.id);
              expect(new Set(ids).size, `${ctx} duplicate ids`).toBe(ids.length);
              for (const sh of st.shapes) {
                for (const k of ['x', 'y', 'w', 'h', 'r', 'x2', 'y2', 'rot'] as const) if (sh[k] !== undefined) expect(Number.isFinite(sh[k]), `${ctx} ${sh.id}.${k}`).toBe(true);
                if (sh.text !== undefined) expect(sh.text, `${ctx} ${sh.id}`).not.toMatch(/NaN|undefined/);
                if (sh.d !== undefined) expect(sh.d, `${ctx} ${sh.id}`).not.toMatch(/NaN|undefined/);
              }
            }
          }
        });
      }
    }
  }
});

describe('scene builder', () => {
  it('snapshots each step and makes pulses one-shot', () => {
    const s = new SceneBuilder(100, 100);
    s.add(text('a', 10, 10, 'x', { pulse: true })).step('one');
    s.set('a', { x: 50 }).step('two', { reveal: true });
    s.remove('a').step('three');
    const { steps } = s.build();
    expect(steps.map((st) => st.shapes.length)).toEqual([1, 1, 0]);
    expect(steps[0].shapes[0].pulse).toBe(true);
    expect(steps[1].shapes[0]).toMatchObject({ x: 50, pulse: false });
    expect(steps[1].reveal).toBe(true);
  });

  it('removes by prefix and tidies double periods', () => {
    const s = new SceneBuilder();
    s.add(text('c0', 0, 0, 'a'), text('c1', 0, 0, 'b'), text('d', 0, 0, 'c')).remove('c*').step('At 9:35 A.M..');
    expect(s.steps[0].shapes.map((sh) => sh.id)).toEqual(['d']);
    expect(s.steps[0].say).toBe('At 9:35 A.M.');
  });

  it('falls back to a whiteboard of the written steps', () => {
    const p = makeProblem(TOPICS[0], TOPICS[0].grades[0] as Grade, 1, 1);
    const fallback = stepsScene({ ...p, scene: undefined });
    expect(fallback.steps.length).toBeGreaterThan(1);
    expect(sceneFor({ ...p, scene: undefined })).toEqual(fallback);
  });
});
