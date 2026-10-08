import { afterEach, expect, test } from 'vitest';
import { nextShedLevel, setShedSource, shedLevel } from './loadShed';

afterEach(() => setShedSource(null));

test('steps down as the frame rate falls under the cap', () => {
  expect(nextShedLevel(58, 60, 0)).toBe(0);
  expect(nextShedLevel(35, 60, 0)).toBe(1);
  expect(nextShedLevel(15, 60, 0)).toBe(2);
  // Relative to the cap: 25 is fine with a 30 cap.
  expect(nextShedLevel(25, 30, 0)).toBe(0);
});

test('comes back one step at a time, past its own threshold', () => {
  // In between enter and leave, a level holds.
  expect(nextShedLevel(45, 60, 1)).toBe(1);
  expect(nextShedLevel(55, 60, 1)).toBe(0);
  expect(nextShedLevel(30, 60, 2)).toBe(2);
  expect(nextShedLevel(55, 60, 2)).toBe(1);
});

test('a missing reading changes nothing', () => {
  expect(nextShedLevel(0, 60, 2)).toBe(2);
  expect(nextShedLevel(30, 0, 1)).toBe(1);
});

test('re-reads the source at most twice a second', () => {
  let fps = 10;
  let reads = 0;
  setShedSource(() => {
    reads++;
    return { fps, cap: 60 };
  });
  expect(shedLevel(0)).toBe(2);
  fps = 60;
  expect(shedLevel(100)).toBe(2);
  expect(reads).toBe(1);
  expect(shedLevel(600)).toBe(1);
  expect(shedLevel(1100)).toBe(0);
});
