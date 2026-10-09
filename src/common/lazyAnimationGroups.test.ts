import { describe, expect, it } from 'vitest';
import type { AnimationGroup } from '../libs/babylon/exports';
import {
  animationGroupSource,
  clonedAnimationGroupCount,
  forEachAnimationGroup,
  lazyAnimationGroups,
} from './lazyAnimationGroups';

const group = (name: string) => ({ name, isStarted: false }) as unknown as AnimationGroup;

function setup(count: number) {
  const sources = Array.from({ length: count }, (_, i) => group(`clip${i}`));
  let made = 0;
  const groups = lazyAnimationGroups(sources, source => {
    made++;
    return group(`${source.name}-clone`);
  });
  return { sources, groups, made: () => made };
}

describe('lazyAnimationGroups', () => {
  it('counts every clip but clones one only when it is read', () => {
    const { groups, made } = setup(236);
    expect(groups.length).toBe(236);
    expect(made()).toBe(0);
    expect(groups[5].name).toBe('clip5-clone');
    expect(groups[5]).toBe(groups[5]);
    expect(made()).toBe(1);
    expect(groups[300]).toBeUndefined();
  });

  it('iterates only the cloned clips, with their own indices', () => {
    const { groups, made } = setup(10);
    void groups[2];
    void groups[7];
    const seen: [string, number][] = [];
    groups.forEach((g, i) => seen.push([g.name, i]));
    expect(seen).toEqual([['clip2-clone', 2], ['clip7-clone', 7]]);
    expect([...groups].length).toBe(2);
    expect(groups.some(g => g.name === 'clip7-clone')).toBe(true);
    expect(groups.findIndex(g => g.name === 'clip7-clone')).toBe(7);
    expect(made()).toBe(2);
  });

  it('runs a hook on the cloned clips and on each one cloned later', () => {
    const { groups } = setup(5);
    void groups[1];
    const hooked: number[] = [];
    forEachAnimationGroup(groups, (_, i) => hooked.push(i));
    expect(hooked).toEqual([1]);
    void groups[3];
    void groups[3];
    expect(hooked).toEqual([1, 3]);
  });

  it('reads a source without cloning it, and takes pushed clips', () => {
    const { sources, groups, made } = setup(4);
    expect(animationGroupSource(groups, 2)).toBe(sources[2]);
    expect(made()).toBe(0);
    const extra = group('instrument');
    expect(groups.push(extra)).toBe(5);
    expect(groups[4]).toBe(extra);
    expect(clonedAnimationGroupCount(groups)).toBe(1);
  });

  it('clones nothing for a copy that is gone', () => {
    const groups = lazyAnimationGroups([group('a')], () => null);
    expect(groups[0]).toBeUndefined();
    expect(clonedAnimationGroupCount(groups)).toBe(0);
  });

  it('leaves a plain array alone', () => {
    const plain = [group('a'), group('b')];
    const seen: number[] = [];
    forEachAnimationGroup(plain, (_, i) => seen.push(i));
    expect(seen).toEqual([0, 1]);
    expect(animationGroupSource(plain, 1)).toBe(plain[1]);
  });
});
