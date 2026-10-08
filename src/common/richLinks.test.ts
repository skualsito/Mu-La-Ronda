import { expect, test } from 'vitest';
import { hasLinks, parseRichText, plainText } from './richLinks';

test('reads an anchor as its label and address', () => {
  expect(parseRichText('Sumate al <a href="https://discord.gg/laronda">Discord</a>!')).toEqual([
    { text: 'Sumate al ' },
    { text: 'Discord', href: 'https://discord.gg/laronda' },
    { text: '!' },
  ]);
});

test('a bare web address is a link too', () => {
  expect(parseRichText('Mira https://mu.laronda.online ya')).toEqual([
    { text: 'Mira ' },
    { text: 'https://mu.laronda.online', href: 'https://mu.laronda.online/' },
    { text: ' ya' },
  ]);
});

test('never links anything but http(s), and shows other markup as text', () => {
  const evil = '<a href="javascript:alert(1)">x</a> <b>hola</b>';
  expect(hasLinks(evil)).toBe(false);
  expect(plainText(evil)).toBe(evil);
  expect(hasLinks('sin links')).toBe(false);
});
