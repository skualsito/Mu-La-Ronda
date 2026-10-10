import { describe, expect, it } from 'vitest';
import { buildAction } from './buildAction';

describe('buildAction', () => {
  it('does nothing on the same build, in dev, or without an answer', () => {
    expect(buildAction('abc', 'abc', false, null)).toBe('none');
    expect(buildAction('dev', 'abc', false, null)).toBe('none');
    expect(buildAction('abc', null, false, null)).toBe('none');
  });

  it('reloads at once outside the game, and waits for the player inside it', () => {
    expect(buildAction('abc', 'def', false, null)).toBe('reload');
    expect(buildAction('abc', 'def', true, null)).toBe('later');
  });

  it('never reloads twice for the same build', () => {
    expect(buildAction('abc', 'def', false, 'def')).toBe('none');
    expect(buildAction('abc', 'ghi', false, 'def')).toBe('reload');
  });
});
