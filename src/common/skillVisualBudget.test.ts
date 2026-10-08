import { expect, test } from 'vitest';
import { HERO_MIN_GAP_MS, OTHER_MIN_GAP_MS, OTHERS_PER_SECOND, SkillVisualBudget } from './skillVisualBudget';

test('a fast hero draws one cast per gap', () => {
  const budget = new SkillVisualBudget();
  const hero = {};
  let drawn = 0;
  // 10 casts a second for two seconds (lots of agility).
  for (let t = 0; t < 2000; t += 100) if (budget.allow(hero, true, t)) drawn++;
  expect(drawn).toBe(Math.ceil(2000 / (Math.ceil(HERO_MIN_GAP_MS / 100) * 100)));
});

test('other players get a longer gap', () => {
  const budget = new SkillVisualBudget();
  const other = {};
  expect(budget.allow(other, false, 0)).toBe(true);
  expect(budget.allow(other, false, OTHER_MIN_GAP_MS - 1)).toBe(false);
  expect(budget.allow(other, false, OTHER_MIN_GAP_MS)).toBe(true);
});

test('a crowd shares a budget per second, the hero is not part of it', () => {
  const budget = new SkillVisualBudget();
  const crowd = Array.from({ length: 100 }, () => ({}));
  const drawn = crowd.filter(player => budget.allow(player, false, 10)).length;
  expect(drawn).toBe(OTHERS_PER_SECOND);
  expect(budget.allow({}, true, 10)).toBe(true);
  // A second later the window starts over.
  expect(budget.allow(crowd[99], false, 1010)).toBe(true);
});

test('a slow frame rate thins the other players, never the hero', () => {
  const budget = new SkillVisualBudget();
  const crowd = Array.from({ length: 100 }, () => ({}));
  expect(crowd.filter(player => budget.allow(player, false, 10, 2)).length).toBe(OTHERS_PER_SECOND / 4);
  const other = {};
  expect(budget.allow(other, false, 2000, 1)).toBe(true);
  expect(budget.allow(other, false, 2000 + OTHER_MIN_GAP_MS, 1)).toBe(false);
  expect(budget.allow(other, false, 2000 + OTHER_MIN_GAP_MS * 2, 1)).toBe(true);
  const hero = {};
  expect(budget.allow(hero, true, 10)).toBe(true);
  expect(budget.allow(hero, true, 10 + HERO_MIN_GAP_MS)).toBe(true);
});
